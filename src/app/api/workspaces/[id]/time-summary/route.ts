import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type TimeSummaryParams = Promise<{ id: string }>

// GET /api/workspaces/[id]/time-summary
// Query params: view (personal|team), period (daily|weekly|monthly), date (ISO date string)
export async function GET(
  request: NextRequest,
  { params }: { params: TimeSummaryParams }
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

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'personal'
  const period = searchParams.get('period') || 'weekly'
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const refDate = new Date(dateParam + 'T00:00:00')
  let startDate: string
  let endDate: string

  if (period === 'daily') {
    startDate = dateParam
    endDate = dateParam
  } else if (period === 'weekly') {
    const day = refDate.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(refDate)
    monday.setDate(refDate.getDate() - diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    startDate = monday.toISOString().split('T')[0]
    endDate = sunday.toISOString().split('T')[0]
  } else {
    // monthly
    const firstDay = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    startDate = firstDay.toISOString().split('T')[0]
    endDate = lastDay.toISOString().split('T')[0]
  }

  if (view === 'team') {
    const isAdminOrOwner = ['owner', 'admin'].includes(membership.role)
    if (!isAdminOrOwner) {
      return NextResponse.json(
        { error: 'Only workspace admins can view team time summary' },
        { status: 403 }
      )
    }

    const { data: teamLogs, error: teamError } = await supabase
      .from('time_logs')
      .select(`
        user_id,
        duration,
        task_id,
        author:profiles!time_logs_user_id_fkey(full_name, email, avatar_url)
      `)
      .eq('workspace_id', workspaceId)
      .gte('logged_date', startDate)
      .lte('logged_date', endDate)

    if (teamError) {
      return NextResponse.json(
        { error: 'Failed to load team time summary' },
        { status: 500 }
      )
    }

    const userMap = new Map<
      string,
      {
        user_id: string
        user_name: string | null
        user_email: string | null
        user_avatar_url: string | null
        total_hours: number
        tasks_worked_on: Set<string>
      }
    >()

    for (const log of teamLogs ?? []) {
      const author = (log as Record<string, unknown>).author as Record<string, string> | null

      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, {
          user_id: log.user_id,
          user_name: author?.full_name ?? null,
          user_email: author?.email ?? null,
          user_avatar_url: author?.avatar_url ?? null,
          total_hours: 0,
          tasks_worked_on: new Set(),
        })
      }

      const entry = userMap.get(log.user_id)!
      entry.total_hours += Number(log.duration)
      entry.tasks_worked_on.add(log.task_id)
    }

    const teamSummary = Array.from(userMap.values()).map((entry) => ({
      user_id: entry.user_id,
      user_name: entry.user_name,
      user_email: entry.user_email,
      user_avatar_url: entry.user_avatar_url,
      total_hours: Math.round(entry.total_hours * 100) / 100,
      tasks_worked_on: entry.tasks_worked_on.size,
    }))

    teamSummary.sort((a, b) => b.total_hours - a.total_hours)

    const totalTeamHours = teamSummary.reduce((sum, m) => sum + m.total_hours, 0)

    return NextResponse.json({
      data: teamSummary,
      period: { start: startDate, end: endDate, type: period },
      total_hours: Math.round(totalTeamHours * 100) / 100,
    })
  }

  // Personal view
  const { data: personalLogs, error: personalError } = await supabase
    .from('time_logs')
    .select(`
      *,
      task:tasks!time_logs_task_id_fkey(
        id,
        title,
        project_id,
        project:projects!tasks_project_id_fkey(name)
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .gte('logged_date', startDate)
    .lte('logged_date', endDate)
    .order('logged_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (personalError) {
    return NextResponse.json(
      { error: 'Failed to load personal time summary' },
      { status: 500 }
    )
  }

  const totalHours = (personalLogs ?? []).reduce(
    (sum, log) => sum + Number(log.duration), 0
  )
  const uniqueTasks = new Set((personalLogs ?? []).map((log) => log.task_id))

  const data = (personalLogs ?? []).map((log) => {
    const taskData = (log as Record<string, unknown>).task as Record<string, unknown> | null
    const projectData = taskData?.project as Record<string, string> | null

    return {
      id: log.id,
      task_id: log.task_id,
      workspace_id: log.workspace_id,
      user_id: log.user_id,
      duration: Number(log.duration),
      description: log.description,
      logged_date: log.logged_date,
      created_at: log.created_at,
      updated_at: log.updated_at,
      task_title: (taskData?.title as string) ?? null,
      project_name: projectData?.name ?? null,
      project_id: (taskData?.project_id as string) ?? null,
      is_owner: true,
    }
  })

  return NextResponse.json({
    data,
    period: { start: startDate, end: endDate, type: period },
    total_hours: Math.round(totalHours * 100) / 100,
    tasks_worked_on: uniqueTasks.size,
  })
}
