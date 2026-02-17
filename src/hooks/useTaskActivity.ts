'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  Comment,
  ActivityLog,
  TimelineItem,
  ActivityFilter,
} from '@/types/task'

interface UseTaskActivityOptions {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
}

export function useTaskActivity({
  workspaceId,
  projectId,
  taskId,
}: UseTaskActivityOptions) {
  const [comments, setComments] = useState<Comment[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const basePath =
    workspaceId && projectId && taskId
      ? `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
      : null

  const fetchActivity = useCallback(async () => {
    if (!basePath) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/activity`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to load activity')
        return
      }
      const json = await res.json()
      setComments(json.data?.comments ?? [])
      setActivityLogs(json.data?.activity_logs ?? [])
    } catch {
      setError('Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    if (basePath) {
      fetchActivity()
    } else {
      setComments([])
      setActivityLogs([])
    }
  }, [basePath, fetchActivity])

  // Merge comments and activity into a unified timeline
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    if (filter === 'all' || filter === 'comments') {
      for (const comment of comments) {
        items.push({ type: 'comment', data: comment })
      }
    }

    if (filter === 'all' || filter === 'activity') {
      for (const log of activityLogs) {
        items.push({ type: 'activity', data: log })
      }
    }

    // Sort chronologically (oldest first)
    items.sort(
      (a, b) =>
        new Date(a.data.created_at).getTime() -
        new Date(b.data.created_at).getTime()
    )

    return items
  }, [comments, activityLogs, filter])

  const totalCount = comments.length + activityLogs.length

  // Add a comment
  const addComment = useCallback(
    async (content: string) => {
      if (!basePath) return { data: null, error: 'Missing context' }

      try {
        const res = await fetch(`${basePath}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to add comment' }
        }

        const newComment: Comment = json.data
        setComments((prev) => [...prev, newComment])
        return { data: newComment, error: null }
      } catch {
        return { data: null, error: 'Failed to add comment' }
      }
    },
    [basePath]
  )

  // Edit a comment
  const editComment = useCallback(
    async (commentId: string, content: string) => {
      if (!basePath) return { data: null, error: 'Missing context' }

      try {
        const res = await fetch(`${basePath}/comments/${commentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to edit comment' }
        }

        const updatedComment: Comment = json.data
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? updatedComment : c))
        )
        return { data: updatedComment, error: null }
      } catch {
        return { data: null, error: 'Failed to edit comment' }
      }
    },
    [basePath]
  )

  // Delete a comment (soft-delete)
  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!basePath) return { error: 'Missing context' }

      try {
        const res = await fetch(`${basePath}/comments/${commentId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to delete comment' }
        }

        // Soft-delete: mark the comment as deleted in local state
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, deleted: true, content: '' } : c
          )
        )
        return { error: null }
      } catch {
        return { error: 'Failed to delete comment' }
      }
    },
    [basePath]
  )

  return {
    comments,
    activityLogs,
    timeline,
    totalCount,
    loading,
    error,
    filter,
    setFilter,
    addComment,
    editComment,
    deleteComment,
    refetch: fetchActivity,
  }
}
