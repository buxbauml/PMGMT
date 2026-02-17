'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useProject } from '@/hooks/useProject'
import { Loader2, MailWarning } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { AppHeader } from '@/components/app-header'
import { WorkspaceEmptyState } from '@/components/workspace-empty-state'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { ProjectList } from '@/components/project-list'

export default function Home() {
  const { isAuthenticated, isEmailVerified, loading, signOut, user } = useAuth()
  const {
    workspaces,
    activeWorkspace,
    activeMembers,
    isOwner,
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

  const {
    projects,
    allProjects,
    loading: projectsLoading,
    showArchived,
    setShowArchived,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
  } = useProject(activeWorkspace?.id ?? null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [loading, isAuthenticated])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const hasWorkspaces = workspaces.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header - always shown when there are workspaces */}
      {hasWorkspaces && (
        <AppHeader
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSwitchWorkspace={switchWorkspace}
          onCreateWorkspace={() => setShowCreateDialog(true)}
          onOpenSettings={() => setShowSettings(true)}
          onSignOut={signOut}
        />
      )}

      {/* Email verification banner */}
      {!isEmailVerified && (
        <div className="border-b bg-yellow-50 px-6 py-3 dark:bg-yellow-950">
          <Alert
            variant="default"
            className="mx-auto max-w-2xl border-yellow-200 bg-transparent dark:border-yellow-800"
          >
            <MailWarning className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              Your email ({user?.email}) is not verified. Please check your
              inbox and click the confirmation link to verify your account.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1">
        {!hasWorkspaces ? (
          // Empty state with minimal header for sign out
          <div className="flex min-h-screen flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
              <span className="text-sm font-semibold tracking-tight">
                PMGMT
              </span>
              <button
                onClick={signOut}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </header>
            <WorkspaceEmptyState
              onCreateWorkspace={() => setShowCreateDialog(true)}
            />
          </div>
        ) : activeWorkspace ? (
          // Workspace dashboard content area
          <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                {activeWorkspace.name}
              </h1>
              {activeWorkspace.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeWorkspace.description}
                </p>
              )}
            </div>
            {/* Projects section */}
            <ProjectList
              projects={projects}
              allProjects={allProjects}
              loading={projectsLoading}
              showArchived={showArchived}
              canArchive={canManageMembers}
              onSetShowArchived={setShowArchived}
              onCreateProject={createProject}
              onUpdateProject={updateProject}
              onArchiveProject={archiveProject}
              onDeleteProject={deleteProject}
            />
          </div>
        ) : null}
      </main>

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
