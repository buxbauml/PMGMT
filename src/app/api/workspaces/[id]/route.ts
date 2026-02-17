import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateWorkspaceSchema } from '@/lib/validations/workspace'

// GET /api/workspaces/[id] - Get a single workspace
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS will ensure user can only see workspaces they're a member of
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: workspace })
}

// PATCH /api/workspaces/[id] - Update workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const parsed = updateWorkspaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  // RLS ensures only owner can update
  const { data: workspace, error: updateError } = await supabase
    .from('workspaces')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !workspace) {
    return NextResponse.json(
      { error: 'Failed to update workspace. You may not have permission.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ data: workspace })
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership before delete (RLS also enforces this)
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404 }
    )
  }

  if (workspace.owner_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the workspace owner can delete the workspace' },
      { status: 403 }
    )
  }

  // Clear last_active_workspace_id for all members referencing this workspace
  await supabase
    .from('profiles')
    .update({ last_active_workspace_id: null })
    .eq('last_active_workspace_id', id)

  // CASCADE will handle workspace_members and workspace_invitations
  const { error: deleteError } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
