'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type {
  Workspace,
  WorkspaceMember,
  CreateWorkspaceInput,
  InviteMemberInput,
  WorkspaceRole,
} from '@/types/workspace'

export function useWorkspace() {
  const { user, isAuthenticated } = useAuth()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [members, setMembers] = useState<Record<string, WorkspaceMember[]>>({})
  const [loading, setLoading] = useState(true)

  // Fetch workspaces on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    fetchWorkspaces()
  }, [isAuthenticated])

  // Fetch members when active workspace changes
  useEffect(() => {
    if (activeWorkspaceId && !members[activeWorkspaceId]) {
      fetchMembers(activeWorkspaceId)
    }
  }, [activeWorkspaceId])

  async function fetchWorkspaces() {
    try {
      const res = await fetch('/api/workspaces')
      if (!res.ok) {
        setLoading(false)
        return
      }
      const json = await res.json()
      const data: Workspace[] = json.data ?? []
      const lastActiveId: string | null = json.lastActiveWorkspaceId ?? null

      setWorkspaces(data)

      // Set active workspace: last active or first one
      if (lastActiveId && data.some((ws) => ws.id === lastActiveId)) {
        setActiveWorkspaceId(lastActiveId)
      } else if (data.length > 0) {
        setActiveWorkspaceId(data[0].id)
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }

  async function fetchMembers(workspaceId: string) {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`)
      if (!res.ok) return
      const json = await res.json()
      setMembers((prev) => ({
        ...prev,
        [workspaceId]: json.data ?? [],
      }))
    } catch {
      // fail silently
    }
  }

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  )

  const activeMembers = useMemo(
    () => (activeWorkspaceId ? members[activeWorkspaceId] ?? [] : []),
    [members, activeWorkspaceId]
  )

  const currentUserRole: WorkspaceRole | null = useMemo(() => {
    if (!activeWorkspaceId || !user) return null
    const member = activeMembers.find((m) => m.user_id === user.id)
    return member?.role ?? null
  }, [activeMembers, activeWorkspaceId, user])

  const isOwner = currentUserRole === 'owner'
  const isAdmin = currentUserRole === 'admin'
  const canManageMembers = isOwner || isAdmin

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      setActiveWorkspaceId(workspaceId)
      // Update last active workspace on the server
      try {
        await fetch('/api/profiles/last-workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        })
      } catch {
        // non-critical, fail silently
      }
    },
    []
  )

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput) => {
      try {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to create workspace' }
        }

        const newWorkspace: Workspace = json.data
        setWorkspaces((prev) => [newWorkspace, ...prev])
        setActiveWorkspaceId(newWorkspace.id)

        return { data: newWorkspace, error: null }
      } catch {
        return { data: null, error: 'Failed to create workspace' }
      }
    },
    []
  )

  const updateWorkspace = useCallback(
    async (workspaceId: string, updates: Partial<Pick<Workspace, 'name' | 'description'>>) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        const json = await res.json()

        if (!res.ok) {
          return { error: json.error ?? 'Failed to update workspace' }
        }

        const updatedWs: Workspace = json.data
        setWorkspaces((prev) =>
          prev.map((ws) => (ws.id === workspaceId ? updatedWs : ws))
        )

        return { error: null }
      } catch {
        return { error: 'Failed to update workspace' }
      }
    },
    []
  )

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const json = await res.json()
          return { error: json.error ?? 'Failed to delete workspace' }
        }

        setWorkspaces((prev) => {
          const remaining = prev.filter((ws) => ws.id !== workspaceId)
          // If we deleted the active workspace, switch to another
          if (activeWorkspaceId === workspaceId) {
            setActiveWorkspaceId(remaining[0]?.id ?? null)
          }
          return remaining
        })
        setMembers((prev) => {
          const next = { ...prev }
          delete next[workspaceId]
          return next
        })

        return { error: null }
      } catch {
        return { error: 'Failed to delete workspace' }
      }
    },
    [activeWorkspaceId]
  )

  const inviteMembers = useCallback(
    async (workspaceId: string, input: InviteMemberInput) => {
      try {
        // The API expects a comma-separated string of emails
        const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails: input.emails.join(', '),
            role: input.role,
          }),
        })

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to send invitations', inviteLinks: [] }
        }

        return {
          data: json.data,
          error: null,
          inviteLinks: json.inviteLinks ?? [],
        }
      } catch {
        return { data: null, error: 'Failed to send invitations', inviteLinks: [] }
      }
    },
    []
  )

  const removeMember = useCallback(
    async (workspaceId: string, memberId: string) => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/members/${memberId}`,
          { method: 'DELETE' }
        )

        if (!res.ok) {
          const json = await res.json()
          return { error: json.error ?? 'Failed to remove member', unassignedTasks: 0 }
        }

        const json = await res.json()

        setMembers((prev) => ({
          ...prev,
          [workspaceId]: (prev[workspaceId] ?? []).filter(
            (m) => m.id !== memberId
          ),
        }))

        return { error: null, unassignedTasks: json.unassigned_tasks ?? 0 }
      } catch {
        return { error: 'Failed to remove member', unassignedTasks: 0 }
      }
    },
    []
  )

  const updateMemberRole = useCallback(
    async (workspaceId: string, memberId: string, role: WorkspaceRole) => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/members/${memberId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          }
        )

        if (!res.ok) {
          const json = await res.json()
          return { error: json.error ?? 'Failed to update role' }
        }

        setMembers((prev) => ({
          ...prev,
          [workspaceId]: (prev[workspaceId] ?? []).map((m) =>
            m.id === memberId ? { ...m, role } : m
          ),
        }))

        return { error: null }
      } catch {
        return { error: 'Failed to update role' }
      }
    },
    []
  )

  const transferOwnership = useCallback(
    async (workspaceId: string, newOwnerId: string) => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/transfer-ownership`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_owner_id: newOwnerId }),
          }
        )

        if (!res.ok) {
          const json = await res.json()
          return { error: json.error ?? 'Failed to transfer ownership' }
        }

        // Refresh workspaces and members to reflect the change
        await fetchWorkspaces()
        await fetchMembers(workspaceId)

        return { error: null }
      } catch {
        return { error: 'Failed to transfer ownership' }
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
    transferOwnership,
  }
}
