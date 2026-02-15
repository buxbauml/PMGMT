'use client'

import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import type { Workspace } from '@/types/workspace'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  onSwitch: (workspaceId: string) => void
  onCreateNew: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSwitch,
  onCreateNew,
}: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 font-medium"
          aria-label="Switch workspace"
        >
          {activeWorkspace && (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
              {getInitials(activeWorkspace.name)}
            </span>
          )}
          <span className="max-w-[180px] truncate text-sm">
            {activeWorkspace?.name ?? 'Select workspace'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => onSwitch(workspace.id)}
            className="flex items-center gap-2"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
              {getInitials(workspace.name)}
            </span>
            <span className="truncate text-sm">{workspace.name}</span>
            {workspace.id === activeWorkspace?.id && (
              <Check
                className={cn('ml-auto h-4 w-4 shrink-0 text-primary')}
              />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateNew} className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-muted-foreground/50">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="text-sm">Create new workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
