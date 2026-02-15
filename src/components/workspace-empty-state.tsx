'use client'

import { FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkspaceEmptyStateProps {
  onCreateWorkspace: () => void
}

export function WorkspaceEmptyState({
  onCreateWorkspace,
}: WorkspaceEmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <FolderPlus className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">
        Create your first workspace
      </h2>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Workspaces help you organize your team and projects. Get started by
        creating your first one.
      </p>
      <Button onClick={onCreateWorkspace} className="mt-6" size="lg">
        <FolderPlus className="mr-2 h-4 w-4" />
        Create workspace
      </Button>
    </div>
  )
}
