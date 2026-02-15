import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

  // Verify user is a member of this workspace (RLS also enforces this)
  const { data: membership } = await supabase
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

  // Get members with profile info
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select(`
      id,
      workspace_id,
      user_id,
      role,
      joined_at,
      last_accessed_at,
      profiles:user_id (
        full_name,
        avatar_url
      )
    `)
    .eq('workspace_id', id)
    .order('joined_at', { ascending: true })
    .limit(100)

  if (membersError) {
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }

  // Get email from auth.users via the user's own session
  // We need to enrich with email - fetch from profiles isn't enough
  // For now, we return what we have. Email will come from a joined query
  // or we fetch user emails separately.

  // Flatten the profiles join
  const enrichedMembers = (members || []).map((member) => {
    const profile = member.profiles as unknown as { full_name: string | null; avatar_url: string | null } | null
    return {
      id: member.id,
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      last_accessed_at: member.last_accessed_at,
      user_name: profile?.full_name || '',
      user_avatar_url: profile?.avatar_url || null,
    }
  })

  return NextResponse.json({ data: enrichedMembers })
}
