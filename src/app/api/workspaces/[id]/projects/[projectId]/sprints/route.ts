import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSprintSchema } from '@/lib/validations/sprint'
import { computeSprintStatus } from '@/types/sprint'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

// GET /api/workspaces/[id]/projects/[projectId]/sprints - List all sprints for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const { id: workspaceId, projectId } = await params
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

  // Verify project exists and belongs to this workspace
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

  // Fetch sprints with creator and completer profile data
  const { data: sprints, error: sprintsError } = await supabase
    .from('sprints')
    .select(`
      *,
      creator:profiles!sprints_created_by_fkey(full_name),
      completer:profiles!sprints_completed_by_fkey(full_name)
    `)
    .eq('project_id', projectId)
    .order('start_date', { ascending: true })
    .limit(100)

  if (sprintsError) {
    return NextResponse.json(
      { error: 'Failed to fetch sprints' },
      { status: 500 }
    )
  }

  // Fetch task counts grouped by sprint
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, sprint_id, status')
    .eq('project_id', projectId)
    .not('sprint_id', 'is', null)

  // Build sprint task counts map
  const taskCountsMap: Record<
    string,
    { total: number; completed: number; in_progress: number; todo: number }
  > = {}

  for (const task of tasks ?? []) {
    if (!task.sprint_id) continue
    if (!taskCountsMap[task.sprint_id]) {
      taskCountsMap[task.sprint_id] = {
        total: 0,
        completed: 0,
        in_progress: 0,
        todo: 0,
      }
    }
    taskCountsMap[task.sprint_id].total++
    if (task.status === 'done') taskCountsMap[task.sprint_id].completed++
    else if (task.status === 'in_progress')
      taskCountsMap[task.sprint_id].in_progress++
    else taskCountsMap[task.sprint_id].todo++
  }

  // Enrich sprints with computed status and task counts
  const enrichedSprints = (sprints ?? []).map((sprint) => {
    const { creator, completer, ...rest } = sprint as Record<string, unknown>
    const creatorData = creator as Record<string, string> | null
    const completerData = completer as Record<string, string> | null
    const sprintId = rest.id as string
    const counts = taskCountsMap[sprintId] ?? {
      total: 0,
      completed: 0,
      in_progress: 0,
      todo: 0,
    }

    return {
      ...rest,
      status: computeSprintStatus(
        rest.start_date as string,
        rest.end_date as string,
        rest.completed as boolean
      ),
      total_tasks: counts.total,
      completed_tasks: counts.completed,
      in_progress_tasks: counts.in_progress,
      todo_tasks: counts.todo,
      created_by_name: creatorData?.full_name ?? null,
      completed_by_name: completerData?.full_name ?? null,
    }
  })

  return NextResponse.json({ data: enrichedSprints })
}

// POST /api/workspaces/[id]/projects/[projectId]/sprints - Create a new sprint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const { id: workspaceId, projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is an admin or owner of this workspace
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
      { error: 'Only workspace admins can create sprints' },
      { status: 403 }
    )
  }

  // Verify project exists and belongs to this workspace
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
      { error: 'Cannot create sprints in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 30 sprints per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'create-sprint',
    maxAttempts: 30,
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

  const parsed = createSprintSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { name, start_date, end_date } = parsed.data

  // Check for overlapping sprints in this project
  const { data: overlapping } = await supabase
    .from('sprints')
    .select('id, name, start_date, end_date')
    .eq('project_id', projectId)
    .eq('completed', false)
    .lte('start_date', end_date)
    .gte('end_date', start_date)

  const overlapWarning =
    overlapping && overlapping.length > 0
      ? `This sprint overlaps with: ${overlapping.map((s) => s.name).join(', ')}`
      : null

  // Create the sprint
  const { data: sprint, error: createError } = await supabase
    .from('sprints')
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      name,
      start_date,
      end_date,
      completed: false,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to create sprint' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'create-sprint')

  // Fetch with profile joins
  const { data: enrichedSprint } = await supabase
    .from('sprints')
    .select(`
      *,
      creator:profiles!sprints_created_by_fkey(full_name),
      completer:profiles!sprints_completed_by_fkey(full_name)
    `)
    .eq('id', sprint.id)
    .single()

  if (!enrichedSprint) {
    return NextResponse.json(
      {
        data: {
          ...sprint,
          status: computeSprintStatus(
            sprint.start_date,
            sprint.end_date,
            sprint.completed
          ),
          total_tasks: 0,
          completed_tasks: 0,
          in_progress_tasks: 0,
          todo_tasks: 0,
          created_by_name: null,
          completed_by_name: null,
        },
        warning: overlapWarning,
      },
      { status: 201 }
    )
  }

  const { creator, completer, ...rest } = enrichedSprint as Record<
    string,
    unknown
  >
  const creatorData = creator as Record<string, string> | null
  const completerData = completer as Record<string, string> | null

  return NextResponse.json(
    {
      data: {
        ...rest,
        status: computeSprintStatus(
          rest.start_date as string,
          rest.end_date as string,
          rest.completed as boolean
        ),
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0,
        todo_tasks: 0,
        created_by_name: creatorData?.full_name ?? null,
        completed_by_name: completerData?.full_name ?? null,
      },
      warning: overlapWarning,
    },
    { status: 201 }
  )
}
