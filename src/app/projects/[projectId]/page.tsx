'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Kanban, Loader2 } from 'lucide-react'

import type { Project } from '@/types/project'
import type { Task, UpdateTaskInput } from '@/types/task'

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

import { TaskEmptyState } from '@/components/task-empty-state'
import { TaskTable } from '@/components/task-table'
import { CreateTaskDialog } from '@/components/create-task-dialog'
import { EditTaskDialog } from '@/components/edit-task-dialog'

export default function ProjectDetailPage({
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
    filters,
    setFilters,
    hasActiveFilters,
    clearFilters,
    createTask,
    updateTask,
    deleteTask,
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

  async function handleQuickStatusChange(
    taskId: string,
    status: UpdateTaskInput['status']
  ) {
    return updateTask(taskId, { status: status! })
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
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to projects
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

          {/* Project details */}
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

                {/* Sprint & Board links */}
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href={`/projects/${projectId}/sprints`}>
                      <CalendarDays className="h-4 w-4" />
                      Sprints
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href={`/projects/${projectId}/board`}>
                      <Kanban className="h-4 w-4" />
                      Board
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Tasks error */}
              {tasksError && (
                <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tasksError}
                </div>
              )}

              {/* Task section */}
              {!tasksLoading && allTasks.length === 0 ? (
                <TaskEmptyState
                  onCreateTask={() => setShowCreateTaskDialog(true)}
                  isArchived={project.archived}
                />
              ) : (
                <TaskTable
                  tasks={filteredTasks}
                  allTasks={allTasks}
                  members={activeMembers}
                  currentUserId={user?.id}
                  canDeleteAny={canDeleteAny}
                  isArchived={project.archived}
                  loading={tasksLoading}
                  filters={filters}
                  hasActiveFilters={hasActiveFilters}
                  onSetFilters={setFilters}
                  onClearFilters={clearFilters}
                  onCreateTask={() => setShowCreateTaskDialog(true)}
                  onEditTask={setEditingTask}
                  onDeleteTask={deleteTask}
                  onQuickStatusChange={handleQuickStatusChange}
                />
              )}
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
          workspaceId={activeWorkspace?.id ?? null}
          projectId={projectId}
          currentUserId={user?.id}
          isAdmin={isOwner || isAdmin}
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
