import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAttachmentSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type AttachmentParams = Promise<{
  id: string
  projectId: string
  taskId: string
}>

// GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/attachments
// List all attachments for a task
export async function GET(
  _request: NextRequest,
  { params }: { params: AttachmentParams }
) {
  const { id: workspaceId, projectId, taskId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this workspace' },
      { status: 403 }
    )
  }

  // Verify project belongs to workspace
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  // Verify task belongs to project
  const { data: task } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  // Fetch attachments with uploader info
  const { data: attachments, error: fetchError } = await supabase
    .from('task_attachments')
    .select(`
      *,
      uploader:profiles!task_attachments_uploaded_by_fkey(full_name, email)
    `)
    .eq('task_id', taskId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json(
      { error: 'Failed to load attachments' },
      { status: 500 }
    )
  }

  // Generate signed thumbnail URLs for image attachments
  const imageAttachments = (attachments ?? []).filter((a) =>
    a.mime_type.startsWith('image/')
  )

  const thumbnailUrls: Record<string, string> = {}
  if (imageAttachments.length > 0) {
    const paths = imageAttachments.map((a) => a.storage_path)
    const { data: signedUrls } = await supabase.storage
      .from('task-attachments')
      .createSignedUrls(paths, 3600) // 1 hour

    if (signedUrls) {
      signedUrls.forEach((item, index) => {
        if (!item.error && item.signedUrl) {
          thumbnailUrls[imageAttachments[index].id] = item.signedUrl
        }
      })
    }
  }

  // Map to response format
  const data = (attachments ?? []).map((a) => {
    const uploader = (a as Record<string, unknown>).uploader as Record<
      string,
      string
    > | null
    return {
      id: a.id,
      task_id: a.task_id,
      workspace_id: a.workspace_id,
      original_filename: a.original_filename,
      file_size: a.file_size,
      mime_type: a.mime_type,
      storage_path: a.storage_path,
      uploaded_by: a.uploaded_by,
      created_at: a.created_at,
      uploaded_by_name: uploader?.full_name ?? null,
      uploaded_by_email: uploader?.email ?? null,
      thumbnail_url: thumbnailUrls[a.id] ?? null,
    }
  })

  return NextResponse.json({ data })
}

// POST /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/attachments
// Create a new attachment record (file already uploaded to storage by client)
export async function POST(
  request: NextRequest,
  { params }: { params: AttachmentParams }
) {
  const { id: workspaceId, projectId, taskId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this workspace' },
      { status: 403 }
    )
  }

  // Verify project belongs to workspace and is not archived
  const { data: project } = await supabase
    .from('projects')
    .select('id, archived')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (project.archived) {
    return NextResponse.json(
      { error: 'Cannot attach files to tasks in an archived project' },
      { status: 403 }
    )
  }

  // Verify task belongs to project
  const { data: task } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  // Rate limiting: 30 uploads per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'upload-attachment',
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can upload more files in ${rateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createAttachmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { original_filename, file_size, mime_type, storage_path } = parsed.data

  // Verify the storage path starts with workspace_id/task_id/ (prevent path traversal)
  const expectedPrefix = `${workspaceId}/${taskId}/`
  if (!storage_path.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: 'Invalid storage path' },
      { status: 400 }
    )
  }

  // Verify file exists in storage
  const { data: fileData, error: fileError } = await supabase.storage
    .from('task-attachments')
    .createSignedUrl(storage_path, 60)

  if (fileError || !fileData) {
    return NextResponse.json(
      { error: 'File not found in storage. Upload the file first.' },
      { status: 400 }
    )
  }

  // Insert attachment record
  const { data: newAttachment, error: insertError } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      workspace_id: workspaceId,
      original_filename,
      file_size,
      mime_type,
      storage_path,
      uploaded_by: user.id,
    })
    .select(`
      *,
      uploader:profiles!task_attachments_uploaded_by_fkey(full_name, email)
    `)
    .single()

  if (insertError || !newAttachment) {
    // Check for attachment limit trigger
    if (insertError?.message?.includes('Maximum of 50 attachments')) {
      return NextResponse.json(
        { error: 'Maximum of 50 attachments per task reached' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to save attachment record' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'upload-attachment')

  const uploader = (newAttachment as Record<string, unknown>).uploader as Record<
    string,
    string
  > | null

  // Generate thumbnail URL if this is an image
  let thumbnailUrl: string | null = null
  if (mime_type.startsWith('image/')) {
    const { data: signedData } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(storage_path, 3600)
    if (signedData?.signedUrl) {
      thumbnailUrl = signedData.signedUrl
    }
  }

  return NextResponse.json(
    {
      data: {
        id: newAttachment.id,
        task_id: newAttachment.task_id,
        workspace_id: newAttachment.workspace_id,
        original_filename: newAttachment.original_filename,
        file_size: newAttachment.file_size,
        mime_type: newAttachment.mime_type,
        storage_path: newAttachment.storage_path,
        uploaded_by: newAttachment.uploaded_by,
        created_at: newAttachment.created_at,
        uploaded_by_name: uploader?.full_name ?? null,
        uploaded_by_email: uploader?.email ?? null,
        thumbnail_url: thumbnailUrl,
      },
    },
    { status: 201 }
  )
}
