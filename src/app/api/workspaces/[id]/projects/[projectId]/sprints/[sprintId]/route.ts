import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateSprintSchema } from '@/lib/validations/sprint'
import { computeSprintStatus } from '@/types/sprint'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type RouteParams = {
  params: Promise<{ id: string; projectId: string; sprintId: string }>
}

// GET /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId] - Get single sprint with tasks
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

  // Fetch sprint
  const { data: sprint, error: sprintError } = await supabase
    .from('sprints')
    .select(`
      *,
      creator:profiles!sprints_created_by_fkey(full_name),
      completer:profiles!sprints_completed_by_fkey(full_name)
    `)
    .eq('id', sprintId)
    .eq('project_id', projectId)
    .single()

  if (sprintError || !sprint) {
    return NextResponse.json(
      { error: 'Sprint not found' },
      { status: 404 }
    )
  }

  // Fetch tasks in this sprint
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, email, avatar_url),
      creator:profiles!tasks_created_by_fkey(full_name),
      completer:profiles!tasks_completed_by_fkey(full_name)
    `)
    .eq('sprint_id', sprintId)
    .order('created_at', { ascending: false })
    .limit(500)

  // Flatten task data
  const enrichedTasks = (tasks ?? []).map((task) => {
    const { assignee, creator, completer, ...rest } = task as Record<
      string,
      unknown
    >
    const assigneeData = assignee as Record<string, string> | null
    const creatorData = creator as Record<string, string> | null
    const completerData = completer as Record<string, string> | null

    return {
      ...rest,
      assignee_name: assigneeData?.full_name ?? null,
      assignee_email: assigneeData?.email ?? null,
      assignee_avatar_url: assigneeData?.avatar_url ?? null,
      created_by_name: creatorData?.full_name ?? null,
      completed_by_name: completerData?.full_name ?? null,
    }
  })

  // Build task counts
  const totalTasks = enrichedTasks.length
  const completedTasks = enrichedTasks.filter(
    (t) => (t as Record<string, unknown>).status === 'done'
  ).length
  const inProgressTasks = enrichedTasks.filter(
    (t) => (t as Record<string, unknown>).status === 'in_progress'
  ).length
  const todoTasks = enrichedTasks.filter(
    (t) => (t as Record<string, unknown>).status === 'to_do'
  ).length

  // Flatten sprint data
  const { creator, completer, ...sprintRest } = sprint as Record<
    string,
    unknown
  >
  const creatorData = creator as Record<string, string> | null
  const completerData = completer as Record<string, string> | null

  return NextResponse.json({
    data: {
      ...sprintRest,
      status: computeSprintStatus(
        sprintRest.start_date as string,
        sprintRest.end_date as string,
        sprintRest.completed as boolean
      ),
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      in_progress_tasks: inProgressTasks,
      todo_tasks: todoTasks,
      created_by_name: creatorData?.full_name ?? null,
      completed_by_name: completerData?.full_name ?? null,
    },
    tasks: enrichedTasks,
  })
}

// PATCH /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId] - Update sprint
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, projectId, sprintId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin or owner
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

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace admins can update sprints' },
      { status: 403 }
    )
  }

  // Verify project exists and is not archived
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
      { error: 'Cannot modify sprints in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 60 sprint updates per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'update-sprint',
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

  const parsed = updateSprintSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.start_date !== undefined)
    updateData.start_date = parsed.data.start_date
  if (parsed.data.end_date !== undefined)
    updateData.end_date = parsed.data.end_date

  // Handle completion
  if (parsed.data.completed !== undefined) {
    updateData.completed = parsed.data.completed
    if (parsed.data.completed) {
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = user.id
    } else {
      updateData.completed_at = null
      updateData.completed_by = null
    }
  }

  // If both dates provided in update, validate end > start
  if (parsed.data.start_date && parsed.data.end_date) {
    const start = new Date(parsed.data.start_date)
    const end = new Date(parsed.data.end_date)
    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }
  }

  // If only one date provided, fetch current sprint and validate
  if (
    (parsed.data.start_date && !parsed.data.end_date) ||
    (!parsed.data.start_date && parsed.data.end_date)
  ) {
    const { data: currentSprint } = await supabase
      .from('sprints')
      .select('start_date, end_date')
      .eq('id', sprintId)
      .eq('project_id', projectId)
      .single()

    if (currentSprint) {
      const startStr = parsed.data.start_date ?? currentSprint.start_date
      const endStr = parsed.data.end_date ?? currentSprint.end_date
      const start = new Date(startStr)
      const end = new Date(endStr)
      if (end <= start) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }
  }

  updateData.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('sprints')
    .update(updateData)
    .eq('id', sprintId)
    .eq('project_id', projectId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update sprint' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'update-sprint')

  // When sprint is marked complete, auto-complete all incomplete tasks
  if (parsed.data.completed === true) {
    await supabase
      .from('tasks')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('sprint_id', sprintId)
      .neq('status', 'done')
  }

  // Fetch updated sprint with joins
  const { data: updatedSprint } = await supabase
    .from('sprints')
    .select(`
      *,
      creator:profiles!sprints_created_by_fkey(full_name),
      completer:profiles!sprints_completed_by_fkey(full_name)
    `)
    .eq('id', sprintId)
    .single()

  if (!updatedSprint) {
    return NextResponse.json(
      { error: 'Failed to fetch updated sprint' },
      { status: 500 }
    )
  }

  // Get task counts
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('sprint_id', sprintId)

  const totalTasks = tasks?.length ?? 0
  const completedTasks = tasks?.filter((t) => t.status === 'done').length ?? 0
  const inProgressTasks =
    tasks?.filter((t) => t.status === 'in_progress').length ?? 0
  const todoTasks = tasks?.filter((t) => t.status === 'to_do').length ?? 0

  const { creator, completer, ...sprintRest } = updatedSprint as Record<
    string,
    unknown
  >
  const creatorData = creator as Record<string, string> | null
  const completerData = completer as Record<string, string> | null

  return NextResponse.json({
    data: {
      ...sprintRest,
      status: computeSprintStatus(
        sprintRest.start_date as string,
        sprintRest.end_date as string,
        sprintRest.completed as boolean
      ),
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      in_progress_tasks: inProgressTasks,
      todo_tasks: todoTasks,
      created_by_name: creatorData?.full_name ?? null,
      completed_by_name: completerData?.full_name ?? null,
    },
  })
}

// DELETE /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId] - Delete sprint
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, projectId, sprintId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin or owner
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

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only workspace admins can delete sprints' },
      { status: 403 }
    )
  }

  // Verify project is not archived
  const { data: projectForDelete } = await supabase
    .from('projects')
    .select('id, archived')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!projectForDelete) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  if (projectForDelete.archived) {
    return NextResponse.json(
      { error: 'Cannot delete sprints in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 30 sprint deletes per hour per user
  const deleteRateLimit = checkRateLimit(user.id, {
    prefix: 'delete-sprint',
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
  })

  if (!deleteRateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${deleteRateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Collect task IDs before moving them, so we can restore on failure
  const { data: tasksInSprint } = await supabase
    .from('tasks')
    .select('id')
    .eq('sprint_id', sprintId)

  const taskIdsToRestore = (tasksInSprint ?? []).map((t) => t.id)

  // Move tasks to backlog (set sprint_id to null)
  if (taskIdsToRestore.length > 0) {
    const { error: nullifyError } = await supabase
      .from('tasks')
      .update({ sprint_id: null })
      .eq('sprint_id', sprintId)

    if (nullifyError) {
      return NextResponse.json(
        { error: 'Failed to remove tasks from sprint' },
        { status: 500 }
      )
    }
  }

  // Delete the sprint
  const { error: deleteError } = await supabase
    .from('sprints')
    .delete()
    .eq('id', sprintId)
    .eq('project_id', projectId)

  if (deleteError) {
    // Attempt to restore tasks back to the sprint
    if (taskIdsToRestore.length > 0) {
      await supabase
        .from('tasks')
        .update({ sprint_id: sprintId })
        .in('id', taskIdsToRestore)
    }
    return NextResponse.json(
      { error: 'Failed to delete sprint' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'delete-sprint')

  return NextResponse.json({ message: 'Sprint deleted' })
}
