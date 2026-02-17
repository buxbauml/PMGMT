'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  GripVertical,
} from 'lucide-react'

import type { Task, TaskPriority, TaskStatus } from '@/types/task'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface KanbanCardProps {
  task: Task
  isMobile: boolean
  isArchived?: boolean
  sprintName?: string
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onClick: (task: Task) => void
}

function PriorityIcon({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case 'high':
      return <ArrowUp className="h-3.5 w-3.5 text-red-500" />
    case 'medium':
      return <ArrowRight className="h-3.5 w-3.5 text-yellow-500" />
    case 'low':
      return <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
  }
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

export function KanbanCard({
  task,
  isMobile,
  isArchived,
  sprintName,
  onStatusChange,
  onClick,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isMobile || isArchived,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary/20' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle (desktop only, hidden on archived) */}
        {!isArchived && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 hidden shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring md:block"
            aria-label={`Drag ${task.title}`}
            tabIndex={0}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Card content */}
        <div className="min-w-0 flex-1">
          {/* Title row with priority */}
          <button
            className="flex w-full items-start gap-1.5 text-left focus:outline-none focus:underline"
            onClick={() => onClick(task)}
            aria-label={`Open task: ${task.title}`}
          >
            <PriorityIcon priority={task.priority} />
            <span className="text-sm font-medium leading-snug hover:underline">
              {task.title}
            </span>
          </button>

          {/* Bottom row: sprint badge + assignee */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {task.sprint_id && (
                <Badge
                  variant="outline"
                  className="h-5 max-w-[120px] truncate px-1.5 text-[10px] font-normal"
                >
                  {sprintName ?? 'Sprint'}
                </Badge>
              )}
            </div>

            {/* Assignee avatar */}
            {task.assignee_id ? (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">
                  {getInitials(task.assignee_name, task.assignee_email)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                Unassigned
              </span>
            )}
          </div>

          {/* Mobile: status dropdown (CSS-driven to prevent hydration flash) */}
          {!isArchived && (
            <div className="mt-2 md:hidden">
              <Select
                value={task.status}
                onValueChange={(value) =>
                  onStatusChange(task.id, value as TaskStatus)
                }
              >
                <SelectTrigger className="h-7 text-xs" aria-label="Change status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
