'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, LayoutList } from 'lucide-react'

import type { Project } from '@/types/project'
import type { Task, TaskStatus, UpdateTaskInput } from '@/types/task'

import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTask } from '@/hooks/useTask'
import { useSprint } from '@/hooks/useSprint'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

import { KanbanBoard } from '@/components/kanban-board'
import { CreateTaskDialog } from '@/components/create-task-dialog'
import { EditTaskDialog } from '@/components/edit-task-dialog'

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function KanbanBoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const { isAuthenticated, loading: authLoading, signOut, user } = useAuth()
  const {
    workspaces,
    activeWorkspace,
    activeMembers,
    isOwner,
    isAdmin,
    canManageMembers,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMembers,
    removeMember,
    updateMemberRole,
    transferOwnership,
  } = useWorkspace()

  const [project, setProject] = useState<Project | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const editingTaskRef = useRef<Task | null>(null)

  // Keep ref in sync for Realtime callback
  useEffect(() => {
    editingTaskRef.current = editingTask
  }, [editingTask])

  // Fetch project details
  useEffect(() => {
    if (!activeWorkspace) return

    async function fetchProject() {
      setProjectLoading(true)
      setProjectError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${activeWorkspace!.id}/projects/${projectId}`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setProjectError(json.error ?? 'Failed to load project')
          setProjectLoading(false)
          return
        }
        const json = await res.json()
        setProject(json.data)
      } catch {
        setProjectError('Failed to load project')
      } finally {
        setProjectLoading(false)
      }
    }

    fetchProject()
  }, [activeWorkspace, projectId])

  const {
    tasks: filteredTasks,
    allTasks,
    loading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    deleteTask,
    refetch: refetchTasks,
  } = useTask(activeWorkspace?.id ?? null, projectId)

  const {
    allSprints,
  } = useSprint(activeWorkspace?.id ?? null, projectId)

  // Update project task counts when tasks change
  useEffect(() => {
    if (project && allTasks.length >= 0) {
      const totalTasks = allTasks.length
      const completedTasks = allTasks.filter((t) => t.status === 'done').length
      if (
        project.total_tasks !== totalTasks ||
        project.completed_tasks !== completedTasks
      ) {
        setProject((prev) =>
          prev
            ? {
                ...prev,
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
              }
            : null
        )
      }
    }
  }, [allTasks, project])

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`kanban-tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // If a task was deleted and is currently being edited, close the dialog
          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId && editingTaskRef.current?.id === deletedId) {
              setEditingTask(null)
              toast.info('Task was deleted by another user')
            }
          }
          // Refetch all tasks when any change happens
          refetchTasks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, refetchTasks])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [authLoading, isAuthenticated])

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const canDeleteAny = isOwner || isAdmin
  const progressPercent =
    project && project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : 0

  async function handleUpdateTaskStatus(
    taskId: string,
    status: TaskStatus
  ) {
    return updateTask(taskId, { status })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      {workspaces.length > 0 && (
        <AppHeader
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSwitchWorkspace={switchWorkspace}
          onCreateWorkspace={() => setShowCreateDialog(true)}
          onOpenSettings={() => setShowSettings(true)}
          onSignOut={signOut}
        />
      )}

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
          {/* Back button */}
          <div className="mb-6 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to project
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href={`/projects/${projectId}`}>
                <LayoutList className="h-4 w-4" />
                List view
              </Link>
            </Button>
          </div>

          {/* Loading state */}
          {projectLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {projectError && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-destructive">{projectError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                asChild
              >
                <Link href="/">Back to projects</Link>
              </Button>
            </div>
          )}

          {/* Project details + Board */}
          {project && !projectLoading && !projectError && (
            <>
              {/* Page header */}
              <div className="mb-8">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {project.name}
                  </h1>
                  {project.archived && (
                    <Badge variant="secondary">Archived</Badge>
                  )}
                </div>
                {project.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mt-4 max-w-md space-y-1.5">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {project.total_tasks > 0 ? (
                      <>
                        {project.completed_tasks}/{project.total_tasks} tasks
                        {' \u2022 '}
                        {progressPercent}% complete
                      </>
                    ) : (
                      '0 tasks'
                    )}
                  </p>
                </div>
              </div>

              {/* Tasks error */}
              {tasksError && (
                <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tasksError}
                </div>
              )}

              {/* Kanban Board */}
              <KanbanBoard
                tasks={allTasks}
                allTasks={allTasks}
                members={activeMembers}
                sprints={allSprints}
                currentUserId={user?.id}
                isArchived={project.archived}
                loading={tasksLoading}
                onCreateTask={() => setShowCreateTaskDialog(true)}
                onEditTask={setEditingTask}
                onUpdateTaskStatus={handleUpdateTaskStatus}
              />
            </>
          )}
        </div>
      </main>

      {/* Create task dialog */}
      {project && !project.archived && (
        <CreateTaskDialog
          open={showCreateTaskDialog}
          onOpenChange={setShowCreateTaskDialog}
          members={activeMembers}
          onCreateTask={createTask}
        />
      )}

      {/* Edit task dialog */}
      {project && !project.archived && (
        <EditTaskDialog
          open={editingTask !== null}
          onOpenChange={(open) => {
            if (!open) setEditingTask(null)
          }}
          task={editingTask}
          members={activeMembers}
          sprints={allSprints}
          canDelete={
            editingTask
              ? canDeleteAny || editingTask.created_by === user?.id
              : false
          }
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      )}

      {/* Create workspace dialog */}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateWorkspace={async (values) => {
          const result = await createWorkspace(values)
          return { error: result.error }
        }}
      />

      {/* Workspace settings sheet */}
      {activeWorkspace && (
        <WorkspaceSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          workspace={activeWorkspace}
          members={activeMembers}
          isOwner={isOwner}
          canManageMembers={canManageMembers}
          onUpdate={updateWorkspace}
          onDelete={deleteWorkspace}
          onInviteMembers={inviteMembers}
          onRemoveMember={removeMember}
          onUpdateRole={updateMemberRole}
          onTransferOwnership={transferOwnership}
        />
      )}
    </div>
  )
}
