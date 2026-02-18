import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { createProjectSchema } from '@/lib/validations/project'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

// GET /api/workspaces/[id]/projects - List all projects in workspace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
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

  // Check if archived projects should be included
  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('include_archived') === 'true'

  // Build query
  let query = admin
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data: projects, error: projectsError } = await query

  if (projectsError) {
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }

  // Fetch task counts for progress calculation
  // Note: The tasks table may not exist yet (PROJ-4). We handle this gracefully.
  let taskCounts: Record<string, { total: number; completed: number }> = {}

  try {
    const projectIds = (projects || []).map((p) => p.id)
    if (projectIds.length > 0) {
      // Get total task counts per project
      const { data: totalCounts } = await admin
        .from('tasks')
        .select('project_id')
        .in('project_id', projectIds)

      // Get completed task counts per project
      const { data: completedCounts } = await admin
        .from('tasks')
        .select('project_id')
        .in('project_id', projectIds)
        .eq('status', 'done')

      // Aggregate counts
      if (totalCounts) {
        for (const row of totalCounts) {
          if (!taskCounts[row.project_id]) {
            taskCounts[row.project_id] = { total: 0, completed: 0 }
          }
          taskCounts[row.project_id].total++
        }
      }
      if (completedCounts) {
        for (const row of completedCounts) {
          if (!taskCounts[row.project_id]) {
            taskCounts[row.project_id] = { total: 0, completed: 0 }
          }
          taskCounts[row.project_id].completed++
        }
      }
    }
  } catch {
    // Tasks table may not exist yet - that's fine, return 0 counts
    taskCounts = {}
  }

  // Enrich projects with task counts
  const enrichedProjects = (projects || []).map((project) => {
    const counts = taskCounts[project.id] || { total: 0, completed: 0 }
    return {
      ...project,
      total_tasks: counts.total,
      completed_tasks: counts.completed,
      progress: counts.total > 0
        ? Math.round((counts.completed / counts.total) * 100)
        : 0,
    }
  })

  return NextResponse.json({ data: enrichedProjects })
}

// POST /api/workspaces/[id]/projects - Create a new project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Rate limiting: max 20 projects created per hour
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'create-project',
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can create more projects in ${rateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

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

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { name, description, start_date, end_date } = parsed.data

  // Create project
  const { data: project, error: createError } = await admin
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name,
      description: description || null,
      start_date: start_date || null,
      end_date: end_date || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }

  // Record rate limit attempt after successful creation
  recordRateLimitAttempt(user.id, 'create-project')

  return NextResponse.json(
    {
      data: {
        ...project,
        total_tasks: 0,
        completed_tasks: 0,
        progress: 0,
      },
    },
    { status: 201 }
  )
}
