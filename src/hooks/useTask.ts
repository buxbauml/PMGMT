'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
} from '@/types/task'

export interface TaskFilters {
  status: TaskStatus | 'all'
  assignee: string | 'all' | 'unassigned'
  priority: TaskPriority | 'all'
}

export function useTask(workspaceId: string | null, projectId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    assignee: 'all',
    priority: 'all',
  })

  const fetchTasks = useCallback(
    async (wsId: string, projId: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${wsId}/projects/${projId}/tasks`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setError(json.error ?? 'Failed to load tasks')
          setLoading(false)
          return
        }
        const json = await res.json()
        setTasks(json.data ?? [])
      } catch {
        setError('Failed to load tasks')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!workspaceId || !projectId) {
      setTasks([])
      return
    }
    fetchTasks(workspaceId, projectId)
  }, [workspaceId, projectId, fetchTasks])

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      if (!workspaceId || !projectId)
        return { data: null, error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to create task' }
        }

        const newTask: Task = json.data
        setTasks((prev) => [newTask, ...prev])
        return { data: newTask, error: null }
      } catch {
        return { data: null, error: 'Failed to create task' }
      }
    },
    [workspaceId, projectId]
  )

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput) => {
      if (!workspaceId || !projectId)
        return { data: null, error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to update task' }
        }

        const updatedTask: Task = json.data
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        )
        return { data: updatedTask, error: null }
      } catch {
        return { data: null, error: 'Failed to update task' }
      }
    },
    [workspaceId, projectId]
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!workspaceId || !projectId)
        return { error: 'Missing workspace or project' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
          { method: 'DELETE' }
        )

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to delete task' }
        }

        setTasks((prev) => prev.filter((t) => t.id !== taskId))
        return { error: null }
      } catch {
        return { error: 'Failed to delete task' }
      }
    },
    [workspaceId, projectId]
  )

  // Apply client-side filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false
      }
      if (filters.assignee === 'unassigned' && task.assignee_id !== null) {
        return false
      }
      if (
        filters.assignee !== 'all' &&
        filters.assignee !== 'unassigned' &&
        task.assignee_id !== filters.assignee
      ) {
        return false
      }
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false
      }
      return true
    })
  }, [tasks, filters])

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.assignee !== 'all' ||
    filters.priority !== 'all'

  const clearFilters = useCallback(() => {
    setFilters({ status: 'all', assignee: 'all', priority: 'all' })
  }, [])

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    error,
    filters,
    setFilters,
    hasActiveFilters,
    clearFilters,
    createTask,
    updateTask,
    deleteTask,
    refetch: () => {
      if (workspaceId && projectId) fetchTasks(workspaceId, projectId)
    },
  }
}
