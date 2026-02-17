'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  CheckCircle2,
  Circle,
  Timer,
} from 'lucide-react'

import type { Task, TaskStatus } from '@/types/task'
import { TASK_STATUS_LABELS } from '@/types/task'
import { Badge } from '@/components/ui/badge'
import { KanbanCard } from '@/components/kanban-card'

const SCROLL_THRESHOLD = 15

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  isMobile: boolean
  isArchived?: boolean
  sprintMap?: Record<string, string>
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onTaskClick: (task: Task) => void
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

const columnColors: Record<TaskStatus, string> = {
  to_do: 'border-t-gray-400',
  in_progress: 'border-t-blue-500',
  done: 'border-t-green-500',
}

export function KanbanColumn({
  status,
  tasks,
  isMobile,
  isArchived,
  sprintMap,
  onStatusChange,
  onTaskClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: {
      type: 'column',
      status,
    },
  })

  const taskIds = tasks.map((t) => t.id)

  return (
    <div
      className={`flex flex-col rounded-lg border-t-4 bg-muted/30 ${columnColors[status]} ${
        isOver ? 'ring-2 ring-primary/30' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <StatusIcon status={status} />
        <h3 className="text-sm font-semibold">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
          {tasks.length}
        </Badge>
      </div>

      {/* Task cards */}
      <div
        ref={setNodeRef}
        className="flex-1 px-2 pb-2"
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center rounded-md border border-dashed px-3 py-8 text-xs text-muted-foreground">
              No tasks
            </div>
          ) : (
            <div
              className={`space-y-2 ${
                tasks.length >= SCROLL_THRESHOLD
                  ? 'max-h-[600px] overflow-y-auto pr-1'
                  : ''
              }`}
            >
              {tasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isMobile={isMobile}
                  isArchived={isArchived}
                  sprintName={
                    task.sprint_id ? sprintMap?.[task.sprint_id] : undefined
                  }
                  onStatusChange={onStatusChange}
                  onClick={onTaskClick}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
