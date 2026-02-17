import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type RouteParams = {
  params: Promise<{
    id: string
    projectId: string
    sprintId: string
    taskId: string
  }>
}

// DELETE /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId]/tasks/[taskId]
// Remove a task from a sprint (move to backlog)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, projectId, sprintId, taskId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify workspace membership
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

  // Rate limiting: 120 remove-task per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'remove-task-from-sprint',
    maxAttempts: 120,
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

  // Verify sprint exists
  const { data: sprint } = await supabase
    .from('sprints')
    .select('id')
    .eq('id', sprintId)
    .eq('project_id', projectId)
    .single()

  if (!sprint) {
    return NextResponse.json(
      { error: 'Sprint not found' },
      { status: 404 }
    )
  }

  // Set task's sprint_id to null (move to backlog)
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ sprint_id: null })
    .eq('id', taskId)
    .eq('sprint_id', sprintId)
    .eq('project_id', projectId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to remove task from sprint' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'remove-task-from-sprint')

  return NextResponse.json({ message: 'Task removed from sprint' })
}
