'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, RotateCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ALLOWED_FILE_EXTENSIONS } from '@/types/task'
import type { UploadProgress } from '@/hooks/useAttachment'

interface FileUploadAreaProps {
  onFilesSelected: (files: File[]) => Promise<{ errors?: string[] }>
  uploads: UploadProgress[]
  onRetry?: (uploadId: string) => void
  onDismiss?: (uploadId: string) => void
  disabled?: boolean
}

export function FileUploadArea({
  onFilesSelected,
  uploads,
  onRetry,
  onDismiss,
  disabled = false,
}: FileUploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setValidationErrors([])
      const result = await onFilesSelected(Array.from(files))
      if (result.errors && result.errors.length > 0) {
        setValidationErrors(result.errors)
      }
    },
    [onFilesSelected]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (!disabled) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [disabled, handleFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFiles]
  )

  const isUploading = uploads.some(
    (u) => u.status === 'uploading' || u.status === 'saving'
  )

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
          disabled
            ? 'cursor-not-allowed border-muted bg-muted/30'
            : isDragOver
              ? 'border-primary bg-primary/5'
              : 'cursor-pointer border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        }`}
        onClick={() => {
          if (!disabled && !isUploading) {
            fileInputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled && !isUploading) {
              fileInputRef.current?.click()
            }
          }
        }}
        aria-label="Upload files by clicking or dragging"
      >
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragOver ? (
            'Drop files here'
          ) : (
            <>
              Drag & drop files or{' '}
              <span className="font-medium text-primary">browse</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {ALLOWED_FILE_EXTENSIONS} -- Max 10 MB per file
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.txt,.zip"
        />
      </div>

      {/* Upload progress indicators */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
            >
              {upload.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : upload.status === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{upload.fileName}</p>
                {upload.status === 'uploading' && (
                  <>
                    <Progress value={upload.progress} className="mt-1 h-1.5" />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Uploading... {upload.progress}%
                    </p>
                  </>
                )}
                {upload.status === 'saving' && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Saving...
                  </p>
                )}
                {upload.status === 'error' && upload.error && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {upload.error}
                  </p>
                )}
              </div>
              {/* Retry and dismiss buttons for failed uploads */}
              {upload.status === 'error' && (
                <div className="flex shrink-0 items-center gap-1">
                  {upload.file && onRetry && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onRetry(upload.id)}
                      aria-label={`Retry uploading ${upload.fileName}`}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDismiss(upload.id)}
                      aria-label={`Dismiss ${upload.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
