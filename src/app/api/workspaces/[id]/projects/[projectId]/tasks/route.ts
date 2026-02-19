import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { createTaskSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

// GET /api/workspaces/[id]/projects/[projectId]/tasks - List all tasks in a project
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

  // Verify project exists and belongs to this workspace
  const { data: project } = await admin
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

  // Fetch tasks with assignee and creator profile data via joins
  const { data: tasks, error: tasksError } = await admin
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, email, avatar_url),
      creator:profiles!tasks_created_by_fkey(full_name),
      completer:profiles!tasks_completed_by_fkey(full_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (tasksError) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }

  // Flatten the joined data for the frontend
  const enrichedTasks = (tasks ?? []).map((task) => {
    const { assignee, creator, completer, ...rest } = task as Record<string, unknown>
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

  return NextResponse.json({ data: enrichedTasks })
}

// POST /api/workspaces/[id]/projects/[projectId]/tasks - Create a new task
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

  // Verify project exists and belongs to this workspace
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
      { error: 'Cannot create tasks in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 60 tasks per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'create-task',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can create more tasks in ${rateLimit.resetInSeconds} seconds.`,
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

  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { title, description, assignee_id, sprint_id, status, priority, estimated_hours } = parsed.data

  // If assignee_id is provided, verify they are a workspace member
  const cleanAssigneeId = assignee_id && assignee_id !== '' ? assignee_id : null
  if (cleanAssigneeId) {
    const { data: assigneeMembership } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', cleanAssigneeId)
      .single()

    if (!assigneeMembership) {
      return NextResponse.json(
        { error: 'Assignee is not a member of this workspace' },
        { status: 400 }
      )
    }
  }

  // If sprint_id is provided, verify the sprint exists in this project
  const cleanSprintId = sprint_id && sprint_id !== '' ? sprint_id : null
  if (cleanSprintId) {
    const { data: sprint } = await admin
      .from('sprints')
      .select('id')
      .eq('id', cleanSprintId)
      .eq('project_id', projectId)
      .single()

    if (!sprint) {
      return NextResponse.json(
        { error: 'Sprint not found in this project' },
        { status: 400 }
      )
    }
  }

  // Build insert data
  const insertData: Record<string, unknown> = {
    project_id: projectId,
    title,
    description: description || null,
    assignee_id: cleanAssigneeId,
    sprint_id: cleanSprintId,
    status,
    priority,
    created_by: user.id,
    estimated_hours: estimated_hours ?? null,
  }

  // If task is created as "done", record completion info
  if (status === 'done') {
    insertData.completed_at = new Date().toISOString()
    insertData.completed_by = user.id
  }

  // Create the task
  const { data: task, error: createError } = await admin
    .from('tasks')
    .insert(insertData)
    .select()
    .single()

  if (createError) {
    console.error('Task creation error:', createError.message, createError.code, createError.details)
    return NextResponse.json(
      { error: `Failed to create task: ${createError.message}` },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'create-task')

  // --- PROJ-5: Generate "created" activity log ---
  const activityEntries: {
    task_id: string
    user_id: string
    activity_type: string
    old_value: string | null
    new_value: string | null
  }[] = [
    {
      task_id: task.id,
      user_id: user.id,
      activity_type: 'created',
      old_value: null,
      new_value: null,
    },
  ]

  // If task is created with an assignee, also log the assignment with display name
  if (cleanAssigneeId) {
    let assigneeName: string = cleanAssigneeId
    const { data: assigneeProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', cleanAssigneeId)
      .single()
    if (assigneeProfile?.full_name) {
      assigneeName = assigneeProfile.full_name
    }

    activityEntries.push({
      task_id: task.id,
      user_id: user.id,
      activity_type: 'assigned',
      old_value: null,
      new_value: assigneeName,
    })
  }

  // Insert activity logs (non-blocking - don't fail the request if logging fails)
  await admin.from('activity_logs').insert(activityEntries)

  // Fetch the task with joined profile data to return enriched result
  const { data: enrichedTask } = await admin
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, email, avatar_url),
      creator:profiles!tasks_created_by_fkey(full_name),
      completer:profiles!tasks_completed_by_fkey(full_name)
    `)
    .eq('id', task.id)
    .single()

  if (!enrichedTask) {
    // Fall back to raw task data if join fails
    return NextResponse.json(
      {
        data: {
          ...task,
          assignee_name: null,
          assignee_email: null,
          assignee_avatar_url: null,
          created_by_name: null,
          completed_by_name: null,
        },
      },
      { status: 201 }
    )
  }

  const { assignee, creator, completer, ...rest } = enrichedTask as Record<string, unknown>
  const assigneeData = assignee as Record<string, string> | null
  const creatorData = creator as Record<string, string> | null
  const completerData = completer as Record<string, string> | null

  return NextResponse.json(
    {
      data: {
        ...rest,
        assignee_name: assigneeData?.full_name ?? null,
        assignee_email: assigneeData?.email ?? null,
        assignee_avatar_url: assigneeData?.avatar_url ?? null,
        created_by_name: creatorData?.full_name ?? null,
        completed_by_name: completerData?.full_name ?? null,
      },
    },
    { status: 201 }
  )
}
