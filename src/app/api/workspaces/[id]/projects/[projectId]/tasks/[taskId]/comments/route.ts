import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { createCommentSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type CommentParams = Promise<{ id: string; projectId: string; taskId: string }>

// POST /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments
// Add a new comment to a task
export async function POST(
  request: NextRequest,
  { params }: { params: CommentParams }
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

  const admin = createAdminClient()

  // Verify user is a member of this workspace
  const { data: membership } = await admin
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
  const { data: project } = await admin
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
      { error: 'Cannot comment on tasks in an archived project' },
      { status: 403 }
    )
  }

  // Verify task belongs to project
  const { data: task } = await admin
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

  // Rate limiting: 60 comments per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'create-comment',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can post more comments in ${rateLimit.resetInSeconds} seconds.`,
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

  const parsed = createCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { content } = parsed.data

  // Insert comment
  const { data: newComment, error: insertError } = await admin
    .from('comments')
    .insert({
      task_id: taskId,
      user_id: user.id,
      content,
      deleted: false,
    })
    .select(`
      *,
      author:profiles!comments_user_id_fkey(full_name, email, avatar_url)
    `)
    .single()

  if (insertError || !newComment) {
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'create-comment')

  const author = (newComment as Record<string, unknown>).author as Record<string, string> | null

  return NextResponse.json({
    data: {
      id: newComment.id,
      task_id: newComment.task_id,
      user_id: newComment.user_id,
      content: newComment.content,
      deleted: newComment.deleted,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      user_name: author?.full_name ?? null,
      user_email: author?.email ?? null,
      user_avatar_url: author?.avatar_url ?? null,
      is_member: true,
    },
  }, { status: 201 })
}
