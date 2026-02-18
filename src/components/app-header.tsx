'use client'

import Link from 'next/link'
import { Settings, LogOut, Clock } from 'lucide-react'
import type { Workspace } from '@/types/workspace'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'

interface AppHeaderProps {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  onSwitchWorkspace: (workspaceId: string) => void
  onCreateWorkspace: () => void
  onOpenSettings: () => void
  onSignOut: () => void
}

export function AppHeader({
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  onCreateWorkspace,
  onOpenSettings,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          PMGMT
        </span>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSwitch={onSwitchWorkspace}
          onCreateNew={onCreateWorkspace}
        />
      </div>
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={300}>
          {activeWorkspace && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  asChild
                >
                  <Link href="/time" aria-label="Time tracking">
                    <Clock className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Time tracking</TooltipContent>
            </Tooltip>
          )}
          {activeWorkspace && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onOpenSettings}
                  aria-label="Workspace settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Workspace settings</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
