import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// GET /api/invitations/[token] - Get invitation details (for the invite accept page)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  // Invitation info is semi-public (anyone with the token can view basic details)
  // But we use RLS + direct query for security

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Query the invitation with workspace info
  const { data: invitation, error } = await admin
    .from('workspace_invitations')
    .select(`
      id,
      workspace_id,
      invited_email,
      role,
      token,
      status,
      created_at,
      expires_at,
      invited_by,
      workspaces:workspace_id (
        name
      ),
      profiles:invited_by (
        full_name
      )
    `)
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return NextResponse.json(
      { error: 'Invitation not found' },
      { status: 404 }
    )
  }

  // Check if expired
  const now = new Date()
  const expiresAt = new Date(invitation.expires_at)
  if (invitation.status === 'expired' || now > expiresAt) {
    // Mark as expired if not already
    if (invitation.status !== 'expired') {
      await admin
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

  const workspace = invitation.workspaces as unknown as { name: string } | null
  const inviterProfile = invitation.profiles as unknown as { full_name: string | null } | null

  // Check if user is already a member
  let alreadyMember = false
  if (user) {
    const { data: existingMember } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', user.id)
      .single()

    alreadyMember = !!existingMember
  }

  return NextResponse.json({
    data: {
      id: invitation.id,
      workspace_id: invitation.workspace_id,
      workspace_name: workspace?.name ?? 'Unknown Workspace',
      invited_by_name: inviterProfile?.full_name ?? 'Unknown',
      invited_email: invitation.invited_email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expires_at,
      already_member: alreadyMember,
    },
  })
}
