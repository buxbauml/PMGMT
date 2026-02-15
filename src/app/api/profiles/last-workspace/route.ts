import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

const updateLastWorkspaceSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
})

// PATCH /api/profiles/last-workspace - Update last active workspace
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateLastWorkspaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  // Verify user is a member of the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', parsed.data.workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this workspace' },
      { status: 403 }
    )
  }

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ last_active_workspace_id: parsed.data.workspaceId })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update last active workspace' },
      { status: 500 }
    )
  }

  // Also update last_accessed_at on the membership
  await supabase
    .from('workspace_members')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('workspace_id', parsed.data.workspaceId)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
