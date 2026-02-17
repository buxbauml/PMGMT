'use client'

import { FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectEmptyStateProps {
  onCreateProject: () => void
}

export function ProjectEmptyState({
  onCreateProject,
}: ProjectEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FolderKanban className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">
        No projects yet
      </h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        Create your first project to start organizing tasks and tracking
        progress.
      </p>
      <Button onClick={onCreateProject} className="mt-4" size="sm">
        <FolderKanban className="mr-2 h-4 w-4" />
        Create project
      </Button>
    </div>
  )
}
