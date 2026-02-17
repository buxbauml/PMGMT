'use client'

import { useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Download,
  Trash2,
  FileText,
  FileArchive,
  FileImage,
  File,
  Loader2,
} from 'lucide-react'

import type { TaskAttachment } from '@/types/task'
import { formatFileSize } from '@/hooks/useAttachment'

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

interface AttachedFilesListProps {
  attachments: TaskAttachment[]
  currentUserId?: string
  isAdmin: boolean
  onDelete: (attachmentId: string) => Promise<{ error: string | null }>
  onDownload: (
    storagePath: string
  ) => Promise<{ url: string | null; error: string | null }>
}

/** Get a file type icon based on MIME type */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return FileImage
  }
  if (mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType.includes('document')) {
    return FileText
  }
  if (mimeType === 'application/zip') {
    return FileArchive
  }
  return File
}

/** Check if a MIME type is an image */
function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

export function AttachedFilesList({
  attachments,
  currentUserId,
  isAdmin,
  onDelete,
  onDownload,
}: AttachedFilesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteAttachment, setConfirmDeleteAttachment] =
    useState<TaskAttachment | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = useCallback(
    async (attachment: TaskAttachment) => {
      setDownloadingId(attachment.id)
      try {
        const { url, error } = await onDownload(attachment.storage_path)
        if (error || !url) {
          console.error('Download error:', error)
          return
        }
        // Open in a new tab to trigger download
        const link = document.createElement('a')
        link.href = url
        link.download = attachment.original_filename
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } finally {
        setDownloadingId(null)
      }
    },
    [onDownload]
  )

  const handleDelete = useCallback(async () => {
    if (!confirmDeleteAttachment) return
    setDeletingId(confirmDeleteAttachment.id)
    try {
      const result = await onDelete(confirmDeleteAttachment.id)
      if (result.error) {
        console.error('Delete error:', result.error)
      }
    } finally {
      setDeletingId(null)
      setConfirmDeleteAttachment(null)
    }
  }, [confirmDeleteAttachment, onDelete])

  if (attachments.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        No files attached yet.
      </p>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1">
        {attachments.map((attachment) => {
          const FileIcon = getFileIcon(attachment.mime_type)
          const canDelete =
            isAdmin || attachment.uploaded_by === currentUserId
          const uploaderLabel =
            attachment.uploaded_by_name ||
            attachment.uploaded_by_email ||
            '[Former member]'

          return (
            <div
              key={attachment.id}
              className="group flex items-center gap-3 rounded-md border bg-background px-3 py-2 transition-colors hover:bg-muted/50"
            >
              {/* Thumbnail or Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                {isImage(attachment.mime_type) && attachment.thumbnail_url ? (
                  <img
                    src={attachment.thumbnail_url}
                    alt={attachment.original_filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {attachment.original_filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                  {' -- '}
                  {uploaderLabel}
                  {' -- '}
                  {format(parseISO(attachment.created_at), 'MMM d, yyyy')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(attachment)}
                      disabled={downloadingId === attachment.id}
                      aria-label={`Download ${attachment.original_filename}`}
                    >
                      {downloadingId === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>

                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setConfirmDeleteAttachment(attachment)}
                        disabled={deletingId === attachment.id}
                        aria-label={`Delete ${attachment.original_filename}`}
                      >
                        {deletingId === attachment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={confirmDeleteAttachment !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteAttachment(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">
                {confirmDeleteAttachment?.original_filename}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? 'Deleting...' : 'Delete file'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
