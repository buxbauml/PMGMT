'use client'

import { useState, useCallback, useEffect } from 'react'
import type { TimeLog } from '@/types/task'

interface UseTimeLogOptions {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
}

export function useTimeLog({
  workspaceId,
  projectId,
  taskId,
}: UseTimeLogOptions) {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePath =
    workspaceId && projectId && taskId
      ? `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-logs`
      : null

  const fetchTimeLogs = useCallback(async () => {
    if (!basePath) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(basePath)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to load time logs')
        return
      }
      const json = await res.json()
      setTimeLogs(json.data ?? [])
    } catch {
      setError('Failed to load time logs')
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    if (basePath) {
      fetchTimeLogs()
    } else {
      setTimeLogs([])
    }
  }, [basePath, fetchTimeLogs])

  const createTimeLog = useCallback(
    async (input: {
      duration: number
      description?: string
      logged_date: string
    }) => {
      if (!basePath)
        return { data: null, error: 'Missing workspace or task context' }

      try {
        const res = await fetch(basePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        const json = await res.json()

        if (!res.ok) {
          return {
            data: null,
            error: json.error ?? 'Failed to create time log',
          }
        }

        const newLog: TimeLog = json.data
        setTimeLogs((prev) => [newLog, ...prev])
        return { data: newLog, error: null }
      } catch {
        return { data: null, error: 'Failed to create time log' }
      }
    },
    [basePath]
  )

  const updateTimeLog = useCallback(
    async (
      logId: string,
      input: {
        duration?: number
        description?: string
        logged_date?: string
      }
    ) => {
      if (!basePath)
        return { data: null, error: 'Missing workspace or task context' }

      try {
        const res = await fetch(`${basePath}/${logId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        const json = await res.json()

        if (!res.ok) {
          return {
            data: null,
            error: json.error ?? 'Failed to update time log',
          }
        }

        const updatedLog: TimeLog = json.data
        setTimeLogs((prev) =>
          prev.map((log) => (log.id === logId ? updatedLog : log))
        )
        return { data: updatedLog, error: null }
      } catch {
        return { data: null, error: 'Failed to update time log' }
      }
    },
    [basePath]
  )

  const deleteTimeLog = useCallback(
    async (logId: string) => {
      if (!basePath)
        return { error: 'Missing workspace or task context' }

      try {
        const res = await fetch(`${basePath}/${logId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to delete time log' }
        }

        setTimeLogs((prev) => prev.filter((log) => log.id !== logId))
        return { error: null }
      } catch {
        return { error: 'Failed to delete time log' }
      }
    },
    [basePath]
  )

  // Calculate totals
  const totalLogged = timeLogs.reduce((sum, log) => sum + log.duration, 0)

  return {
    timeLogs,
    totalLogged,
    loading,
    error,
    createTimeLog,
    updateTimeLog,
    deleteTimeLog,
    refetch: fetchTimeLogs,
  }
}
