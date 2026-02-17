'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  Sprint,
  SprintStatus,
  CreateSprintInput,
  UpdateSprintInput,
} from '@/types/sprint'

export type SprintFilter = SprintStatus | 'all'

export function useSprint(
  workspaceId: string | null,
  projectId: string | null
) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SprintFilter>('all')

  const fetchSprints = useCallback(
    async (wsId: string, projId: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${wsId}/projects/${projId}/sprints`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setError(json.error ?? 'Failed to load sprints')
          setLoading(false)
          return
        }
        const json = await res.json()
        setSprints(json.data ?? [])
      } catch {
        setError('Failed to load sprints')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!workspaceId || !projectId) {
      setSprints([])
      return
    }
    fetchSprints(workspaceId, projectId)
  }, [workspaceId, projectId, fetchSprints])

  const createSprint = useCallback(
    async (input: CreateSprintInput) => {
      if (!workspaceId || !projectId)
        return { data: null, error: 'Missing workspace or project', warning: null }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/sprints`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return {
            data: null,
            error: json.error ?? 'Failed to create sprint',
            warning: null,
          }
        }

        const newSprint: Sprint = json.data
        setSprints((prev) => [newSprint, ...prev])
        return { data: newSprint, error: null, warning: json.warning ?? null }
      } catch {
        return { data: null, error: 'Failed to create sprint', warning: null }
      }
    },
    [workspaceId, projectId]
  )

  const updateSprint = useCallback(
    async (sprintId: string, input: UpdateSprintInput) => {
      if (!workspaceId || !projectId)
        return { data: null, error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return {
            data: null,
            error: json.error ?? 'Failed to update sprint',
          }
        }

        const updatedSprint: Sprint = json.data
        setSprints((prev) =>
          prev.map((s) => (s.id === sprintId ? updatedSprint : s))
        )
        return { data: updatedSprint, error: null }
      } catch {
        return { data: null, error: 'Failed to update sprint' }
      }
    },
    [workspaceId, projectId]
  )

  const deleteSprint = useCallback(
    async (sprintId: string) => {
      if (!workspaceId || !projectId)
        return { error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}`,
          { method: 'DELETE' }
        )

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to delete sprint' }
        }

        setSprints((prev) => prev.filter((s) => s.id !== sprintId))
        return { error: null }
      } catch {
        return { error: 'Failed to delete sprint' }
      }
    },
    [workspaceId, projectId]
  )

  const addTasksToSprint = useCallback(
    async (sprintId: string, taskIds: string[]) => {
      if (!workspaceId || !projectId)
        return { error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/tasks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_ids: taskIds }),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return { error: json.error ?? 'Failed to add tasks to sprint' }
        }

        // Refresh sprints to get updated counts
        await fetchSprints(workspaceId, projectId)
        return { error: null }
      } catch {
        return { error: 'Failed to add tasks to sprint' }
      }
    },
    [workspaceId, projectId, fetchSprints]
  )

  const removeTaskFromSprint = useCallback(
    async (sprintId: string, taskId: string) => {
      if (!workspaceId || !projectId)
        return { error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`,
          { method: 'DELETE' }
        )

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to remove task from sprint' }
        }

        // Refresh sprints to get updated counts
        await fetchSprints(workspaceId, projectId)
        return { error: null }
      } catch {
        return { error: 'Failed to remove task from sprint' }
      }
    },
    [workspaceId, projectId, fetchSprints]
  )

  // Apply client-side filter
  const filteredSprints = useMemo(() => {
    if (filter === 'all') return sprints
    return sprints.filter((sprint) => sprint.status === filter)
  }, [sprints, filter])

  return {
    sprints: filteredSprints,
    allSprints: sprints,
    loading,
    error,
    filter,
    setFilter,
    createSprint,
    updateSprint,
    deleteSprint,
    addTasksToSprint,
    removeTaskFromSprint,
    refetch: () => {
      if (workspaceId && projectId) fetchSprints(workspaceId, projectId)
    },
  }
}
