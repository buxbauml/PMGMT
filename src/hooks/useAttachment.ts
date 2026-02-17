'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { TaskAttachment } from '@/types/task'
import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } from '@/types/task'

export interface UploadProgress {
  id: string
  fileName: string
  progress: number // 0-100 (real progress via XHR)
  status: 'uploading' | 'saving' | 'done' | 'error'
  error?: string
  file?: File // stored for retry
}

interface UseAttachmentOptions {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
}

/**
 * Upload a file to Supabase Storage using XMLHttpRequest for real progress tracking.
 * Returns a promise that resolves with an error (or null on success).
 */
function uploadToStorageWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
  options?: { cacheControl?: string; upsert?: boolean }
): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const token = sessionData?.session?.access_token
      if (!token) {
        resolve({ error: 'Not authenticated' })
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`

      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('x-upsert', String(options?.upsert ?? false))
      if (options?.cacheControl) {
        xhr.setRequestHeader('cache-control', `max-age=${options.cacheControl}`)
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ error: null })
        } else {
          let message = 'Upload failed'
          try {
            const body = JSON.parse(xhr.responseText)
            message = body.message || body.error || body.statusCode || message
          } catch {
            // ignore parse error
          }
          resolve({ error: String(message) })
        }
      }

      xhr.onerror = () => {
        resolve({ error: 'Network error' })
      }

      xhr.send(file)
    })
  })
}

export function useAttachment({
  workspaceId,
  projectId,
  taskId,
}: UseAttachmentOptions) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<UploadProgress[]>([])

  const basePath =
    workspaceId && projectId && taskId
      ? `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`
      : null

  // Fetch attachments for a task
  const fetchAttachments = useCallback(async () => {
    if (!basePath) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/attachments`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to load attachments')
        return
      }
      const json = await res.json()
      setAttachments(json.data ?? [])
    } catch {
      setError('Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    if (basePath) {
      fetchAttachments()
    } else {
      setAttachments([])
    }
  }, [basePath, fetchAttachments])

  /**
   * Validate a file before upload.
   * Returns an error message or null if valid.
   */
  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      return `"${file.name}" has an unsupported file type. Allowed: ${ALLOWED_FILE_EXTENSIONS}.`
    }
    return null
  }

  /**
   * Upload one or more files to the task.
   * Returns an object with successful uploads and validation errors.
   */
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!basePath || !workspaceId || !taskId) {
        return { errors: ['Missing workspace or task context'] }
      }

      const validationErrors: string[] = []
      const validFiles: File[] = []

      for (const file of files) {
        const err = validateFile(file)
        if (err) {
          validationErrors.push(err)
        } else {
          validFiles.push(file)
        }
      }

      if (validFiles.length === 0) {
        return { errors: validationErrors }
      }

      // Initialize upload progress entries (append to existing)
      const newEntries: UploadProgress[] = validFiles.map((f, i) => ({
        id: `${Date.now()}-${i}`,
        fileName: f.name,
        progress: 0,
        status: 'uploading',
        file: f,
      }))
      setUploads((prev) => [...prev.filter((u) => u.status === 'error'), ...newEntries])

      const newAttachments: TaskAttachment[] = []
      const uploadErrors: string[] = [...validationErrors]

      // Upload files in parallel
      await Promise.all(
        validFiles.map(async (file, index) => {
          const entryId = newEntries[index].id
          try {
            // Generate a unique storage path
            const timestamp = Date.now()
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `${workspaceId}/${taskId}/${timestamp}_${safeName}`

            // Upload to Supabase Storage with real progress tracking
            const { error: uploadError } = await uploadToStorageWithProgress(
              'task-attachments',
              storagePath,
              file,
              (percent) => {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === entryId ? { ...u, progress: percent } : u
                  )
                )
              },
              { cacheControl: '3600', upsert: false }
            )

            if (uploadError) {
              // Check for quota/storage errors
              const errorMsg = uploadError.toLowerCase()
              let displayError = uploadError
              if (errorMsg.includes('quota') || errorMsg.includes('storage limit') || errorMsg.includes('payload too large')) {
                displayError = 'Storage limit reached. Contact your workspace admin to upgrade the plan.'
              }

              setUploads((prev) =>
                prev.map((u) =>
                  u.id === entryId
                    ? { ...u, status: 'error', error: displayError }
                    : u
                )
              )
              uploadErrors.push(`Failed to upload "${file.name}": ${displayError}`)
              return
            }

            // Update progress to saving metadata
            setUploads((prev) =>
              prev.map((u) =>
                u.id === entryId ? { ...u, progress: 100, status: 'saving' } : u
              )
            )

            // Save attachment record via API
            const res = await fetch(`${basePath}/attachments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                original_filename: file.name,
                file_size: file.size,
                mime_type: file.type,
                storage_path: storagePath,
              }),
            })

            const json = await res.json()

            if (!res.ok) {
              // Clean up the uploaded file since metadata save failed
              await supabase.storage
                .from('task-attachments')
                .remove([storagePath])

              setUploads((prev) =>
                prev.map((u) =>
                  u.id === entryId
                    ? { ...u, status: 'error', error: json.error ?? 'Failed to save' }
                    : u
                )
              )
              uploadErrors.push(
                `Failed to save "${file.name}": ${json.error ?? 'Unknown error'}`
              )
              return
            }

            const attachment: TaskAttachment = json.data
            newAttachments.push(attachment)

            // Mark as done
            setUploads((prev) =>
              prev.map((u) =>
                u.id === entryId ? { ...u, progress: 100, status: 'done', file: undefined } : u
              )
            )
          } catch {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === entryId
                  ? { ...u, status: 'error', error: 'Network error. Check your connection and try again.' }
                  : u
              )
            )
            uploadErrors.push(`Failed to upload "${file.name}": Network error`)
          }
        })
      )

      // Update attachments list with new ones
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments])
      }

      // Auto-clear only successful uploads after a short delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status !== 'done'))
      }, 2000)

      return {
        errors: uploadErrors.length > 0 ? uploadErrors : undefined,
      }
    },
    [basePath, workspaceId, taskId]
  )

  /**
   * Retry a failed upload by its ID.
   */
  const retryUpload = useCallback(
    async (uploadId: string) => {
      const entry = uploads.find((u) => u.id === uploadId)
      if (!entry?.file) return

      const file = entry.file
      // Remove the failed entry
      setUploads((prev) => prev.filter((u) => u.id !== uploadId))
      // Re-upload the file
      await uploadFiles([file])
    },
    [uploads, uploadFiles]
  )

  /**
   * Dismiss a failed upload by its ID.
   */
  const dismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId))
  }, [])

  /**
   * Delete an attachment (file and metadata).
   */
  const deleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!basePath) return { error: 'Missing context' }

      try {
        const res = await fetch(`${basePath}/attachments/${attachmentId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          return { error: json.error ?? 'Failed to delete attachment' }
        }

        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
        return { error: null }
      } catch {
        return { error: 'Failed to delete attachment' }
      }
    },
    [basePath]
  )

  /**
   * Get a download URL for an attachment.
   * Uses signed URLs with 1-hour expiration.
   */
  const getDownloadUrl = useCallback(
    async (storagePath: string) => {
      const { data, error: signError } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(storagePath, 60 * 60) // 1 hour

      if (signError || !data?.signedUrl) {
        return { url: null, error: signError?.message ?? 'Failed to generate download URL' }
      }

      return { url: data.signedUrl, error: null }
    },
    []
  )

  return {
    attachments,
    loading,
    error,
    uploads,
    uploadFiles,
    retryUpload,
    dismissUpload,
    deleteAttachment,
    getDownloadUrl,
    refetch: fetchAttachments,
  }
}

/** Format file size in human-readable format */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
