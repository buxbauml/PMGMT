'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  Copy,
  Loader2,
  MoreHorizontal,
  Timer,
  Trash2,
} from 'lucide-react'

import type { Task, UpdateTaskInput, TaskStatus, TaskPriority, Comment } from '@/types/task'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import type { WorkspaceMember } from '@/types/workspace'

import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTaskActivity } from '@/hooks/useTaskActivity'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { ActivityFeed } from '@/components/activity-feed'
import { CommentForm } from '@/components/comment-form'
import { EditCommentDialog } from '@/components/edit-comment-dialog'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

function StatusBadge({ status }: { status: TaskStatus }) {
  const variants: Record<TaskStatus, string> = {
    to_do: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    in_progress:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  }

  const icons: Record<TaskStatus, React.ReactNode> = {
    to_do: <Circle className="h-3.5 w-3.5" />,
    in_progress: <Timer className="h-3.5 w-3.5" />,
    done: <CheckCircle2 className="h-3.5 w-3.5" />,
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${variants[status]}`}
    >
      {icons[status]}
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const variants: Record<TaskPriority, string> = {
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${variants[priority]}`}
    >
      <PriorityIcon priority={priority} />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  )
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>
}) {
  const { projectId, taskId } = use(params)
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

  const [task, setTask] = useState<Task | null>(null)
  const [taskLoading, setTaskLoading] = useState(true)
  const [taskError, setTaskError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false)
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<Comment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingComment, setIsDeletingComment] = useState(false)

  const {
    timeline,
    totalCount,
    loading: activityLoading,
    filter,
    setFilter,
    addComment,
    editComment,
    deleteComment,
    refetch: refetchActivity,
  } = useTaskActivity({
    workspaceId: activeWorkspace?.id ?? null,
    projectId,
    taskId,
  })

  // Fetch task details
  useEffect(() => {
    if (!activeWorkspace) return

    async function fetchTask() {
      setTaskLoading(true)
      setTaskError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${activeWorkspace!.id}/projects/${projectId}/tasks/${taskId}`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setTaskError(json.error ?? 'Failed to load task')
          setTaskLoading(false)
          return
        }
        const json = await res.json()
        setTask(json.data)
      } catch {
        setTaskError('Failed to load task')
      } finally {
        setTaskLoading(false)
      }
    }

    fetchTask()
  }, [activeWorkspace, projectId, taskId])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [authLoading, isAuthenticated])

  // Quick status change handler
  async function handleStatusChange(newStatus: TaskStatus) {
    if (!activeWorkspace || !task) return

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      )
      const json = await res.json()
      if (res.ok && json.data) {
        setTask(json.data)
        refetchActivity()
      }
    } catch {
      // Fail silently - toast could be added later
    }
  }

  // Quick priority change handler
  async function handlePriorityChange(newPriority: TaskPriority) {
    if (!activeWorkspace || !task) return

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: newPriority }),
        }
      )
      const json = await res.json()
      if (res.ok && json.data) {
        setTask(json.data)
      }
    } catch {
      // Fail silently
    }
  }

  // Quick assignee change handler
  async function handleAssigneeChange(assigneeId: string) {
    if (!activeWorkspace || !task) return

    const cleanId = assigneeId === 'unassigned' ? null : assigneeId

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignee_id: cleanId }),
        }
      )
      const json = await res.json()
      if (res.ok && json.data) {
        setTask(json.data)
        refetchActivity()
      }
    } catch {
      // Fail silently
    }
  }

  // Delete task
  async function handleDeleteTask() {
    if (!activeWorkspace || !task) return

    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${projectId}/tasks/${taskId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        window.location.href = `/projects/${projectId}`
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Copy link
  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {
      // Fail silently
    })
  }

  // Comment handlers
  async function handleAddComment(content: string) {
    return addComment(content)
  }

  async function handleEditComment(commentId: string, content: string) {
    return editComment(commentId, content)
  }

  function handleDeleteCommentClick(commentId: string) {
    setDeleteCommentId(commentId)
    setShowDeleteCommentDialog(true)
  }

  async function handleConfirmDeleteComment() {
    if (!deleteCommentId) return
    setIsDeletingComment(true)
    try {
      await deleteComment(deleteCommentId)
      setShowDeleteCommentDialog(false)
      setDeleteCommentId(null)
    } finally {
      setIsDeletingComment(false)
    }
  }

  // Get user profile info from workspace members
  const currentMember = activeMembers.find((m) => m.user_id === user?.id)
  const userName = currentMember?.user_name ?? user?.user_metadata?.full_name ?? null
  const userEmail = currentMember?.user_email ?? user?.email ?? null

  const canDeleteTask =
    isOwner || isAdmin || (task ? task.created_by === user?.id : false)

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to tasks
              </Link>
            </Button>
          </div>

          {/* Loading state */}
          {taskLoading && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-24" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {taskError && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-destructive">{taskError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                asChild
              >
                <Link href={`/projects/${projectId}`}>Back to tasks</Link>
              </Button>
            </div>
          )}

          {/* Task details */}
          {task && !taskLoading && !taskError && (
            <>
              {/* Page header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {task.title}
                  </h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyLink}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy link
                      </DropdownMenuItem>
                      {canDeleteTask && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setShowDeleteDialog(true)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete task
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Task metadata row */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status dropdown */}
                  <Select
                    value={task.status}
                    onValueChange={(val) =>
                      handleStatusChange(val as TaskStatus)
                    }
                  >
                    <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-transparent px-0 shadow-none hover:bg-accent">
                      <StatusBadge status={task.status} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_do">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3.5 w-3.5 text-gray-400" />
                          To Do
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <Timer className="h-3.5 w-3.5 text-blue-500" />
                          In Progress
                        </div>
                      </SelectItem>
                      <SelectItem value="done">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          Done
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Priority dropdown */}
                  <Select
                    value={task.priority}
                    onValueChange={(val) =>
                      handlePriorityChange(val as TaskPriority)
                    }
                  >
                    <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-transparent px-0 shadow-none hover:bg-accent">
                      <PriorityBadge priority={task.priority} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
                          Low
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3.5 w-3.5 text-yellow-500" />
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                          High
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Separator orientation="vertical" className="h-5" />

                  {/* Assignee dropdown */}
                  <Select
                    value={task.assignee_id ?? 'unassigned'}
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-transparent px-0 shadow-none hover:bg-accent">
                      <div className="flex items-center gap-1.5">
                        {task.assignee_id ? (
                          <>
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[9px]">
                                {getInitials(
                                  task.assignee_name,
                                  task.assignee_email
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">
                              {task.assignee_name ?? task.assignee_email}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {activeMembers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.user_name || member.user_email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Created by / date */}
                <p className="text-xs text-muted-foreground">
                  Created{' '}
                  {format(parseISO(task.created_at), 'MMM d, yyyy h:mm a')}
                  {task.created_by_name && <> by {task.created_by_name}</>}
                </p>

                {/* Completion info */}
                {task.status === 'done' && task.completed_at && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    Completed{' '}
                    {format(
                      parseISO(task.completed_at),
                      'MMM d, yyyy h:mm a'
                    )}
                    {task.completed_by_name && (
                      <> by {task.completed_by_name}</>
                    )}
                  </div>
                )}
              </div>

              {/* Task description */}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Description
                </h3>
                {task.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {task.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    No description
                  </p>
                )}
              </div>

              <Separator className="my-6" />

              {/* Activity feed */}
              <ActivityFeed
                timeline={timeline}
                totalCount={totalCount}
                filter={filter}
                onSetFilter={setFilter}
                currentUserId={user?.id}
                isAdmin={isOwner || isAdmin}
                loading={activityLoading}
                onEditComment={setEditingComment}
                onDeleteComment={handleDeleteCommentClick}
              />

              {/* Add comment form */}
              <CommentForm
                userName={userName}
                userEmail={userEmail}
                onSubmit={handleAddComment}
              />
            </>
          )}
        </div>
      </main>

      {/* Edit comment dialog */}
      <EditCommentDialog
        open={editingComment !== null}
        onOpenChange={(open) => {
          if (!open) setEditingComment(null)
        }}
        comment={editingComment}
        onSave={handleEditComment}
      />

      {/* Delete task confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">{task?.title}</span> and all its
              comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete comment confirmation */}
      <AlertDialog
        open={showDeleteCommentDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteCommentDialog(false)
            setDeleteCommentId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This comment will be marked as deleted. Other team members will
              see &quot;[Comment deleted]&quot; in its place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingComment}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteComment}
              disabled={isDeletingComment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingComment ? 'Deleting...' : 'Delete comment'}
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
