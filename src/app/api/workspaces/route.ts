import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createWorkspaceSchema } from '@/lib/validations/workspace'

// GET /api/workspaces - List all workspaces for the authenticated user
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspaces where the user is a member
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, last_accessed_at')
    .eq('user_id', user.id)

  if (memberError) {
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const workspaceIds = memberships.map((m) => m.workspace_id)

  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (wsError) {
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }

  // Get last active workspace from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_active_workspace_id')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    data: workspaces,
    lastActiveWorkspaceId: profile?.last_active_workspace_id ?? null,
  })
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createWorkspaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { name, description } = parsed.data

  // Create workspace
  const { data: workspace, error: createError } = await supabase
    .from('workspaces')
    .insert({
      name,
      description: description || null,
      owner_id: user.id,
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    )
  }

  // Add creator as owner member
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    // Rollback workspace creation
    await supabase.from('workspaces').delete().eq('id', workspace.id)
    return NextResponse.json(
      { error: 'Failed to create workspace membership' },
      { status: 500 }
    )
  }

  // Set as last active workspace
  await supabase
    .from('profiles')
    .update({ last_active_workspace_id: workspace.id })
    .eq('id', user.id)

  return NextResponse.json({ data: workspace }, { status: 201 })
}
