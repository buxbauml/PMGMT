import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateCommentSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type CommentIdParams = Promise<{
  id: string
  projectId: string
  taskId: string
  commentId: string
}>

// PATCH /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]
// Edit a comment (within 15-minute window)
export async function PATCH(
  request: NextRequest,
  { params }: { params: CommentIdParams }
) {
  const { id: workspaceId, projectId, taskId, commentId } = await params
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

  // Fetch the comment
  const { data: comment } = await supabase
    .from('comments')
    .select('*')
    .eq('id', commentId)
    .eq('task_id', taskId)
    .single()

  if (!comment) {
    return NextResponse.json(
      { error: 'Comment not found' },
      { status: 404 }
    )
  }

  // Only the comment author can edit
  if (comment.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only edit your own comments' },
      { status: 403 }
    )
  }

  // Check 15-minute edit window
  const createdAt = new Date(comment.created_at)
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()
  const fifteenMinutes = 15 * 60 * 1000

  if (diffMs > fifteenMinutes) {
    return NextResponse.json(
      { error: 'Edit window expired. Comments can only be edited within 15 minutes of posting.' },
      { status: 403 }
    )
  }

  // Check if comment is already deleted
  if (comment.deleted) {
    return NextResponse.json(
      { error: 'Cannot edit a deleted comment' },
      { status: 400 }
    )
  }

  // Rate limiting
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'edit-comment',
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

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { content } = parsed.data

  // Update comment
  const { error: updateError } = await supabase
    .from('comments')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('task_id', taskId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'edit-comment')

  // Fetch updated comment with joined data
  const { data: updatedComment } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_user_id_fkey(full_name, email, avatar_url)
    `)
    .eq('id', commentId)
    .single()

  if (!updatedComment) {
    return NextResponse.json(
      { error: 'Failed to fetch updated comment' },
      { status: 500 }
    )
  }

  const author = (updatedComment as Record<string, unknown>).author as Record<string, string> | null

  return NextResponse.json({
    data: {
      id: updatedComment.id,
      task_id: updatedComment.task_id,
      user_id: updatedComment.user_id,
      content: updatedComment.content,
      deleted: updatedComment.deleted,
      created_at: updatedComment.created_at,
      updated_at: updatedComment.updated_at,
      user_name: author?.full_name ?? null,
      user_email: author?.email ?? null,
      user_avatar_url: author?.avatar_url ?? null,
      is_member: true,
    },
  })
}

// DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]
// Soft-delete a comment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: CommentIdParams }
) {
  const { id: workspaceId, projectId, taskId, commentId } = await params
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

  // Fetch the comment
  const { data: comment } = await supabase
    .from('comments')
    .select('*')
    .eq('id', commentId)
    .eq('task_id', taskId)
    .single()

  if (!comment) {
    return NextResponse.json(
      { error: 'Comment not found' },
      { status: 404 }
    )
  }

  // Permission check: comment author or workspace admin/owner
  const isAuthor = comment.user_id === user.id
  const isAdminOrOwner = ['owner', 'admin'].includes(membership.role)

  if (!isAuthor && !isAdminOrOwner) {
    return NextResponse.json(
      { error: 'Only the comment author or workspace admins can delete comments' },
      { status: 403 }
    )
  }

  // Soft-delete: set deleted = true and replace content with placeholder
  // (content: '[deleted]' satisfies the DB CHECK constraint requiring length >= 1)
  const { error: deleteError } = await supabase
    .from('comments')
    .update({ deleted: true, content: '[deleted]', updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('task_id', taskId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
