'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  CreateWorkspaceInput,
  InviteMemberInput,
  WorkspaceRole,
} from '@/types/workspace'
import {
  mockWorkspaces,
  mockMembers,
  mockInvitations,
  MOCK_USER_ID,
  MOCK_USER_NAME,
  MOCK_USER_EMAIL,
} from '@/lib/mock-data/workspaces'

// TODO: Replace mock implementation with Supabase API calls in /backend

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    mockWorkspaces[0]?.id ?? null
  )
  const [members, setMembers] =
    useState<Record<string, WorkspaceMember[]>>(mockMembers)
  const [invitations, setInvitations] =
    useState<WorkspaceInvitation[]>(mockInvitations)
  const [loading, setLoading] = useState(false)

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  )

  const activeMembers = useMemo(
    () => (activeWorkspaceId ? members[activeWorkspaceId] ?? [] : []),
    [members, activeWorkspaceId]
  )

  const activeInvitations = useMemo(
    () =>
      invitations.filter((inv) => inv.workspace_id === activeWorkspaceId),
    [invitations, activeWorkspaceId]
  )

  const currentUserRole: WorkspaceRole | null = useMemo(() => {
    if (!activeWorkspaceId) return null
    const member = activeMembers.find((m) => m.user_id === MOCK_USER_ID)
    return member?.role ?? null
  }, [activeMembers, activeWorkspaceId])

  const isOwner = currentUserRole === 'owner'
  const isAdmin = currentUserRole === 'admin'
  const canManageMembers = isOwner || isAdmin

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
  }, [])

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput) => {
      setLoading(true)
      try {
        // Mock: create workspace locally
        const newWorkspace: Workspace = {
          id: `ws-${Date.now()}`,
          name: input.name,
          description: input.description ?? null,
          owner_id: MOCK_USER_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const ownerMember: WorkspaceMember = {
          id: `mem-${Date.now()}`,
          workspace_id: newWorkspace.id,
          user_id: MOCK_USER_ID,
          role: 'owner',
          joined_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          user_name: MOCK_USER_NAME,
          user_email: MOCK_USER_EMAIL,
          user_avatar_url: null,
        }

        setWorkspaces((prev) => [...prev, newWorkspace])
        setMembers((prev) => ({
          ...prev,
          [newWorkspace.id]: [ownerMember],
        }))
        setActiveWorkspaceId(newWorkspace.id)

        return { data: newWorkspace, error: null }
      } catch {
        return { data: null, error: 'Failed to create workspace' }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const updateWorkspace = useCallback(
    async (workspaceId: string, updates: Partial<Pick<Workspace, 'name' | 'description'>>) => {
      setLoading(true)
      try {
        setWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === workspaceId
              ? { ...ws, ...updates, updated_at: new Date().toISOString() }
              : ws
          )
        )
        return { error: null }
      } catch {
        return { error: 'Failed to update workspace' }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      setLoading(true)
      try {
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspaceId))
        setMembers((prev) => {
          const next = { ...prev }
          delete next[workspaceId]
          return next
        })
        setInvitations((prev) =>
          prev.filter((inv) => inv.workspace_id !== workspaceId)
        )

        // Switch to another workspace if deleting the active one
        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId((prev) => {
            const remaining = workspaces.filter((ws) => ws.id !== workspaceId)
            return remaining[0]?.id ?? null
          })
        }

        return { error: null }
      } catch {
        return { error: 'Failed to delete workspace' }
      } finally {
        setLoading(false)
      }
    },
    [activeWorkspaceId, workspaces]
  )

  const inviteMembers = useCallback(
    async (workspaceId: string, input: InviteMemberInput) => {
      setLoading(true)
      try {
        const newInvitations: WorkspaceInvitation[] = input.emails.map(
          (email) => ({
            id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            workspace_id: workspaceId,
            invited_email: email.trim(),
            invited_by: MOCK_USER_ID,
            role: input.role,
            token: Math.random().toString(36).slice(2, 14),
            status: 'pending' as const,
            created_at: new Date().toISOString(),
            expires_at: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            workspace_name:
              workspaces.find((ws) => ws.id === workspaceId)?.name,
            invited_by_name: MOCK_USER_NAME,
          })
        )

        setInvitations((prev) => [...prev, ...newInvitations])
        return { data: newInvitations, error: null }
      } catch {
        return { data: null, error: 'Failed to send invitations' }
      } finally {
        setLoading(false)
      }
    },
    [workspaces]
  )

  const removeMember = useCallback(
    async (workspaceId: string, memberId: string) => {
      setLoading(true)
      try {
        setMembers((prev) => ({
          ...prev,
          [workspaceId]: (prev[workspaceId] ?? []).filter(
            (m) => m.id !== memberId
          ),
        }))
        return { error: null }
      } catch {
        return { error: 'Failed to remove member' }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const updateMemberRole = useCallback(
    async (workspaceId: string, memberId: string, role: WorkspaceRole) => {
      setLoading(true)
      try {
        setMembers((prev) => ({
          ...prev,
          [workspaceId]: (prev[workspaceId] ?? []).map((m) =>
            m.id === memberId ? { ...m, role } : m
          ),
        }))
        return { error: null }
      } catch {
        return { error: 'Failed to update role' }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    // State
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    activeMembers,
    activeInvitations,
    currentUserRole,
    isOwner,
    isAdmin,
    canManageMembers,
    loading,

    // Actions
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMembers,
    removeMember,
    updateMemberRole,
  }
}
