import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateTimeLogSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type TimeLogIdParams = Promise<{
  id: string
  projectId: string
  taskId: string
  logId: string
}>

// PATCH /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/[logId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: TimeLogIdParams }
) {
  const { id: workspaceId, projectId, taskId, logId } = await params
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

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { data: timeLog } = await supabase
    .from('time_logs')
    .select('*')
    .eq('id', logId)
    .eq('task_id', taskId)
    .single()

  if (!timeLog) {
    return NextResponse.json({ error: 'Time log not found' }, { status: 404 })
  }

  if (timeLog.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only edit your own time logs' },
      { status: 403 }
    )
  }

  const rateLimit = checkRateLimit(user.id, {
    prefix: 'edit-time-log',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateTimeLogSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.duration !== undefined) updateData.duration = parsed.data.duration
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
  if (parsed.data.logged_date !== undefined) updateData.logged_date = parsed.data.logged_date

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('time_logs')
    .update(updateData)
    .eq('id', logId)
    .eq('task_id', taskId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update time log' }, { status: 500 })
  }

  recordRateLimitAttempt(user.id, 'edit-time-log')

  const { data: updatedLog } = await supabase
    .from('time_logs')
    .select(`
      *,
      author:profiles!time_logs_user_id_fkey(full_name, email, avatar_url)
    `)
    .eq('id', logId)
    .single()

  if (!updatedLog) {
    return NextResponse.json({ error: 'Failed to fetch updated time log' }, { status: 500 })
  }

  const author = (updatedLog as Record<string, unknown>).author as Record<string, string> | null

  return NextResponse.json({
    data: {
      id: updatedLog.id,
      task_id: updatedLog.task_id,
      workspace_id: updatedLog.workspace_id,
      user_id: updatedLog.user_id,
      duration: Number(updatedLog.duration),
      description: updatedLog.description,
      logged_date: updatedLog.logged_date,
      created_at: updatedLog.created_at,
      updated_at: updatedLog.updated_at,
      user_name: author?.full_name ?? null,
      user_email: author?.email ?? null,
      user_avatar_url: author?.avatar_url ?? null,
      is_owner: true,
    },
  })
}

// DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/[logId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: TimeLogIdParams }
) {
  const { id: workspaceId, projectId, taskId, logId } = await params
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

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const rateLimit = checkRateLimit(user.id, {
    prefix: 'delete-time-log',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    )
  }

  const { data: timeLog } = await supabase
    .from('time_logs')
    .select('*')
    .eq('id', logId)
    .eq('task_id', taskId)
    .single()

  if (!timeLog) {
    return NextResponse.json({ error: 'Time log not found' }, { status: 404 })
  }

  if (timeLog.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only delete your own time logs' },
      { status: 403 }
    )
  }

  const { error: deleteError } = await supabase
    .from('time_logs')
    .delete()
    .eq('id', logId)
    .eq('task_id', taskId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete time log' }, { status: 500 })
  }

  recordRateLimitAttempt(user.id, 'delete-time-log')

  return NextResponse.json({ success: true })
}
