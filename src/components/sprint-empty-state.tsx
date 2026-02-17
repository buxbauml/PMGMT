'use client'

import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SprintEmptyStateProps {
  onCreateSprint: () => void
  isAdmin: boolean
}

export function SprintEmptyState({
  onCreateSprint,
  isAdmin,
}: SprintEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <CalendarDays className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">
        No sprints yet
      </h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {isAdmin
          ? 'Create your first sprint to start planning work in time-boxed iterations.'
          : 'No sprints have been created for this project yet. Ask a workspace admin to create one.'}
      </p>
      {isAdmin && (
        <Button onClick={onCreateSprint} className="mt-4" size="sm">
          <CalendarDays className="mr-2 h-4 w-4" />
          Create sprint
        </Button>
      )}
    </div>
  )
}
