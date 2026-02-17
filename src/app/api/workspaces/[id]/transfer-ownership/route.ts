import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

const transferOwnershipSchema = z.object({
  new_owner_id: z.string().uuid(),
})

// POST /api/workspaces/[id]/transfer-ownership - Transfer workspace ownership
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  // Parse request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validation = transferOwnershipSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: validation.error.issues },
      { status: 400 }
    )
  }

  const { new_owner_id } = validation.data

  // Cannot transfer to yourself
  if (new_owner_id === user.id) {
    return NextResponse.json(
      { error: 'You are already the owner' },
      { status: 400 }
    )
  }

  // Fetch workspace and verify current user is the owner
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  if (workspace.owner_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the workspace owner can transfer ownership' },
      { status: 403 }
    )
  }

  // Verify new owner is a member of the workspace
  const { data: newOwnerMembership, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', new_owner_id)
    .single()

  if (memberError || !newOwnerMembership) {
    return NextResponse.json(
      { error: 'The new owner must be a member of the workspace' },
      { status: 400 }
    )
  }

  // Perform the ownership transfer in a transaction-like manner
  // 1. Update the workspace owner
  const { error: updateWorkspaceError } = await supabase
    .from('workspaces')
    .update({ owner_id: new_owner_id })
    .eq('id', workspaceId)

  if (updateWorkspaceError) {
    return NextResponse.json(
      { error: 'Failed to update workspace owner' },
      { status: 500 }
    )
  }

  // 2. Update the new owner's role to 'owner'
  const { error: updateNewOwnerError } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', new_owner_id)

  if (updateNewOwnerError) {
    // Rollback workspace update
    await supabase
      .from('workspaces')
      .update({ owner_id: user.id })
      .eq('id', workspaceId)

    return NextResponse.json(
      { error: 'Failed to update new owner role' },
      { status: 500 }
    )
  }

  // 3. Downgrade the old owner to 'admin' role
  const { error: updateOldOwnerError } = await supabase
    .from('workspace_members')
    .update({ role: 'admin' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)

  if (updateOldOwnerError) {
    // Rollback both previous updates
    await supabase
      .from('workspaces')
      .update({ owner_id: user.id })
      .eq('id', workspaceId)

    await supabase
      .from('workspace_members')
      .update({ role: newOwnerMembership.role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', new_owner_id)

    return NextResponse.json(
      { error: 'Failed to update old owner role' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      workspace_id: workspaceId,
      old_owner_id: user.id,
      new_owner_id,
    },
  })
}
