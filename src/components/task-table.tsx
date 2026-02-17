'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  Timer,
  Trash2,
  X,
} from 'lucide-react'

import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import type { WorkspaceMember } from '@/types/workspace'
import type { TaskFilters } from '@/hooks/useTask'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
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

interface TaskTableProps {
  tasks: Task[]
  allTasks: Task[]
  members: WorkspaceMember[]
  currentUserId: string | undefined
  canDeleteAny: boolean
  isArchived: boolean
  loading: boolean
  filters: TaskFilters
  hasActiveFilters: boolean
  onSetFilters: (filters: TaskFilters) => void
  onClearFilters: () => void
  onCreateTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => Promise<{ error: string | null }>
  onQuickStatusChange: (
    taskId: string,
    status: TaskStatus
  ) => Promise<{ data: unknown; error: string | null }>
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

function StatusBadge({ status }: { status: TaskStatus }) {
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

export function TaskTable({
  tasks,
  allTasks,
  members,
  currentUserId,
  canDeleteAny,
  isArchived,
  loading,
  filters,
  hasActiveFilters,
  onSetFilters,
  onClearFilters,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onQuickStatusChange,
}: TaskTableProps) {
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const [deleteTaskTitle, setDeleteTaskTitle] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTaskId) return
    setIsDeleting(true)
    try {
      const result = await onDeleteTask(deleteTaskId)
      if (!result.error) {
        setDeleteTaskId(null)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  function canUserDelete(task: Task): boolean {
    if (canDeleteAny) return true
    return task.created_by === currentUserId
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
              {hasActiveFilters && allTasks.length !== tasks.length
                ? ` / ${allTasks.length}`
                : ''}
            </Badge>
          </div>
          {!isArchived && (
            <Button size="sm" onClick={onCreateTask}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onSetFilters({ ...filters, status: value as TaskStatus | 'all' })
            }
          >
            <SelectTrigger className="h-8 w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="to_do">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.assignee}
            onValueChange={(value) =>
              onSetFilters({ ...filters, assignee: value })
            }
          >
            <SelectTrigger className="h-8 w-[160px]" aria-label="Filter by assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {currentUserId && (
                <SelectItem value={currentUserId}>Me</SelectItem>
              )}
              {members
                .filter((m) => m.user_id !== currentUserId)
                .map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.user_name || member.user_email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) =>
              onSetFilters({
                ...filters,
                priority: value as TaskPriority | 'all',
              })
            }
          >
            <SelectTrigger className="h-8 w-[140px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={onClearFilters}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Task table */}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'No tasks match the current filters.'
                : 'No tasks in this project yet.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={onClearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" aria-label="Priority">
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
                {tasks.map((task) => (
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
                        href={`/projects/${task.project_id}/tasks/${task.id}`}
                        className="font-medium hover:underline focus:outline-none focus:underline"
                      >
                        {task.title}
                      </Link>
                      {/* Mobile: show assignee inline */}
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
                      <StatusBadge status={task.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {!isArchived && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Task actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onEditTask(task)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit task
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* Quick status changes */}
                            {task.status !== 'to_do' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onQuickStatusChange(task.id, 'to_do')
                                }
                              >
                                <Circle className="mr-2 h-4 w-4 text-gray-400" />
                                Mark as To Do
                              </DropdownMenuItem>
                            )}
                            {task.status !== 'in_progress' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onQuickStatusChange(task.id, 'in_progress')
                                }
                              >
                                <Timer className="mr-2 h-4 w-4 text-blue-500" />
                                Mark as In Progress
                              </DropdownMenuItem>
                            )}
                            {task.status !== 'done' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onQuickStatusChange(task.id, 'done')
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                                Mark as Done
                              </DropdownMenuItem>
                            )}
                            {canUserDelete(task) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeleteTaskId(task.id)
                                    setDeleteTaskTitle(task.title)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete task
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">{deleteTaskTitle}</span>. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
