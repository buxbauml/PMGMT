import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type ActivityParams = Promise<{ id: string; projectId: string; taskId: string }>

// GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/activity
// Returns merged comments and activity logs for a task
export async function GET(
  _request: NextRequest,
  { params }: { params: ActivityParams }
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

  // Verify project belongs to workspace
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

  // Verify task belongs to project
  const { data: task } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single()

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  // Fetch comments with user profiles
  // Note: The 'comments' and 'activity_logs' tables will be created by /backend
  // For now, return empty arrays if the tables don't exist yet
  let comments: unknown[] = []
  let activityLogs: unknown[] = []

  try {
    const { data: commentsData } = await supabase
      .from('comments')
      .select(`
        *,
        author:profiles!comments_user_id_fkey(full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (commentsData) {
      // Get current workspace member user IDs to determine is_member
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)

      const memberUserIds = new Set(
        (membersData ?? []).map((m: { user_id: string }) => m.user_id)
      )

      comments = commentsData.map(
        (c: Record<string, unknown>) => {
          const author = c.author as Record<string, string> | null
          return {
            id: c.id,
            task_id: c.task_id,
            user_id: c.user_id,
            content: c.content,
            deleted: c.deleted ?? false,
            created_at: c.created_at,
            updated_at: c.updated_at,
            user_name: author?.full_name ?? null,
            user_email: author?.email ?? null,
            user_avatar_url: author?.avatar_url ?? null,
            is_member: memberUserIds.has(c.user_id as string),
          }
        }
      )
    }
  } catch {
    // Table may not exist yet - return empty array
    comments = []
  }

  try {
    const { data: activityData } = await supabase
      .from('activity_logs')
      .select(`
        *,
        actor:profiles!activity_logs_user_id_fkey(full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (activityData) {
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)

      const memberUserIds = new Set(
        (membersData ?? []).map((m: { user_id: string }) => m.user_id)
      )

      activityLogs = activityData.map(
        (a: Record<string, unknown>) => {
          const actor = a.actor as Record<string, string> | null
          return {
            id: a.id,
            task_id: a.task_id,
            user_id: a.user_id,
            activity_type: a.activity_type,
            old_value: a.old_value ?? null,
            new_value: a.new_value ?? null,
            created_at: a.created_at,
            user_name: actor?.full_name ?? null,
            user_email: actor?.email ?? null,
            user_avatar_url: actor?.avatar_url ?? null,
            is_member: memberUserIds.has(a.user_id as string),
          }
        }
      )
    }
  } catch {
    // Table may not exist yet - return empty array
    activityLogs = []
  }

  return NextResponse.json({
    data: {
      comments,
      activity_logs: activityLogs,
    },
  })
}
