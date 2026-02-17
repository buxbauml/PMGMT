import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type AttachmentIdParams = Promise<{
  id: string
  projectId: string
  taskId: string
  attachmentId: string
}>

// DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/attachments/[attachmentId]
// Delete an attachment (file + metadata)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: AttachmentIdParams }
) {
  const { id: workspaceId, projectId, taskId, attachmentId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of this workspace and get role
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

  // Rate limiting: 60 deletes per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'delete-attachment',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Fetch the attachment
  const { data: attachment } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('task_id', taskId)
    .single()

  if (!attachment) {
    return NextResponse.json(
      { error: 'Attachment not found' },
      { status: 404 }
    )
  }

  // Permission check: uploader or workspace admin/owner
  const isUploader = attachment.uploaded_by === user.id
  const isAdminOrOwner = ['owner', 'admin'].includes(membership.role)

  if (!isUploader && !isAdminOrOwner) {
    return NextResponse.json(
      { error: 'Only the file uploader or workspace admins can delete attachments' },
      { status: 403 }
    )
  }

  // Delete from Supabase Storage first
  const { error: storageError } = await supabase.storage
    .from('task-attachments')
    .remove([attachment.storage_path])

  if (storageError) {
    return NextResponse.json(
      { error: 'Failed to delete file from storage' },
      { status: 500 }
    )
  }

  // Delete the database record
  const { error: deleteError } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('task_id', taskId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete attachment record' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'delete-attachment')

  return NextResponse.json({ success: true })
}
