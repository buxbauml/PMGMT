'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'

import type { Project } from '@/types/project'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ProjectCardProps {
  project: Project
  canArchive: boolean
  onEdit: (project: Project) => void
  onArchive: (projectId: string) => Promise<{ error: string | null }>
  onDelete: (projectId: string) => Promise<{ error: string | null }>
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null
): string | null {
  if (!startDate && !endDate) return null

  const formatDate = (d: string) => format(parseISO(d), 'MMM d')

  if (startDate && endDate) {
    return `${formatDate(startDate)} → ${formatDate(endDate)}`
  }
  if (startDate) {
    return `From ${formatDate(startDate)}`
  }
  return `Due ${formatDate(endDate!)}`
}

export function ProjectCard({
  project,
  canArchive,
  onEdit,
  onArchive,
  onDelete,
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const progressPercent =
    project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : 0

  const dateRange = formatDateRange(project.start_date, project.end_date)
  const canDelete = project.total_tasks === 0

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await onDelete(project.id)
      if (!result.error) {
        setShowDeleteDialog(false)
      } else {
        setDeleteError(result.error)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleArchive() {
    await onArchive(project.id)
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate text-base font-semibold">
                {project.name}
              </CardTitle>
              {project.archived && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  Archived
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Project actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit project
              </DropdownMenuItem>
              {canArchive && (
                <DropdownMenuItem onClick={handleArchive}>
                  {project.archived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete project
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          {project.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}

          {dateRange && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{dateRange}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {project.total_tasks > 0 ? (
                  <>
                    {project.completed_tasks}/{project.total_tasks} tasks
                    {' \u2022 '}
                    {progressPercent}%
                  </>
                ) : (
                  '0 tasks'
                )}
              </p>
              {progressPercent === 100 && !project.archived && canArchive && (
                <p className="text-xs font-medium text-green-600 dark:text-green-400">
                  Ready to archive
                </p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Link
            href={`/projects/${project.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View Tasks &rarr;
          </Link>
        </CardFooter>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">{project.name}</span>. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
