import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// POST /api/workspaces/[id]/projects/[projectId]/archive - Archive or unarchive a project
// Body: { archived: true } or { archived: false }
// Only workspace admins and owners can archive/unarchive
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

  // Verify user is a member and check role
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

  // Only admins and owners can archive/unarchive
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only workspace admins and owners can archive or unarchive projects' },
      { status: 403 }
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate archived field
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).archived !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Request body must include "archived" as a boolean value' },
      { status: 400 }
    )
  }

  const archived = (body as Record<string, unknown>).archived as boolean

  // Verify project exists and belongs to this workspace
  const { data: existingProject } = await admin
    .from('projects')
    .select('id, archived')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!existingProject) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  // Update archived status
  const { data: project, error: updateError } = await admin
    .from('projects')
    .update({ archived })
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (updateError || !project) {
    return NextResponse.json(
      { error: 'Failed to update project archive status' },
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
