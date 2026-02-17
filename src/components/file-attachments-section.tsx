'use client'

import { Paperclip, Loader2 } from 'lucide-react'

import { useAttachment } from '@/hooks/useAttachment'
import { FileUploadArea } from '@/components/file-upload-area'
import { AttachedFilesList } from '@/components/attached-files-list'
import { Separator } from '@/components/ui/separator'

interface FileAttachmentsSectionProps {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
  currentUserId?: string
  isAdmin: boolean
  disabled?: boolean
}

export function FileAttachmentsSection({
  workspaceId,
  projectId,
  taskId,
  currentUserId,
  isAdmin,
  disabled = false,
}: FileAttachmentsSectionProps) {
  const {
    attachments,
    loading,
    error,
    uploads,
    uploadFiles,
    retryUpload,
    dismissUpload,
    deleteAttachment,
    getDownloadUrl,
  } = useAttachment({ workspaceId, projectId, taskId })

  // Don't render if no task is selected
  if (!taskId) return null

  return (
    <div className="space-y-3">
      <Separator />

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Attachments
            {attachments.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                ({attachments.length})
              </span>
            )}
          </h3>
        </div>

        {/* Upload area */}
        {!disabled && (
          <FileUploadArea
            onFilesSelected={uploadFiles}
            uploads={uploads}
            onRetry={retryUpload}
            onDismiss={dismissUpload}
            disabled={disabled}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Attached files list */}
        {!loading && (
          <div className={attachments.length > 0 && !disabled ? 'mt-3' : ''}>
            <AttachedFilesList
              attachments={attachments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={deleteAttachment}
              onDownload={getDownloadUrl}
            />
          </div>
        )}
      </div>
    </div>
  )
}
