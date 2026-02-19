import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type ReportsParams = Promise<{ id: string }>

// GET /api/workspaces/[id]/reports?projectId=<optional>&startDate=<optional>&endDate=<optional>
// Returns all aggregated report data for the reporting dashboard
export async function GET(
  request: NextRequest,
  { params }: { params: ReportsParams }
) {
  const { id: workspaceId } = await params
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting: 30 requests per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'reports',
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

  const admin = createAdminClient()

  // 2. Verify workspace membership
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

  recordRateLimitAttempt(user.id, 'reports')

  // 3. Parse query params
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') || null
  const startDate = searchParams.get('startDate') || null
  const endDate = searchParams.get('endDate') || null

  // 4. Get all projects in this workspace (needed for filtering)
  let projectIds: string[] = []
  if (projectId) {
    // Verify this project belongs to the workspace
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
    projectIds = [projectId]
  } else {
    // Get all non-archived projects in the workspace
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('archived', false)
      .limit(200)

    projectIds = (projects ?? []).map((p) => p.id)
  }

  // If no projects, return empty report data
  if (projectIds.length === 0) {
    return NextResponse.json({
      data: buildEmptyReport(),
    })
  }

  try {
    // 5. Fetch all tasks for these projects (with optional date range filter)
    let tasksQuery = admin
      .from('tasks')
      .select('id, status, assignee_id, completed_at, sprint_id, project_id, created_at')
      .in('project_id', projectIds)

    if (startDate) {
      tasksQuery = tasksQuery.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      tasksQuery = tasksQuery.lte('created_at', `${endDate}T23:59:59`)
    }

    const { data: tasks, error: tasksError } = await tasksQuery.limit(5000)

    if (tasksError) {
      return NextResponse.json(
        { error: 'Failed to fetch task data' },
        { status: 500 }
      )
    }

    const allTasks = tasks ?? []

    // --- Task count metrics ---
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((t) => t.status === 'done').length
    const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress').length
    const todoTasks = allTasks.filter((t) => t.status === 'to_do').length
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // --- Status breakdown (for pie chart) ---
    const statusBreakdown = [
      { name: 'To Do', value: todoTasks },
      { name: 'In Progress', value: inProgressTasks },
      { name: 'Done', value: completedTasks },
    ]

    // --- Assignee breakdown (for bar chart) ---
    const assigneeTaskCounts = new Map<string, number>()
    for (const task of allTasks) {
      if (task.assignee_id) {
        assigneeTaskCounts.set(
          task.assignee_id,
          (assigneeTaskCounts.get(task.assignee_id) ?? 0) + 1
        )
      }
    }

    // Fetch profile names for assignees
    const assigneeIds = Array.from(assigneeTaskCounts.keys())
    let assigneeBreakdown: { name: string; tasks: number }[] = []

    if (assigneeIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds)
        .limit(100)

      const profileMap = new Map<string, string>()
      for (const profile of profiles ?? []) {
        profileMap.set(
          profile.id,
          profile.full_name || profile.email || 'Unknown'
        )
      }

      assigneeBreakdown = Array.from(assigneeTaskCounts.entries())
        .map(([id, count]) => ({
          name: profileMap.get(id) ?? 'Unknown',
          tasks: count,
        }))
        .sort((a, b) => b.tasks - a.tasks)
        .slice(0, 15) // Top 15 assignees
    }

    // --- Completion trend (last 8 weeks) ---
    const completionTrend = computeCompletionTrend(allTasks)

    // --- Velocity (last 5 completed sprints) ---
    const velocity = await computeVelocity(admin, projectIds)

    // --- Sprint burndown (active sprint) ---
    const burndown = await computeBurndown(admin, projectIds, allTasks)

    // --- Total hours logged (from time_logs) ---
    const totalHoursLogged = await computeTotalHoursLogged(
      admin,
      workspaceId,
      projectIds
    )

    // --- Avg time per task ---
    const avgTimePerTask =
      totalHoursLogged !== null && completedTasks > 0
        ? Math.round((totalHoursLogged / completedTasks) * 100) / 100
        : null

    return NextResponse.json({
      data: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        completionRate,
        velocity,
        totalHoursLogged,
        avgTimePerTask,
        statusBreakdown,
        assigneeBreakdown,
        completionTrend,
        burndown,
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report data' },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper functions
// ============================================================

function buildEmptyReport() {
  return {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    completionRate: 0,
    velocity: null,
    totalHoursLogged: null,
    avgTimePerTask: null,
    statusBreakdown: [],
    assigneeBreakdown: [],
    completionTrend: [],
    burndown: null,
  }
}

/**
 * Compute tasks completed per week for the last 8 weeks.
 * Groups completed tasks by ISO week based on their completed_at timestamp.
 */
function computeCompletionTrend(
  tasks: { status: string; completed_at: string | null }[]
) {
  const now = new Date()
  const weeks: { weekStart: Date; label: string }[] = []

  // Generate the last 8 week buckets (most recent first, then reverse)
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - i * 7)
    weekStart.setHours(0, 0, 0, 0)

    const month = weekStart.toLocaleString('en-US', { month: 'short' })
    const day = weekStart.getDate()
    weeks.push({
      weekStart,
      label: `${month} ${day}`,
    })
  }

  // Count completed tasks per week
  const counts = new Array(8).fill(0)
  const eightWeeksAgo = weeks[0].weekStart

  for (const task of tasks) {
    if (task.status !== 'done' || !task.completed_at) continue

    const completedDate = new Date(task.completed_at)
    if (completedDate < eightWeeksAgo) continue

    // Find which week bucket this task falls into
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (completedDate >= weeks[i].weekStart) {
        counts[i]++
        break
      }
    }
  }

  return weeks.map((w, i) => ({
    week: w.label,
    completed: counts[i],
  }))
}

/**
 * Compute average velocity across the last 5 completed sprints.
 * Velocity = average number of tasks completed per sprint.
 */
async function computeVelocity(
  admin: ReturnType<typeof createAdminClient>,
  projectIds: string[]
): Promise<number | null> {
  if (projectIds.length === 0) return null

  // Get last 5 completed sprints across all relevant projects
  const { data: completedSprints } = await admin
    .from('sprints')
    .select('id')
    .in('project_id', projectIds)
    .eq('completed', true)
    .order('completed_at', { ascending: false })
    .limit(5)

  if (!completedSprints || completedSprints.length === 0) return null

  const sprintIds = completedSprints.map((s) => s.id)

  // Count done tasks in each sprint
  const { data: sprintTasks } = await admin
    .from('tasks')
    .select('sprint_id, status')
    .in('sprint_id', sprintIds)
    .eq('status', 'done')
    .limit(5000)

  if (!sprintTasks) return null

  // Group by sprint
  const sprintCounts = new Map<string, number>()
  for (const task of sprintTasks) {
    if (task.sprint_id) {
      sprintCounts.set(
        task.sprint_id,
        (sprintCounts.get(task.sprint_id) ?? 0) + 1
      )
    }
  }

  // Compute average (include sprints with 0 completed tasks)
  let total = 0
  for (const sprintId of sprintIds) {
    total += sprintCounts.get(sprintId) ?? 0
  }

  return Math.round((total / sprintIds.length) * 10) / 10
}

/**
 * Compute burndown data for the currently active sprint.
 * Active sprint = not completed, start_date <= today, end_date >= today.
 */
async function computeBurndown(
  admin: ReturnType<typeof createAdminClient>,
  projectIds: string[],
  allTasks: { id: string; sprint_id: string | null; status: string; completed_at: string | null }[]
): Promise<{
  sprintName: string
  data: { date: string; ideal: number; actual: number }[]
} | null> {
  if (projectIds.length === 0) return null

  const today = new Date().toISOString().split('T')[0]

  // Find the active sprint (not completed, currently in date range)
  const { data: activeSprints } = await admin
    .from('sprints')
    .select('id, name, start_date, end_date')
    .in('project_id', projectIds)
    .eq('completed', false)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(1)

  if (!activeSprints || activeSprints.length === 0) return null

  const sprint = activeSprints[0]

  // Get all tasks assigned to this sprint
  const sprintTasks = allTasks.filter((t) => t.sprint_id === sprint.id)
  const totalSprintTasks = sprintTasks.length

  if (totalSprintTasks === 0) return null

  // Build date range from sprint start to end
  const startDate = new Date(sprint.start_date + 'T00:00:00')
  const endDate = new Date(sprint.end_date + 'T00:00:00')
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (totalDays <= 0) return null

  // Build ideal burndown line
  const burndownData: { date: string; ideal: number; actual: number }[] = []
  const idealDecrement = totalSprintTasks / totalDays

  // Collect completed task dates
  const completionsByDate = new Map<string, number>()
  for (const task of sprintTasks) {
    if (task.status === 'done' && task.completed_at) {
      const dateKey = task.completed_at.split('T')[0]
      completionsByDate.set(
        dateKey,
        (completionsByDate.get(dateKey) ?? 0) + 1
      )
    }
  }

  let cumulativeCompleted = 0
  const todayDate = new Date(today + 'T00:00:00')

  for (let i = 0; i <= totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)

    // Stop generating burndown data beyond today
    if (currentDate > todayDate) break

    const dateStr = currentDate.toISOString().split('T')[0]
    const monthDay = currentDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    })

    // Ideal remaining
    const ideal = Math.max(
      0,
      Math.round((totalSprintTasks - idealDecrement * i) * 10) / 10
    )

    // Actual remaining: total tasks minus cumulative completions up to this date
    cumulativeCompleted += completionsByDate.get(dateStr) ?? 0
    const actual = totalSprintTasks - cumulativeCompleted

    burndownData.push({
      date: monthDay,
      ideal,
      actual,
    })
  }

  return {
    sprintName: sprint.name,
    data: burndownData,
  }
}

/**
 * Compute total hours logged from time_logs table.
 * Returns null if no time tracking data exists.
 */
async function computeTotalHoursLogged(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  projectIds: string[]
): Promise<number | null> {
  if (projectIds.length === 0) return null

  try {
    // Get all time logs for tasks in the relevant projects
    const { data: timeLogs, error } = await admin
      .from('time_logs')
      .select('duration, task_id')
      .eq('workspace_id', workspaceId)
      .limit(10000)

    if (error || !timeLogs) return null

    // If filtering by project, we need to filter time logs by tasks in those projects
    // Since time_logs don't have project_id directly, we need to check task's project
    if (projectIds.length > 0) {
      // Get task IDs for the relevant projects
      const { data: projectTasks } = await admin
        .from('tasks')
        .select('id')
        .in('project_id', projectIds)
        .limit(5000)

      const projectTaskIds = new Set(
        (projectTasks ?? []).map((t) => t.id)
      )

      const filteredLogs = timeLogs.filter((log) =>
        projectTaskIds.has(log.task_id)
      )

      if (filteredLogs.length === 0) return null

      const total = filteredLogs.reduce(
        (sum, log) => sum + Number(log.duration),
        0
      )
      return Math.round(total * 100) / 100
    }

    if (timeLogs.length === 0) return null

    const total = timeLogs.reduce(
      (sum, log) => sum + Number(log.duration),
      0
    )
    return Math.round(total * 100) / 100
  } catch {
    // time_logs table might not exist if PROJ-9 isn't deployed
    return null
  }
}
