'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Loader2, Plus } from 'lucide-react'

import type { Project } from '@/types/project'
import type { SprintStatus } from '@/types/sprint'

import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useSprint, type SprintFilter } from '@/hooks/useSprint'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import { SprintCard } from '@/components/sprint-card'
import { SprintEmptyState } from '@/components/sprint-empty-state'
import { CreateSprintDialog } from '@/components/create-sprint-dialog'

export default function SprintListPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const { isAuthenticated, loading: authLoading, signOut } = useAuth()
  const {
    workspaces,
    activeWorkspace,
    activeMembers,
    isOwner,
    isAdmin,
    canManageMembers,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMembers,
    removeMember,
    updateMemberRole,
    transferOwnership,
  } = useWorkspace()

  const [project, setProject] = useState<Project | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateSprintDialog, setShowCreateSprintDialog] = useState(false)

  const canManageSprints = isOwner || isAdmin

  // Fetch project details
  useEffect(() => {
    if (!activeWorkspace) return

    async function fetchProject() {
      setProjectLoading(true)
      setProjectError(null)
      try {
        const res = await fetch(
          `/api/workspaces/${activeWorkspace!.id}/projects/${projectId}`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setProjectError(json.error ?? 'Failed to load project')
          setProjectLoading(false)
          return
        }
        const json = await res.json()
        setProject(json.data)
      } catch {
        setProjectError('Failed to load project')
      } finally {
        setProjectLoading(false)
      }
    }

    fetchProject()
  }, [activeWorkspace, projectId])

  const {
    sprints,
    allSprints,
    loading: sprintsLoading,
    error: sprintsError,
    filter,
    setFilter,
    createSprint,
  } = useSprint(activeWorkspace?.id ?? null, projectId)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [authLoading, isAuthenticated])

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Count sprints by status for filter badges
  const statusCounts = allSprints.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    },
    {} as Record<SprintStatus, number>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      {workspaces.length > 0 && (
        <AppHeader
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSwitchWorkspace={switchWorkspace}
          onCreateWorkspace={() => setShowCreateDialog(true)}
          onOpenSettings={() => setShowSettings(true)}
          onSignOut={signOut}
        />
      )}

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to project
              </Link>
            </Button>
          </div>

          {/* Loading state */}
          {projectLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {projectError && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-destructive">{projectError}</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/">Back to projects</Link>
              </Button>
            </div>
          )}

          {/* Sprint list */}
          {project && !projectLoading && !projectError && (
            <>
              {/* Page header */}
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Sprints
                  </h1>
                  <Badge variant="secondary" className="text-xs">
                    {allSprints.length}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {project.name} &mdash; Plan and track work in time-boxed
                  iterations.
                </p>
              </div>

              {/* Sprints error */}
              {sprintsError && (
                <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {sprintsError}
                </div>
              )}

              {/* Loading sprints */}
              {sprintsLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-72" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              )}

              {/* No sprints */}
              {!sprintsLoading && allSprints.length === 0 && (
                <SprintEmptyState
                  onCreateSprint={() => setShowCreateSprintDialog(true)}
                  isAdmin={canManageSprints}
                />
              )}

              {/* Sprints exist */}
              {!sprintsLoading && allSprints.length > 0 && (
                <>
                  {/* Filter tabs + create button */}
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tabs
                      value={filter}
                      onValueChange={(v) => setFilter(v as SprintFilter)}
                    >
                      <TabsList>
                        <TabsTrigger value="all">
                          All ({allSprints.length})
                        </TabsTrigger>
                        <TabsTrigger value="active">
                          Active ({statusCounts.active || 0})
                        </TabsTrigger>
                        <TabsTrigger value="upcoming">
                          Upcoming ({statusCounts.upcoming || 0})
                        </TabsTrigger>
                        <TabsTrigger value="overdue">
                          Overdue ({statusCounts.overdue || 0})
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                          Completed ({statusCounts.completed || 0})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {canManageSprints && (
                      <Button
                        size="sm"
                        onClick={() => setShowCreateSprintDialog(true)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        New Sprint
                      </Button>
                    )}
                  </div>

                  {/* Sprint cards */}
                  {sprints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No sprints match this filter.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {sprints.map((sprint) => (
                        <SprintCard
                          key={sprint.id}
                          sprint={sprint}
                          projectId={projectId}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create sprint dialog */}
      <CreateSprintDialog
        open={showCreateSprintDialog}
        onOpenChange={setShowCreateSprintDialog}
        onCreateSprint={createSprint}
      />

      {/* Create workspace dialog */}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateWorkspace={async (values) => {
          const result = await createWorkspace(values)
          return { error: result.error }
        }}
      />

      {/* Workspace settings sheet */}
      {activeWorkspace && (
        <WorkspaceSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          workspace={activeWorkspace}
          members={activeMembers}
          isOwner={isOwner}
          canManageMembers={canManageMembers}
          onUpdate={updateWorkspace}
          onDelete={deleteWorkspace}
          onInviteMembers={inviteMembers}
          onRemoveMember={removeMember}
          onUpdateRole={updateMemberRole}
          onTransferOwnership={transferOwnership}
        />
      )}
    </div>
  )
}
