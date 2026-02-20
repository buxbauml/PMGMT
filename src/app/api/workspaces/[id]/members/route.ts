import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// GET /api/workspaces/[id]/members - List workspace members
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

  // Verify user is a member of this workspace
  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this workspace' },
      { status: 403 }
    )
  }

  // Get workspace members
  const { data: members, error: membersError } = await admin
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, joined_at, last_accessed_at')
    .eq('workspace_id', id)
    .order('joined_at', { ascending: true })
    .limit(100)

  if (membersError) {
    console.error('Members fetch error:', membersError.message)
    return NextResponse.json(
      { error: `Failed to fetch members: ${membersError.message}` },
      { status: 500 }
    )
  }

  // Fetch profiles separately to avoid FK join issues
  const userIds = (members ?? []).map((m) => m.user_id)
  const profileMap = new Map<string, { email: string; full_name: string; avatar_url: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .in('id', userIds)
      .limit(100)

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, {
        email: profile.email || '',
        full_name: profile.full_name || '',
        avatar_url: profile.avatar_url || null,
      })
    }
  }

  // Combine members with profile data
  const enrichedMembers = (members ?? []).map((member) => {
    const profile = profileMap.get(member.user_id)
    return {
      id: member.id,
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      last_accessed_at: member.last_accessed_at,
      user_name: profile?.full_name || '',
      user_email: profile?.email || '',
      user_avatar_url: profile?.avatar_url || null,
    }
  })

  return NextResponse.json({ data: enrichedMembers })
}
