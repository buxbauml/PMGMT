export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export interface Workspace {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  last_accessed_at: string
  // Joined user profile data
  user_name: string
  user_email: string
  user_avatar_url: string | null
}

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  invited_email: string
  invited_by: string
  role: Exclude<WorkspaceRole, 'owner'>
  token: string
  status: InvitationStatus
  created_at: string
  expires_at: string
  // Joined data
  workspace_name?: string
  invited_by_name?: string
}

export interface CreateWorkspaceInput {
  name: string
  description?: string
}

export interface InviteMemberInput {
  emails: string[]
  role: Exclude<WorkspaceRole, 'owner'>
}
