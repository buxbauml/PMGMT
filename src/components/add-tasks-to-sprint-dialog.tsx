'use client'

import { useState, useMemo } from 'react'
import { Loader2, Search } from 'lucide-react'

import type { Task } from '@/types/task'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/task'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AddTasksToSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  backlogTasks: Task[]
  onAddTasks: (taskIds: string[]) => Promise<{ error: string | null }>
}

export function AddTasksToSprintDialog({
  open,
  onOpenChange,
  backlogTasks,
  onAddTasks,
}: AddTasksToSprintDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return backlogTasks
    const query = search.toLowerCase()
    return backlogTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    )
  }, [backlogTasks, search])

  function toggleTask(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)))
    }
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) return
    setIsLoading(true)
    setServerError(null)
    try {
      const result = await onAddTasks(Array.from(selectedIds))
      if (!result.error) {
        setSelectedIds(new Set())
        setSearch('')
        onOpenChange(false)
      } else {
        setServerError(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedIds(new Set())
      setSearch('')
      setServerError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add tasks to sprint</DialogTitle>
          <DialogDescription>
            Select backlog tasks (not assigned to any sprint) to add to this
            sprint.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Task list */}
        {backlogTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              All tasks are already assigned to sprints.
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              No tasks match your search.
            </p>
          </div>
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center gap-2 border-b pb-2">
              <Checkbox
                id="select-all-tasks"
                checked={
                  selectedIds.size === filteredTasks.length &&
                  filteredTasks.length > 0
                }
                onCheckedChange={toggleAll}
              />
              <label
                htmlFor="select-all-tasks"
                className="cursor-pointer text-sm font-medium"
              >
                Select all ({filteredTasks.length})
              </label>
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedIds.size} selected
                </Badge>
              )}
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <label
                      htmlFor={`task-${task.id}`}
                      className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
                    >
                      <span className="flex-1 truncate">{task.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || selectedIds.size === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
