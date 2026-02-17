'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Timer,
  Trash2,
  RotateCcw,
  ArrowRightLeft,
  X,
} from 'lucide-react'

import type { Sprint, UpdateSprintInput } from '@/types/sprint'
import { getDaysRemaining } from '@/types/sprint'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'

import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { SprintStatusBadge, DaysRemainingBadge } from '@/components/sprint-card'
import { EditSprintDialog } from '@/components/edit-sprint-dialog'
import { AddTasksToSprintDialog } from '@/components/add-tasks-to-sprint-dialog'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function PriorityIcon({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case 'high':
      return <ArrowUp className="h-4 w-4 text-red-500" />
    case 'medium':
      return <ArrowRight className="h-4 w-4 text-yellow-500" />
    case 'low':
      return <ArrowDown className="h-4 w-4 text-gray-400" />
  }
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'in_progress':
      return <Timer className="h-4 w-4 text-blue-500" />
    case 'to_do':
      return <Circle className="h-4 w-4 text-gray-400" />
  }
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variants: Record<TaskStatus, string> = {
    to_do: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    in_progress:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status]}`}
    >
      <StatusIcon status={status} />
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sprintId: string }>
}) {
  const { projectId, sprintId } = use(params)
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

  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [sprintTasks, setSprintTasks] = useState<Task[]>([])
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([])
  const [otherSprints, setOtherSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showEditSprintDialog, setShowEditSprintDialog] = useState(false)
  const [showAddTasksDialog, setShowAddTasksDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [removeTaskId, setRemoveTaskId] = useState<string | null>(null)
  const [removeTaskTitle, setRemoveTaskTitle] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const canManageSprints = isOwner || isAdmin

  // Fetch sprint detail
  const fetchSprintDetail = useCallback(async () => {
    if (!activeWorkspace) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${sprintId}`
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to load sprint')
        setLoading(false)
        return
      }
      const json = await res.json()
      setSprint(json.data)
      setSprintTasks(json.tasks ?? [])
    } catch {
      setError('Failed to load sprint')
    } finally {
      setLoading(false)
    }
  }, [activeWorkspace, projectId, sprintId])

  useEffect(() => {
    fetchSprintDetail()
  }, [fetchSprintDetail])

  // Fetch other sprints in this project (for "Move to Sprint" action)
  const fetchOtherSprints = useCallback(async () => {
    if (!activeWorkspace) return
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints`
      )
      if (!res.ok) return
      const json = await res.json()
      const all: Sprint[] = json.data ?? []
      setOtherSprints(all.filter((s) => s.id !== sprintId && s.status !== 'completed'))
    } catch {
      // fail silently
    }
  }, [activeWorkspace, projectId, sprintId])

  useEffect(() => {
    fetchOtherSprints()
  }, [fetchOtherSprints])

  async function handleMoveToSprint(taskId: string, targetSprintId: string) {
    if (!activeWorkspace) return
    setActionError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${targetSprintId}/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_ids: [taskId] }),
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setActionError(json.error ?? 'Failed to move task to sprint')
        return
      }
      // Refresh
      await fetchSprintDetail()
      await fetchOtherSprints()
    } catch {
      setActionError('Failed to move task to sprint')
    }
  }

  // Fetch backlog tasks (tasks not assigned to any sprint) for add-tasks dialog
  const fetchBacklogTasks = useCallback(async () => {
    if (!activeWorkspace) return
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/tasks`
      )
      if (!res.ok) return
      const json = await res.json()
      const allTasks: Task[] = json.data ?? []
      // Filter to only tasks with no sprint_id
      setBacklogTasks(
        allTasks.filter(
          (t) => !(t as Task & { sprint_id?: string | null }).sprint_id
        )
      )
    } catch {
      // fail silently
    }
  }, [activeWorkspace, projectId])

  useEffect(() => {
    fetchBacklogTasks()
  }, [fetchBacklogTasks])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [authLoading, isAuthenticated])

  // Sprint actions
  async function handleUpdateSprint(
    sprintIdToUpdate: string,
    input: UpdateSprintInput
  ) {
    if (!activeWorkspace)
      return { data: null, error: 'No workspace' }

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${sprintIdToUpdate}`,
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
      setSprint(json.data)
      return { data: json.data, error: null }
    } catch {
      return { data: null, error: 'Failed to update sprint' }
    }
  }

  async function handleMarkComplete() {
    setIsCompleting(true)
    try {
      const result = await handleUpdateSprint(sprintId, { completed: true })
      if (!result.error) {
        await fetchSprintDetail()
      } else {
        setActionError(result.error)
      }
    } finally {
      setIsCompleting(false)
      setShowCompleteConfirm(false)
    }
  }

  async function handleReopenSprint() {
    setActionError(null)
    const result = await handleUpdateSprint(sprintId, { completed: false })
    if (!result.error) {
      await fetchSprintDetail()
    } else {
      setActionError(result.error)
    }
  }

  async function handleDeleteSprint() {
    if (!activeWorkspace) return
    setIsDeleting(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${sprintId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        window.location.href = `/projects/${projectId}/sprints`
      } else {
        const json = await res.json().catch(() => ({}))
        setActionError(json.error ?? 'Failed to delete sprint')
        setShowDeleteConfirm(false)
      }
    } catch {
      setActionError('Failed to delete sprint')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleAddTasks(taskIds: string[]) {
    if (!activeWorkspace) return { error: 'No workspace' }

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${sprintId}/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_ids: taskIds }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        return { error: json.error ?? 'Failed to add tasks' }
      }
      // Refresh sprint detail and backlog
      await fetchSprintDetail()
      await fetchBacklogTasks()
      return { error: null }
    } catch {
      return { error: 'Failed to add tasks' }
    }
  }

  async function handleRemoveTask() {
    if (!activeWorkspace || !removeTaskId) return
    setIsRemoving(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/sprints/${sprintId}/tasks/${removeTaskId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setRemoveTaskId(null)
        await fetchSprintDetail()
        await fetchBacklogTasks()
      } else {
        const json = await res.json().catch(() => ({}))
        setActionError(json.error ?? 'Failed to remove task from sprint')
        setRemoveTaskId(null)
      }
    } catch {
      setActionError('Failed to remove task from sprint')
      setRemoveTaskId(null)
    } finally {
      setIsRemoving(false)
    }
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const progressPercent =
    sprint && sprint.total_tasks > 0
      ? Math.round((sprint.completed_tasks / sprint.total_tasks) * 100)
      : 0

  const daysRemaining = sprint ? getDaysRemaining(sprint.end_date) : 0

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
              <Link href={`/projects/${projectId}/sprints`}>
                <ArrowLeft className="h-4 w-4" />
                Back to sprints
              </Link>
            </Button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="mt-6 grid grid-cols-4 gap-4">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
              <Skeleton className="mt-6 h-64 w-full rounded-lg" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href={`/projects/${projectId}/sprints`}>
                  Back to sprints
                </Link>
              </Button>
            </div>
          )}

          {/* Sprint detail */}
          {sprint && !loading && !error && (
            <>
              {/* Sprint header */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold tracking-tight truncate">
                        {sprint.name}
                      </h1>
                      <SprintStatusBadge status={sprint.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {format(new Date(sprint.start_date), 'MMM d, yyyy')}{' '}
                      &mdash;{' '}
                      {format(new Date(sprint.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>

                  {/* Actions dropdown (admin only) */}
                  {canManageSprints && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="mr-1.5 h-4 w-4" />
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setShowEditSprintDialog(true)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit sprint
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(sprint.status === 'active' ||
                          sprint.status === 'overdue') && (
                          <DropdownMenuItem onClick={() => setShowCompleteConfirm(true)}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                            Mark as complete
                          </DropdownMenuItem>
                        )}
                        {sprint.status === 'completed' && (
                          <DropdownMenuItem onClick={handleReopenSprint}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reopen sprint
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete sprint
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Sprint stats row */}
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* Progress */}
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Progress
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={progressPercent}
                      className="h-2 flex-1"
                    />
                    <span className="text-sm font-semibold">
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Days remaining */}
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {sprint.status === 'completed'
                      ? 'Completed'
                      : daysRemaining < 0
                        ? 'Overdue'
                        : 'Days remaining'}
                  </p>
                  <div className="mt-1">
                    {sprint.status === 'completed' ? (
                      <p className="text-lg font-semibold text-green-600">
                        {sprint.completed_at
                          ? format(
                              new Date(sprint.completed_at),
                              'MMM d, yyyy'
                            )
                          : 'Done'}
                      </p>
                    ) : (
                      <DaysRemainingBadge endDate={sprint.end_date} />
                    )}
                  </div>
                </div>

                {/* Task count */}
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tasks
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {sprint.completed_tasks}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {sprint.total_tasks}
                    </span>
                  </p>
                </div>

                {/* Quick stats */}
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Breakdown
                  </p>
                  <div className="mt-1 flex gap-2 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Circle className="h-3 w-3 text-gray-400" />
                      {sprint.todo_tasks}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3 text-blue-500" />
                      {sprint.in_progress_tasks}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {sprint.completed_tasks}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggest marking complete if all tasks done */}
              {canManageSprints &&
                sprint.status !== 'completed' &&
                sprint.total_tasks > 0 &&
                sprint.completed_tasks === sprint.total_tasks && (
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      All {sprint.total_tasks} tasks are completed. Ready to close this sprint?
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300"
                      onClick={() => setShowCompleteConfirm(true)}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Mark as complete
                    </Button>
                  </div>
                )}

              {/* Action error banner */}
              {actionError && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">{actionError}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => setActionError(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Sprint task list */}
              <div className="space-y-4">
                {/* Section header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold tracking-tight">
                      Tasks in Sprint
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {sprintTasks.length}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowAddTasksDialog(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Tasks
                  </Button>
                </div>

                {/* Empty state */}
                {sprintTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      No tasks assigned to this sprint yet.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setShowAddTasksDialog(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add tasks to this sprint
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="w-[50px]"
                            aria-label="Priority"
                          >
                            <span className="sr-only">Priority</span>
                          </TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden w-[160px] sm:table-cell">
                            Assignee
                          </TableHead>
                          <TableHead className="w-[140px]">Status</TableHead>
                          <TableHead className="w-[50px]">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sprintTasks.map((task) => (
                          <TableRow key={task.id}>
                            {/* Priority icon */}
                            <TableCell className="text-center">
                              <div
                                className="flex items-center justify-center"
                                title={`${TASK_PRIORITY_LABELS[task.priority]} priority`}
                              >
                                <PriorityIcon priority={task.priority} />
                              </div>
                            </TableCell>

                            {/* Title */}
                            <TableCell>
                              <Link
                                href={`/projects/${projectId}/tasks/${task.id}`}
                                className="font-medium hover:underline focus:outline-none focus:underline"
                              >
                                {task.title}
                              </Link>
                              {task.assignee_name && (
                                <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                                  {task.assignee_name}
                                </p>
                              )}
                            </TableCell>

                            {/* Assignee */}
                            <TableCell className="hidden sm:table-cell">
                              {task.assignee_id ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(
                                        task.assignee_name,
                                        task.assignee_email
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate text-sm">
                                    {task.assignee_name || task.assignee_email}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Unassigned
                                </span>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <TaskStatusBadge status={task.status} />
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">
                                      Task actions
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/projects/${projectId}/tasks/${task.id}`}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      View task
                                    </Link>
                                  </DropdownMenuItem>
                                  {otherSprints.length > 0 && (
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        Move to sprint
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                        {otherSprints.map((s) => (
                                          <DropdownMenuItem
                                            key={s.id}
                                            onClick={() =>
                                              handleMoveToSprint(task.id, s.id)
                                            }
                                          >
                                            {s.name}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRemoveTaskId(task.id)
                                      setRemoveTaskTitle(task.title)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Remove from sprint
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Edit sprint dialog */}
      <EditSprintDialog
        open={showEditSprintDialog}
        onOpenChange={setShowEditSprintDialog}
        sprint={sprint}
        onUpdateSprint={handleUpdateSprint}
      />

      {/* Add tasks to sprint dialog */}
      <AddTasksToSprintDialog
        open={showAddTasksDialog}
        onOpenChange={setShowAddTasksDialog}
        backlogTasks={backlogTasks}
        onAddTasks={(taskIds) => handleAddTasks(taskIds)}
      />

      {/* Delete sprint confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              {sprint && sprint.total_tasks > 0
                ? `${sprint.total_tasks} task${sprint.total_tasks !== 1 ? 's' : ''} will be moved to the backlog. This action cannot be undone.`
                : 'This sprint will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSprint}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete sprint'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark sprint as complete confirmation */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark sprint as complete?</AlertDialogTitle>
            <AlertDialogDescription>
              {sprint && (sprint.todo_tasks > 0 || sprint.in_progress_tasks > 0)
                ? `${sprint.todo_tasks + sprint.in_progress_tasks} incomplete task${(sprint.todo_tasks + sprint.in_progress_tasks) !== 1 ? 's' : ''} will be automatically marked as done.`
                : 'All tasks are already completed. This sprint will be marked as complete.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkComplete}
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing...' : 'Mark as complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove task from sprint confirmation */}
      <AlertDialog
        open={removeTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTaskId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove task from sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{removeTaskTitle}</span> will be
              moved to the backlog (unassigned from this sprint).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveTask}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove from sprint'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
