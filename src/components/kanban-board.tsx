'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  Kanban,
  Plus,
  X,
} from 'lucide-react'

import type { Task, TaskStatus } from '@/types/task'
import type { Sprint } from '@/types/sprint'
import type { WorkspaceMember } from '@/types/workspace'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanColumn } from '@/components/kanban-column'
import { KanbanCard } from '@/components/kanban-card'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'

const STATUSES: TaskStatus[] = ['to_do', 'in_progress', 'done']

interface KanbanBoardProps {
  tasks: Task[]
  allTasks: Task[]
  members: WorkspaceMember[]
  sprints: Sprint[]
  currentUserId: string | undefined
  isArchived: boolean
  loading: boolean
  onCreateTask: () => void
  onEditTask: (task: Task) => void
  onUpdateTaskStatus: (
    taskId: string,
    status: TaskStatus
  ) => Promise<{ data: unknown; error: string | null }>
}

export function KanbanBoard({
  tasks,
  allTasks,
  members,
  sprints,
  currentUserId,
  isArchived,
  loading,
  onCreateTask,
  onEditTask,
  onUpdateTaskStatus,
}: KanbanBoardProps) {
  const isMobile = useIsMobile()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sprintFilter, setSprintFilter] = useState<string>('all')

  // We use optimistic state to move tasks immediately before the API responds
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, TaskStatus>
  >({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Apply board-specific filters (assignee + sprint) on top of task data
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Assignee filter
      if (assigneeFilter === 'me' && task.assignee_id !== currentUserId) {
        return false
      }
      if (
        assigneeFilter !== 'all' &&
        assigneeFilter !== 'me' &&
        assigneeFilter !== 'unassigned' &&
        task.assignee_id !== assigneeFilter
      ) {
        return false
      }
      if (assigneeFilter === 'unassigned' && task.assignee_id !== null) {
        return false
      }

      // Sprint filter
      if (sprintFilter !== 'all' && task.sprint_id !== sprintFilter) {
        return false
      }

      return true
    })
  }, [tasks, assigneeFilter, sprintFilter, currentUserId])

  // Group tasks by status, applying optimistic updates
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      to_do: [],
      in_progress: [],
      done: [],
    }

    for (const task of filteredTasks) {
      const effectiveStatus = optimisticUpdates[task.id] ?? task.status
      grouped[effectiveStatus].push({
        ...task,
        status: effectiveStatus,
      })
    }

    return grouped
  }, [filteredTasks, optimisticUpdates])

  // Build sprint ID → name lookup for card display
  const sprintMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of sprints) {
      map[s.id] = s.name
    }
    return map
  }, [sprints])

  const hasActiveFilters = assigneeFilter !== 'all' || sprintFilter !== 'all'

  const clearFilters = useCallback(() => {
    setAssigneeFilter('all')
    setSprintFilter('all')
  }, [])

  // ---- Drag-and-Drop Handlers ----

  function handleDragStart(event: DragStartEvent) {
    if (isArchived) return
    const { active } = event
    const task = findTaskById(active.id as string)
    if (task) {
      setActiveTask(task)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    // We don't need to do anything special here for our simple column-based layout
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (isArchived || !over) return

    const taskId = active.id as string
    const task = findTaskById(taskId)
    if (!task) return

    // Determine which column was dropped on
    let targetStatus: TaskStatus | null = null

    // Check if dropped over a column
    const overData = over.data.current
    if (overData?.type === 'column') {
      targetStatus = overData.status as TaskStatus
    } else if (overData?.type === 'task') {
      // Dropped over another task - find which column it's in
      const overTask = overData.task as Task
      targetStatus = optimisticUpdates[overTask.id] ?? overTask.status
    }

    // If dropped into column-{status} droppable
    if (!targetStatus && typeof over.id === 'string' && over.id.startsWith('column-')) {
      targetStatus = over.id.replace('column-', '') as TaskStatus
    }

    if (!targetStatus) return

    const currentStatus = optimisticUpdates[task.id] ?? task.status
    if (currentStatus === targetStatus) return

    // Optimistic update: move card immediately
    setOptimisticUpdates((prev) => ({
      ...prev,
      [taskId]: targetStatus!,
    }))

    // Call API
    const result = await onUpdateTaskStatus(taskId, targetStatus)

    if (result.error) {
      // Revert optimistic update
      setOptimisticUpdates((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
      toast.error('Failed to update task', {
        description: result.error,
      })
    } else {
      // Clear optimistic update since the real data now reflects the change
      setOptimisticUpdates((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    }
  }

  function findTaskById(taskId: string): Task | undefined {
    return filteredTasks.find((t) => t.id === taskId)
  }

  async function handleMobileStatusChange(taskId: string, newStatus: TaskStatus) {
    if (isArchived) return
    const task = findTaskById(taskId)
    if (!task) return

    const currentStatus = optimisticUpdates[task.id] ?? task.status
    if (currentStatus === newStatus) return

    setOptimisticUpdates((prev) => ({
      ...prev,
      [taskId]: newStatus,
    }))

    const result = await onUpdateTaskStatus(taskId, newStatus)

    if (result.error) {
      setOptimisticUpdates((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
      toast.error('Failed to update task', {
        description: result.error,
      })
    } else {
      setOptimisticUpdates((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Kanban className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Board</h2>
          <Badge variant="secondary" className="text-xs">
            {filteredTasks.length}
            {hasActiveFilters && allTasks.length !== filteredTasks.length
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
          value={assigneeFilter}
          onValueChange={setAssigneeFilter}
        >
          <SelectTrigger className="h-8 w-[160px]" aria-label="Filter by assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {currentUserId && (
              <SelectItem value="me">Assigned to Me</SelectItem>
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
          value={sprintFilter}
          onValueChange={setSprintFilter}
        >
          <SelectTrigger className="h-8 w-[160px]" aria-label="Filter by sprint">
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sprints</SelectItem>
            {sprints.map((sprint) => (
              <SelectItem key={sprint.id} value={sprint.id}>
                {sprint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={clearFilters}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Board columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              isMobile={isMobile}
              isArchived={isArchived}
              sprintMap={sprintMap}
              onStatusChange={handleMobileStatusChange}
              onTaskClick={onEditTask}
            />
          ))}
        </div>

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeTask ? (
            <div className="w-[280px] rotate-3 opacity-90">
              <KanbanCard
                task={activeTask}
                isMobile={false}
                onStatusChange={() => {}}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
