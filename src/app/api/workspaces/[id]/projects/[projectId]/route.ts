import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateProjectSchema } from '@/lib/validations/project'

// GET /api/workspaces/[id]/projects/[projectId] - Get a single project
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

  // Fetch project (RLS also enforces membership)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  // Fetch task counts for progress calculation
  let taskCount = 0
  let completedTaskCount = 0

  try {
    const { count: totalCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    const { count: completedCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'done')

    taskCount = totalCount ?? 0
    completedTaskCount = completedCount ?? 0
  } catch {
    // Tasks table may not exist yet
  }

  return NextResponse.json({
    data: {
      ...project,
      total_tasks: taskCount,
      completed_tasks: completedTaskCount,
      progress: taskCount > 0
        ? Math.round((completedTaskCount / taskCount) * 100)
        : 0,
    },
  })
}

// PATCH /api/workspaces/[id]/projects/[projectId] - Update project
export async function PATCH(
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
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!existingProject) {
    return NextResponse.json(
      { error: 'Project not found' },
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

  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { name, description, start_date, end_date } = parsed.data

  // Update project
  const { data: project, error: updateError } = await supabase
    .from('projects')
    .update({
      name,
      description: description || null,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (updateError || !project) {
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }

  // Fetch task counts for progress calculation (same as GET handler)
  let taskCount = 0
  let completedTaskCount = 0

  try {
    const { count: totalCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    const { count: completedCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'done')

    taskCount = totalCount ?? 0
    completedTaskCount = completedCount ?? 0
  } catch {
    // Tasks table may not exist yet
  }

  return NextResponse.json({
    data: {
      ...project,
      total_tasks: taskCount,
      completed_tasks: completedTaskCount,
      progress: taskCount > 0
        ? Math.round((completedTaskCount / taskCount) * 100)
        : 0,
    },
  })
}

// DELETE /api/workspaces/[id]/projects/[projectId] - Delete project (only if 0 tasks)
export async function DELETE(
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
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!existingProject) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  // Check if project has tasks - only allow deletion if 0 tasks
  let hasTasksTable = true
  try {
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (countError) {
      // If we get a relation error, the tasks table doesn't exist yet
      if (countError.message?.includes('relation') || countError.code === '42P01') {
        hasTasksTable = false
      } else {
        return NextResponse.json(
          { error: 'Failed to check project tasks' },
          { status: 500 }
        )
      }
    }

    if (hasTasksTable && count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a project that has tasks. Archive it instead.' },
        { status: 409 }
      )
    }
  } catch {
    // Tasks table doesn't exist yet, project has 0 tasks by default
  }

  // Delete project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
