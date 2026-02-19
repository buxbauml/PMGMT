import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type ExportParams = Promise<{ id: string }>

// GET /api/workspaces/[id]/reports/export?projectId=<optional>
// Admin/owner only - streams CSV file with workspace report data
export async function GET(
  request: NextRequest,
  { params }: { params: ExportParams }
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

  const admin = createAdminClient()

  // 2. Verify workspace membership and admin/owner role
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

  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only workspace admins can export reports' },
      { status: 403 }
    )
  }

  // Rate limiting: 10 exports per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'reports-export',
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

  recordRateLimitAttempt(user.id, 'reports-export')

  // 3. Parse query params
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') || null

  // 4. Get projects
  let projectIds: string[] = []
  if (projectId) {
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
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('archived', false)
      .limit(200)

    projectIds = (projects ?? []).map((p) => p.id)
  }

  try {
    const csvRows: string[] = []
    csvRows.push('metric_name,value,date')

    const today = new Date().toISOString().split('T')[0]

    if (projectIds.length === 0) {
      // Return CSV with just headers and summary zeros
      csvRows.push(`total_tasks,0,${today}`)
      csvRows.push(`completed_tasks,0,${today}`)
      csvRows.push(`in_progress_tasks,0,${today}`)
      csvRows.push(`todo_tasks,0,${today}`)
      csvRows.push(`completion_rate,0,${today}`)

      return buildCsvResponse(csvRows.join('\n'))
    }

    // 5. Fetch all tasks
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, status, assignee_id, completed_at, sprint_id, project_id')
      .in('project_id', projectIds)
      .limit(5000)

    const allTasks = tasks ?? []

    // --- Summary metrics ---
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((t) => t.status === 'done').length
    const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress').length
    const todoTasks = allTasks.filter((t) => t.status === 'to_do').length
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    csvRows.push(`total_tasks,${totalTasks},${today}`)
    csvRows.push(`completed_tasks,${completedTasks},${today}`)
    csvRows.push(`in_progress_tasks,${inProgressTasks},${today}`)
    csvRows.push(`todo_tasks,${todoTasks},${today}`)
    csvRows.push(`completion_rate,${completionRate}%,${today}`)

    // --- Velocity ---
    const { data: completedSprints } = await admin
      .from('sprints')
      .select('id')
      .in('project_id', projectIds)
      .eq('completed', true)
      .order('completed_at', { ascending: false })
      .limit(5)

    if (completedSprints && completedSprints.length > 0) {
      const sprintIds = completedSprints.map((s) => s.id)

      const { data: sprintTasks } = await admin
        .from('tasks')
        .select('sprint_id, status')
        .in('sprint_id', sprintIds)
        .eq('status', 'done')
        .limit(5000)

      const sprintCounts = new Map<string, number>()
      for (const task of sprintTasks ?? []) {
        if (task.sprint_id) {
          sprintCounts.set(
            task.sprint_id,
            (sprintCounts.get(task.sprint_id) ?? 0) + 1
          )
        }
      }

      let total = 0
      for (const sprintId of sprintIds) {
        total += sprintCounts.get(sprintId) ?? 0
      }

      const velocity =
        Math.round((total / sprintIds.length) * 10) / 10
      csvRows.push(`velocity_tasks_per_sprint,${velocity},${today}`)
    }

    // --- Assignee breakdown ---
    const assigneeTaskCounts = new Map<string, number>()
    for (const task of allTasks) {
      if (task.assignee_id) {
        assigneeTaskCounts.set(
          task.assignee_id,
          (assigneeTaskCounts.get(task.assignee_id) ?? 0) + 1
        )
      }
    }

    if (assigneeTaskCounts.size > 0) {
      const assigneeIds = Array.from(assigneeTaskCounts.keys())
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

      for (const [id, count] of assigneeTaskCounts.entries()) {
        const name = escapeCsvValue(profileMap.get(id) ?? 'Unknown')
        csvRows.push(`assignee_tasks_${name},${count},${today}`)
      }
    }

    // --- Completion trend (last 8 weeks) ---
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - i * 7)
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)

      const completedInWeek = allTasks.filter((t) => {
        if (t.status !== 'done' || !t.completed_at) return false
        const completedDate = new Date(t.completed_at)
        return completedDate >= weekStart && completedDate < weekEnd
      }).length

      const weekLabel = weekStart.toISOString().split('T')[0]
      csvRows.push(`weekly_completed,${completedInWeek},${weekLabel}`)
    }

    // --- Total hours logged ---
    try {
      const { data: timeLogs } = await admin
        .from('time_logs')
        .select('duration, task_id')
        .eq('workspace_id', workspaceId)
        .limit(10000)

      if (timeLogs && timeLogs.length > 0) {
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

        if (filteredLogs.length > 0) {
          const totalHours = filteredLogs.reduce(
            (sum, log) => sum + Number(log.duration),
            0
          )
          csvRows.push(
            `total_hours_logged,${Math.round(totalHours * 100) / 100},${today}`
          )
        }
      }
    } catch {
      // time_logs table might not exist
    }

    return buildCsvResponse(csvRows.join('\n'))
  } catch (error) {
    console.error('Reports export error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report export' },
      { status: 500 }
    )
  }
}

/**
 * Escape a value for CSV inclusion (wrap in quotes if it contains commas or quotes).
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Build a CSV response with appropriate headers.
 */
function buildCsvResponse(csvContent: string): NextResponse {
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="report.csv"',
    },
  })
}
