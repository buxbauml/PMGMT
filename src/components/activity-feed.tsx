'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react'

import type {
  Comment,
  ActivityLog,
  TimelineItem,
  ActivityFilter,
  TaskStatus,
} from '@/types/task'
import { TASK_STATUS_LABELS } from '@/types/task'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

interface ActivityFeedProps {
  timeline: TimelineItem[]
  totalCount: number
  filter: ActivityFilter
  onSetFilter: (filter: ActivityFilter) => void
  currentUserId: string | undefined
  isAdmin: boolean
  loading: boolean
  onEditComment: (comment: Comment) => void
  onDeleteComment: (commentId: string) => void
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

function isWithinEditWindow(createdAt: string): boolean {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const fifteenMinutes = 15 * 60 * 1000
  return diffMs < fifteenMinutes
}

function formatTimestamp(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'status_changed':
      return <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
    case 'assigned':
      return <UserPlus className="h-3.5 w-3.5 text-indigo-500" />
    case 'unassigned':
      return <UserMinus className="h-3.5 w-3.5 text-gray-400" />
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    case 'created':
      return <Plus className="h-3.5 w-3.5 text-emerald-500" />
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400" />
  }
}

function formatActivityDescription(log: ActivityLog): string {
  const name = log.user_name ?? log.user_email ?? '[Former member]'

  switch (log.activity_type) {
    case 'status_changed': {
      const oldLabel =
        TASK_STATUS_LABELS[log.old_value as TaskStatus] ?? log.old_value
      const newLabel =
        TASK_STATUS_LABELS[log.new_value as TaskStatus] ?? log.new_value
      return `${name} changed status from ${oldLabel} to ${newLabel}`
    }
    case 'assigned':
      return `${name} assigned this task to ${log.new_value ?? 'someone'}`
    case 'unassigned':
      return `${name} unassigned ${log.old_value ?? 'someone'} from this task`
    case 'completed':
      return `${name} marked this task as complete`
    case 'created':
      return `${name} created this task`
    default:
      return `${name} performed an action`
  }
}

function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
}: {
  comment: Comment
  currentUserId: string | undefined
  isAdmin: boolean
  onEdit: (comment: Comment) => void
  onDelete: (commentId: string) => void
}) {
  if (comment.deleted) {
    return (
      <div className="flex items-start gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs text-muted-foreground">
            ?
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm italic text-muted-foreground">
            [Comment deleted]
          </p>
        </div>
      </div>
    )
  }

  const isOwner = currentUserId === comment.user_id
  const canEdit = isOwner && isWithinEditWindow(comment.created_at)
  const canDelete = isOwner || isAdmin
  const isEdited =
    comment.updated_at &&
    comment.updated_at !== comment.created_at
  const authorName =
    comment.is_member
      ? comment.user_name ?? comment.user_email ?? 'Unknown'
      : '[Former member]'

  return (
    <div className="group flex items-start gap-3 py-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">
          {comment.is_member
            ? getInitials(comment.user_name, comment.user_email)
            : '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(comment.created_at)}
          </span>
          {isEdited && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              edited
            </Badge>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
          {comment.content}
        </p>
      </div>
      {(canEdit || canDelete) && (
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Comment actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(comment)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {isOwner && !canEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-not-allowed items-center px-2 py-1.5 text-sm text-muted-foreground">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Edit window expired</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(comment.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

function ActivityItem({ log }: { log: ActivityLog }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
          <ActivityIcon type={log.activity_type} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          {formatActivityDescription(log)}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTimestamp(log.created_at)}
      </span>
    </div>
  )
}

export function ActivityFeed({
  timeline,
  totalCount,
  filter,
  onSetFilter,
  currentUserId,
  isAdmin,
  loading,
  onEditComment,
  onDeleteComment,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-3">
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
    )
  }

  return (
    <div className="pt-6">
      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
        <div className="flex gap-1">
          {(['all', 'comments', 'activity'] as ActivityFilter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => onSetFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'comments' ? 'Comments' : 'Activity'}
            </Button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {timeline.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center mt-4">
          <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            No activity yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to comment on this task.
          </p>
        </div>
      )}

      {/* Timeline items */}
      {timeline.length > 0 && (
        <div className="mt-4 divide-y divide-border">
          {timeline.map((item) => {
            if (item.type === 'comment') {
              return (
                <CommentItem
                  key={`comment-${item.data.id}`}
                  comment={item.data}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onEdit={onEditComment}
                  onDelete={onDeleteComment}
                />
              )
            }
            return (
              <ActivityItem key={`activity-${item.data.id}`} log={item.data} />
            )
          })}
        </div>
      )}
    </div>
  )
}
