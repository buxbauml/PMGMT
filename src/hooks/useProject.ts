'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@/types/project'

export function useProject(workspaceId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const fetchProjects = useCallback(async (wsId: string) => {
    setLoading(true)
    try {
      const params = showArchived ? '?include_archived=true' : ''
      const res = await fetch(`/api/workspaces/${wsId}/projects${params}`)
      if (!res.ok) {
        setLoading(false)
        return
      }
      const json = await res.json()
      setProjects(json.data ?? [])
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  // Fetch projects when workspace changes
  useEffect(() => {
    if (!workspaceId) {
      setProjects([])
      return
    }
    fetchProjects(workspaceId)
  }, [workspaceId, fetchProjects])

  // Refetch when showArchived changes
  useEffect(() => {
    if (workspaceId) {
      fetchProjects(workspaceId)
    }
  }, [showArchived, workspaceId, fetchProjects])

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      if (!workspaceId) return { data: null, error: 'No workspace selected' }

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        const json = await res.json()

        if (!res.ok) {
          return { data: null, error: json.error ?? 'Failed to create project' }
        }

        const newProject: Project = {
          ...json.data,
          total_tasks: 0,
          completed_tasks: 0,
        }
        setProjects((prev) => [newProject, ...prev])

        return { data: newProject, error: null }
      } catch {
        return { data: null, error: 'Failed to create project' }
      }
    },
    [workspaceId]
  )

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput) => {
      if (!workspaceId) return { error: 'No workspace selected' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return { error: json.error ?? 'Failed to update project' }
        }

        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, ...json.data } : p
          )
        )

        return { error: null }
      } catch {
        return { error: 'Failed to update project' }
      }
    },
    [workspaceId]
  )

  const archiveProject = useCallback(
    async (projectId: string) => {
      if (!workspaceId) return { error: 'No workspace selected' }

      // Find the current project to get its archived status
      const currentProject = projects.find((p) => p.id === projectId)
      if (!currentProject) return { error: 'Project not found' }

      const newArchivedStatus = !currentProject.archived

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/archive`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: newArchivedStatus }),
          }
        )

        const json = await res.json()

        if (!res.ok) {
          return { error: json.error ?? 'Failed to archive project' }
        }

        // Update project with server response
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, ...json.data } : p
          )
        )

        return { error: null }
      } catch {
        return { error: 'Failed to archive project' }
      }
    },
    [workspaceId, projects]
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!workspaceId) return { error: 'No workspace selected' }

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}`,
          { method: 'DELETE' }
        )

        if (!res.ok) {
          const json = await res.json()
          return { error: json.error ?? 'Failed to delete project' }
        }

        setProjects((prev) => prev.filter((p) => p.id !== projectId))

        return { error: null }
      } catch {
        return { error: 'Failed to delete project' }
      }
    },
    [workspaceId]
  )

  // Filter projects based on archived toggle
  const visibleProjects = showArchived
    ? projects
    : projects.filter((p) => !p.archived)

  return {
    projects: visibleProjects,
    allProjects: projects,
    loading,
    showArchived,
    setShowArchived,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
    refetch: () => workspaceId && fetchProjects(workspaceId),
  }
}
