import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// POST /api/invitations/[token]/accept - Accept an invitation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch the invitation
  const { data: invitation, error: invError } = await admin
    .from('workspace_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (invError || !invitation) {
    return NextResponse.json(
      { error: 'Invitation not found' },
      { status: 404 }
    )
  }

  // Check expiry
  const now = new Date()
  const expiresAt = new Date(invitation.expires_at)
  if (invitation.status === 'expired' || now > expiresAt) {
    if (invitation.status !== 'expired') {
      await supabase
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
    }
    return NextResponse.json(
      { error: 'This invitation has expired' },
      { status: 410 }
    )
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json(
      { error: 'This invitation has already been accepted' },
      { status: 410 }
    )
  }

  // Verify that the user's email matches the invited email
  if (user.email !== invitation.invited_email) {
    return NextResponse.json(
      {
        error: 'This invitation was sent to a different email address',
        invited_email: invitation.invited_email,
        your_email: user.email,
      },
      { status: 403 }
    )
  }

  // Check if user is already a member
  const { data: existingMember } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invitation.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    // Mark invitation as accepted even if already a member
    await supabase
      .from('workspace_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    return NextResponse.json(
      { error: 'You are already a member of this workspace' },
      { status: 409 }
    )
  }

  // Add user as a member with the invited role
  const { error: memberError } = await admin
    .from('workspace_members')
    .insert({
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      role: invitation.role,
    })

  if (memberError) {
    return NextResponse.json(
      { error: 'Failed to join workspace' },
      { status: 500 }
    )
  }

  // Mark invitation as accepted
  await admin
    .from('workspace_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  // Set as last active workspace
  await admin
    .from('profiles')
    .update({ last_active_workspace_id: invitation.workspace_id })
    .eq('id', user.id)

  return NextResponse.json({
    data: {
      workspace_id: invitation.workspace_id,
      role: invitation.role,
    },
  })
}
