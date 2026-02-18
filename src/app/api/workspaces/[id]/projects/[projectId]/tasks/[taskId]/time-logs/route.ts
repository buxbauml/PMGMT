import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { createTimeLogSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type TimeLogParams = Promise<{
  id: string
  projectId: string
  taskId: string
}>

// GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs
export async function GET(
  _request: NextRequest,
  { params }: { params: TimeLogParams }
) {
  const { id: workspaceId, projectId, taskId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const rateLimit = checkRateLimit(user.id, {
    prefix: 'read-time-logs',
    maxAttempts: 120,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

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

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: task } = await admin
    .from('tasks')
    .select('id, estimated_hours')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { data: timeLogs, error: fetchError } = await admin
    .from('time_logs')
    .select(`
      *,
      author:profiles!time_logs_user_id_fkey(full_name, email, avatar_url)
    `)
    .eq('task_id', taskId)
    .eq('workspace_id', workspaceId)
    .order('logged_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to load time logs' }, { status: 500 })
  }

  const totalLogged = (timeLogs ?? []).reduce(
    (sum, log) => sum + Number(log.duration), 0
  )

  const data = (timeLogs ?? []).map((log) => {
    const author = (log as Record<string, unknown>).author as Record<string, string> | null
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
      user_name: author?.full_name ?? null,
      user_email: author?.email ?? null,
      user_avatar_url: author?.avatar_url ?? null,
      is_owner: log.user_id === user.id,
    }
  })

  recordRateLimitAttempt(user.id, 'read-time-logs')

  return NextResponse.json({
    data,
    estimated_hours: task.estimated_hours ? Number(task.estimated_hours) : null,
    total_logged: totalLogged,
  })
}

// POST /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs
export async function POST(
  request: NextRequest,
  { params }: { params: TimeLogParams }
) {
  const { id: workspaceId, projectId, taskId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

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

  const { data: project } = await admin
    .from('projects')
    .select('id, archived')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (project.archived) {
    return NextResponse.json(
      { error: 'Cannot log time on tasks in an archived project' },
      { status: 403 }
    )
  }

  const { data: task } = await admin
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const rateLimit = checkRateLimit(user.id, {
    prefix: 'create-time-log',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. You can log more time in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTimeLogSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { duration, description, logged_date } = parsed.data

  const { data: newLog, error: insertError } = await admin
    .from('time_logs')
    .insert({
      task_id: taskId,
      workspace_id: workspaceId,
      user_id: user.id,
      duration,
      description: description || null,
      logged_date,
    })
    .select(`
      *,
      author:profiles!time_logs_user_id_fkey(full_name, email, avatar_url)
    `)
    .single()

  if (insertError || !newLog) {
    return NextResponse.json({ error: 'Failed to create time log' }, { status: 500 })
  }

  recordRateLimitAttempt(user.id, 'create-time-log')

  const author = (newLog as Record<string, unknown>).author as Record<string, string> | null

  return NextResponse.json(
    {
      data: {
        id: newLog.id,
        task_id: newLog.task_id,
        workspace_id: newLog.workspace_id,
        user_id: newLog.user_id,
        duration: Number(newLog.duration),
        description: newLog.description,
        logged_date: newLog.logged_date,
        created_at: newLog.created_at,
        updated_at: newLog.updated_at,
        user_name: author?.full_name ?? null,
        user_email: author?.email ?? null,
        user_avatar_url: author?.avatar_url ?? null,
        is_owner: true,
      },
    },
    { status: 201 }
  )
}
