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
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { name, description } = parsed.data

  // Create workspace, add owner as member, and set as last active — all atomically
  const { data: workspaceId, error: rpcError } = await supabase
    .rpc('create_workspace_with_owner', {
      p_name: name,
      p_description: description || null,
      p_owner_id: user.id,
    })

  if (rpcError) {
    console.error('Workspace creation failed:', rpcError)
    return NextResponse.json(
      { error: `Failed to create workspace: ${rpcError.message}` },
      { status: 500 }
    )
  }

  // Fetch the created workspace to return full data
  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (fetchError || !workspace) {
    return NextResponse.json(
      { error: 'Workspace created but failed to fetch details' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: workspace }, { status: 201 })
}
