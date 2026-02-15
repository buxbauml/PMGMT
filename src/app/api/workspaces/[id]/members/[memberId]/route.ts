import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

// PATCH /api/workspaces/[id]/members/[memberId] - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester is owner or admin
  const { data: requesterMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .single()

  if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can update member roles' },
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

  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  // Get target member
  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', id)
    .single()

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Member not found' },
      { status: 404 }
    )
  }

  // Cannot change owner role
  if (targetMember.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot change the owner role' },
      { status: 403 }
    )
  }

  // Admins cannot change other admins
  if (requesterMembership.role === 'admin' && targetMember.role === 'admin') {
    return NextResponse.json(
      { error: 'Admins cannot change the role of other admins' },
      { status: 403 }
    )
  }

  const { error: updateError } = await supabase
    .from('workspace_members')
    .update({ role: parsed.data.role })
    .eq('id', memberId)
    .eq('workspace_id', id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/workspaces/[id]/members/[memberId] - Remove member
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester is owner or admin
  const { data: requesterMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .single()

  if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can remove members' },
      { status: 403 }
    )
  }

  // Get target member
  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', id)
    .single()

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Member not found' },
      { status: 404 }
    )
  }

  // Cannot remove yourself
  if (targetMember.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the workspace' },
      { status: 403 }
    )
  }

  // Cannot remove the owner
  if (targetMember.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot remove the workspace owner' },
      { status: 403 }
    )
  }

  // Admins cannot remove other admins
  if (requesterMembership.role === 'admin' && targetMember.role === 'admin') {
    return NextResponse.json(
      { error: 'Admins cannot remove other admins' },
      { status: 403 }
    )
  }

  // Clear last_active_workspace_id if needed
  await supabase
    .from('profiles')
    .update({ last_active_workspace_id: null })
    .eq('id', targetMember.user_id)
    .eq('last_active_workspace_id', id)

  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', id)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
