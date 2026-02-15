import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
} from '@/types/workspace'

// Current mock user ID (matches the logged-in user)
export const MOCK_USER_ID = 'user-001'
export const MOCK_USER_EMAIL = 'john@example.com'
export const MOCK_USER_NAME = 'John Doe'

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-001',
    name: 'Acme Product Team',
    description: 'Main product development workspace',
    owner_id: MOCK_USER_ID,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-10T14:30:00Z',
  },
  {
    id: 'ws-002',
    name: 'Side Project Alpha',
    description: null,
    owner_id: 'user-002',
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-14T11:00:00Z',
  },
]

export const mockMembers: Record<string, WorkspaceMember[]> = {
  'ws-001': [
    {
      id: 'mem-001',
      workspace_id: 'ws-001',
      user_id: MOCK_USER_ID,
      role: 'owner',
      joined_at: '2026-01-15T10:00:00Z',
      last_accessed_at: '2026-02-15T08:00:00Z',
      user_name: MOCK_USER_NAME,
      user_email: MOCK_USER_EMAIL,
      user_avatar_url: null,
    },
    {
      id: 'mem-002',
      workspace_id: 'ws-001',
      user_id: 'user-002',
      role: 'admin',
      joined_at: '2026-01-16T14:00:00Z',
      last_accessed_at: '2026-02-14T09:00:00Z',
      user_name: 'Jane Smith',
      user_email: 'jane@example.com',
      user_avatar_url: null,
    },
    {
      id: 'mem-003',
      workspace_id: 'ws-001',
      user_id: 'user-003',
      role: 'member',
      joined_at: '2026-01-20T11:00:00Z',
      last_accessed_at: '2026-02-13T16:00:00Z',
      user_name: 'Mike Johnson',
      user_email: 'mike@example.com',
      user_avatar_url: null,
    },
  ],
  'ws-002': [
    {
      id: 'mem-004',
      workspace_id: 'ws-002',
      user_id: 'user-002',
      role: 'owner',
      joined_at: '2026-02-01T09:00:00Z',
      last_accessed_at: '2026-02-14T11:00:00Z',
      user_name: 'Jane Smith',
      user_email: 'jane@example.com',
      user_avatar_url: null,
    },
    {
      id: 'mem-005',
      workspace_id: 'ws-002',
      user_id: MOCK_USER_ID,
      role: 'member',
      joined_at: '2026-02-05T15:00:00Z',
      last_accessed_at: '2026-02-12T10:00:00Z',
      user_name: MOCK_USER_NAME,
      user_email: MOCK_USER_EMAIL,
      user_avatar_url: null,
    },
  ],
}

export const mockInvitations: WorkspaceInvitation[] = [
  {
    id: 'inv-001',
    workspace_id: 'ws-001',
    invited_email: 'sarah@example.com',
    invited_by: MOCK_USER_ID,
    role: 'member',
    token: 'abc123def456',
    status: 'pending',
    created_at: '2026-02-14T10:00:00Z',
    expires_at: '2026-02-21T10:00:00Z',
    workspace_name: 'Acme Product Team',
    invited_by_name: MOCK_USER_NAME,
  },
]
