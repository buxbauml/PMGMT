import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteParams = {
  params: Promise<{ id: string; projectId: string; sprintId: string }>
}

// POST /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId]/tasks - Add tasks to sprint
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, projectId, sprintId } = await params
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

  // Rate limiting: 120 add-tasks per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'add-tasks-to-sprint',
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

  // Parse body
  let body: { task_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const taskIds = body.task_ids
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json(
      { error: 'task_ids must be a non-empty array' },
      { status: 400 }
    )
  }

  if (taskIds.length > 50) {
    return NextResponse.json(
      { error: 'Cannot add more than 50 tasks at once' },
      { status: 400 }
    )
  }

  // Validate each task_id is a valid UUID
  for (const id of taskIds) {
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Each task_id must be a valid UUID' },
        { status: 400 }
      )
    }
  }

  // Update tasks to assign them to this sprint
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ sprint_id: sprintId })
    .in('id', taskIds)
    .eq('project_id', projectId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to add tasks to sprint' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'add-tasks-to-sprint')

  return NextResponse.json({
    message: `${taskIds.length} task(s) added to sprint`,
  })
}
