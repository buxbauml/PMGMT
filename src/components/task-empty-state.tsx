'use client'

import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TaskEmptyStateProps {
  onCreateTask: () => void
  isArchived?: boolean
}

export function TaskEmptyState({
  onCreateTask,
  isArchived = false,
}: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <ClipboardList className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">
        No tasks yet
      </h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {isArchived
          ? 'This project is archived and has no tasks.'
          : 'Create your first task to start tracking work in this project.'}
      </p>
      {!isArchived && (
        <Button onClick={onCreateTask} className="mt-4" size="sm">
          <ClipboardList className="mr-2 h-4 w-4" />
          Create task
        </Button>
      )}
    </div>
  )
}
