'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, Clock } from 'lucide-react'

import type { TimeLog } from '@/types/task'
import { formatDuration } from '@/types/task'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

interface TimeLogListProps {
  timeLogs: TimeLog[]
  onEdit: (log: TimeLog) => void
  onDelete: (logId: string) => Promise<{ error: string | null }>
}

export function TimeLogList({ timeLogs, onEdit, onDelete }: TimeLogListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirmDelete() {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await onDelete(deletingId)
      setDeletingId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (timeLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No time logged yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {timeLogs.map((log) => (
          <div
            key={log.id}
            className="group flex items-start gap-3 rounded-lg border bg-card p-3"
          >
            {/* Avatar */}
            <Avatar className="mt-0.5 h-7 w-7 shrink-0">
              <AvatarFallback className="text-[10px]">
                {getInitials(log.user_name, log.user_email)}
              </AvatarFallback>
            </Avatar>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {formatDuration(log.duration)}
                </span>
                <span className="text-xs text-muted-foreground">
                  by {log.user_name || log.user_email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(log.logged_date), 'MMM d, yyyy')}
                </span>
              </div>
              {log.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {log.description}
                </p>
              )}
            </div>

            {/* Actions (own logs only) */}
            {log.is_owner && (
              <TooltipProvider delayDuration={300}>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onEdit(log)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit time log</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(log.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete time log</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this time log entry. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
