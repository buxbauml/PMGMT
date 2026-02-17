import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateTaskSchema } from '@/lib/validations/task'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'

type TaskParams = Promise<{ id: string; projectId: string; taskId: string }>

// Helper: flatten joined task data for frontend consumption
function enrichTask(task: Record<string, unknown>) {
  const { assignee, creator, completer, ...rest } = task
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
}

// GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId] - Get single task
export async function GET(
  _request: NextRequest,
  { params }: { params: TaskParams }
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

  // Fetch the task with joined profile data
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, email, avatar_url),
      creator:profiles!tasks_created_by_fkey(full_name),
      completer:profiles!tasks_completed_by_fkey(full_name)
    `)
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: enrichTask(task as Record<string, unknown>) })
}

// PATCH /api/workspaces/[id]/projects/[projectId]/tasks/[taskId] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: TaskParams }
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
      { error: 'Cannot modify tasks in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 120 updates per hour per user
  const rateLimit = checkRateLimit(user.id, {
    prefix: 'update-task',
    maxAttempts: 120,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can update more tasks in ${rateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Fetch existing task to compare status changes
  const { data: existingTask } = await supabase
    .from('tasks')
    .select('id, status, assignee_id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!existingTask) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { title, description, assignee_id, sprint_id, status, priority } = parsed.data

  // If assignee_id is provided, verify they are a workspace member
  const cleanAssigneeId = assignee_id === '' ? null : assignee_id
  if (cleanAssigneeId) {
    const { data: assigneeMembership } = await supabase
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

  // If sprint_id is provided (non-empty), verify the sprint exists in this project
  const cleanSprintId = sprint_id === '' ? null : sprint_id
  if (cleanSprintId) {
    const { data: sprint } = await supabase
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

  // Build update data
  const updateData: Record<string, unknown> = {}

  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description || null
  if (cleanAssigneeId !== undefined) updateData.assignee_id = cleanAssigneeId
  if (cleanSprintId !== undefined) updateData.sprint_id = cleanSprintId
  if (status !== undefined) updateData.status = status
  if (priority !== undefined) updateData.priority = priority

  // Handle completion tracking
  if (status !== undefined) {
    if (status === 'done' && existingTask.status !== 'done') {
      // Task is being marked as done - record who and when
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = user.id
    } else if (status !== 'done' && existingTask.status === 'done') {
      // Task is being moved out of done - clear completion info
      updateData.completed_at = null
      updateData.completed_by = null
    }
  }

  // Update the task (RLS ensures workspace membership)
  const { error: updateError } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('project_id', projectId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'update-task')

  // --- PROJ-5: Generate activity logs for tracked changes ---
  const activityEntries: {
    task_id: string
    user_id: string
    activity_type: string
    old_value: string | null
    new_value: string | null
  }[] = []

  // Status change
  if (status !== undefined && status !== existingTask.status) {
    activityEntries.push({
      task_id: taskId,
      user_id: user.id,
      activity_type: status === 'done' ? 'completed' : 'status_changed',
      old_value: existingTask.status,
      new_value: status,
    })
  }

  // Assignee change — resolve UUIDs to display names for activity log readability
  if (cleanAssigneeId !== undefined && cleanAssigneeId !== existingTask.assignee_id) {
    // Look up display names for old and new assignees
    const idsToResolve = [cleanAssigneeId, existingTask.assignee_id].filter(Boolean) as string[]
    const nameMap: Record<string, string> = {}
    if (idsToResolve.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', idsToResolve)
      for (const p of profiles ?? []) {
        nameMap[p.id] = p.full_name || p.id
      }
    }

    const newName = cleanAssigneeId ? (nameMap[cleanAssigneeId] ?? cleanAssigneeId) : null
    const oldName = existingTask.assignee_id ? (nameMap[existingTask.assignee_id] ?? existingTask.assignee_id) : null

    if (cleanAssigneeId && !existingTask.assignee_id) {
      // Newly assigned
      activityEntries.push({
        task_id: taskId,
        user_id: user.id,
        activity_type: 'assigned',
        old_value: null,
        new_value: newName,
      })
    } else if (!cleanAssigneeId && existingTask.assignee_id) {
      // Unassigned
      activityEntries.push({
        task_id: taskId,
        user_id: user.id,
        activity_type: 'unassigned',
        old_value: oldName,
        new_value: null,
      })
    } else {
      // Reassigned (from one person to another)
      activityEntries.push({
        task_id: taskId,
        user_id: user.id,
        activity_type: 'unassigned',
        old_value: oldName,
        new_value: null,
      })
      activityEntries.push({
        task_id: taskId,
        user_id: user.id,
        activity_type: 'assigned',
        old_value: null,
        new_value: newName,
      })
    }
  }

  // Insert activity logs (non-blocking - don't fail the request if logging fails)
  if (activityEntries.length > 0) {
    await supabase.from('activity_logs').insert(activityEntries)
  }

  // Fetch updated task with joined data
  const { data: updatedTask } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, email, avatar_url),
      creator:profiles!tasks_created_by_fkey(full_name),
      completer:profiles!tasks_completed_by_fkey(full_name)
    `)
    .eq('id', taskId)
    .single()

  if (!updatedTask) {
    return NextResponse.json(
      { error: 'Failed to fetch updated task' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: enrichTask(updatedTask as Record<string, unknown>) })
}

// DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId] - Delete task
export async function DELETE(
  _request: NextRequest,
  { params }: { params: TaskParams }
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

  // Verify user is a member of this workspace and check their role
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
      { error: 'Cannot delete tasks in an archived project' },
      { status: 403 }
    )
  }

  // Rate limiting: 60 deletes per hour per user
  const deleteRateLimit = checkRateLimit(user.id, {
    prefix: 'delete-task',
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  })

  if (!deleteRateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can delete more tasks in ${deleteRateLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Fetch the task to check ownership
  const { data: task } = await supabase
    .from('tasks')
    .select('id, created_by')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  // Check delete permission: task creator or workspace admin/owner
  const isCreator = task.created_by === user.id
  const isAdminOrOwner = ['owner', 'admin'].includes(membership.role)

  if (!isCreator && !isAdminOrOwner) {
    return NextResponse.json(
      { error: 'Only the task creator or workspace admins can delete tasks' },
      { status: 403 }
    )
  }

  // Delete the task (RLS also enforces this)
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }

  recordRateLimitAttempt(user.id, 'delete-task')

  return NextResponse.json({ success: true })
}
