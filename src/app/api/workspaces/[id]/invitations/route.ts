import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { inviteMembersSchema } from '@/lib/validations/workspace'
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit'
import { sendInvitationEmail } from '@/lib/email'

// GET /api/workspaces/[id]/invitations - List pending invitations
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

  const admin = createAdminClient()

  // RLS ensures only owner/admin can see invitations
  const { data: invitations, error } = await admin
    .from('workspace_invitations')
    .select('*')
    .eq('workspace_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: invitations })
}

// POST /api/workspaces/[id]/invitations - Invite members by email
export async function POST(
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

  const admin = createAdminClient()

  // Rate limiting: max 5 invites per hour
  const hourlyLimit = checkRateLimit(user.id, {
    prefix: 'invite-hourly',
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  })

  if (!hourlyLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. You can send more invitations in ${hourlyLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Rate limiting: max 5 invites per day
  const dailyLimit = checkRateLimit(user.id, {
    prefix: 'invite-daily',
    maxAttempts: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  })

  if (!dailyLimit.allowed) {
    return NextResponse.json(
      {
        error: `Daily rate limit exceeded. You can send more invitations in ${dailyLimit.resetInSeconds} seconds.`,
      },
      { status: 429 }
    )
  }

  // Verify requester is owner or admin
  const { data: requesterMembership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .single()

  if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can invite members' },
      { status: 403 }
    )
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = inviteMembersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const emails = parsed.data.emails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const { role } = parsed.data

  // Check for existing members by email
  // We cannot directly query auth.users, so we check workspace_members + profiles
  // For now, we still create the invitation and let the accept flow handle duplicates

  // Check for existing pending invitations with the same email
  const { data: existingInvitations } = await admin
    .from('workspace_invitations')
    .select('invited_email')
    .eq('workspace_id', id)
    .eq('status', 'pending')
    .in('invited_email', emails)

  const alreadyInvited = new Set(
    (existingInvitations || []).map((inv) => inv.invited_email)
  )

  const newEmails = emails.filter((email) => !alreadyInvited.has(email))

  if (newEmails.length === 0) {
    return NextResponse.json(
      { error: 'All email addresses already have pending invitations' },
      { status: 400 }
    )
  }

  // Create invitations
  const invitationRows = newEmails.map((email) => ({
    workspace_id: id,
    invited_email: email,
    invited_by: user.id,
    role,
  }))

  const { data: invitations, error: insertError } = await admin
    .from('workspace_invitations')
    .insert(invitationRows)
    .select()

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to create invitations' },
      { status: 500 }
    )
  }

  // Record rate limit attempts (one per invite batch, not per email)
  recordRateLimitAttempt(user.id, 'invite-hourly')
  recordRateLimitAttempt(user.id, 'invite-daily')

  // Build invite links for manual sharing
  const origin = request.headers.get('origin') || request.headers.get('host') || ''
  const protocol = origin.startsWith('http') ? '' : 'https://'
  const baseUrl = `${protocol}${origin}`

  const inviteLinks = (invitations || []).map((inv) => ({
    email: inv.invited_email,
    link: `${baseUrl}/invite/${inv.token}`,
    token: inv.token,
  }))

  // Send invitation emails in the background (don't block the response)
  // Fetch workspace name and inviter name for the email
  const { data: workspace } = await admin
    .from('workspaces')
    .select('name')
    .eq('id', id)
    .single()

  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const workspaceName = workspace?.name ?? 'a workspace'
  const inviterName = inviterProfile?.full_name ?? user.email ?? 'Someone'

  // Send emails (fire-and-forget, don't block the API response)
  for (const link of inviteLinks) {
    sendInvitationEmail({
      to: link.email,
      workspaceName,
      inviterName,
      role,
      inviteLink: link.link,
    }).catch((err) => {
      console.error(`[invitations] Failed to send email to ${link.email}:`, err)
    })
  }

  return NextResponse.json(
    {
      data: invitations,
      inviteLinks,
      skipped: Array.from(alreadyInvited),
    },
    { status: 201 }
  )
}
