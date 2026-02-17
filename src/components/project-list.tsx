'use client'

import { useState } from 'react'
import { FolderKanban, Loader2, Plus } from 'lucide-react'

import type { Project, UpdateProjectInput } from '@/types/project'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { ProjectCard } from '@/components/project-card'
import { ProjectEmptyState } from '@/components/project-empty-state'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { EditProjectDialog } from '@/components/edit-project-dialog'

interface ProjectListProps {
  projects: Project[]
  allProjects: Project[]
  loading: boolean
  showArchived: boolean
  canArchive: boolean
  onSetShowArchived: (value: boolean) => void
  onCreateProject: (input: {
    name: string
    description?: string
    start_date?: string
    end_date?: string
  }) => Promise<{ data: Project | null; error: string | null }>
  onUpdateProject: (
    projectId: string,
    input: UpdateProjectInput
  ) => Promise<{ error: string | null }>
  onArchiveProject: (projectId: string) => Promise<{ error: string | null }>
  onDeleteProject: (projectId: string) => Promise<{ error: string | null }>
}

export function ProjectList({
  projects,
  allProjects,
  loading,
  showArchived,
  canArchive,
  onSetShowArchived,
  onCreateProject,
  onUpdateProject,
  onArchiveProject,
  onDeleteProject,
}: ProjectListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const archivedCount = allProjects.filter((p) => p.archived).length
  const totalCount = allProjects.length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <>
        <ProjectEmptyState onCreateProject={() => setShowCreateDialog(true)} />
        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          existingProjectNames={allProjects.map((p) => p.name)}
          onCreateProject={async (values) => {
            const result = await onCreateProject(values)
            return { error: result.error }
          }}
        />
      </>
    )
  }

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          <Badge variant="secondary" className="text-xs">
            {projects.length}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          {archivedCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-archived"
                checked={showArchived}
                onCheckedChange={(checked) =>
                  onSetShowArchived(checked === true)
                }
              />
              <Label
                htmlFor="show-archived"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Show archived ({archivedCount})
              </Label>
            </div>
          )}
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Project grid */}
      {projects.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canArchive={canArchive}
              onEdit={setEditingProject}
              onArchive={onArchiveProject}
              onDelete={onDeleteProject}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No active projects. Toggle &ldquo;Show archived&rdquo; to see
            archived projects.
          </p>
        </div>
      )}

      {/* Dialogs */}
      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        existingProjectNames={allProjects.map((p) => p.name)}
        onCreateProject={async (values) => {
          const result = await onCreateProject(values)
          return { error: result.error }
        }}
      />
      <EditProjectDialog
        open={editingProject !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null)
        }}
        project={editingProject}
        onUpdateProject={onUpdateProject}
      />
    </>
  )
}
