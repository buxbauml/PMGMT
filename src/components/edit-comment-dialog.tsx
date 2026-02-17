'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import type { Comment } from '@/types/task'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EditCommentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comment: Comment | null
  onSave: (
    commentId: string,
    content: string
  ) => Promise<{ data: unknown; error: string | null }>
}

const MAX_CHARS = 2000

export function EditCommentDialog({
  open,
  onOpenChange,
  comment,
  onSave,
}: EditCommentDialogProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when comment changes
  useEffect(() => {
    if (comment) {
      setContent(comment.content)
      setError(null)
    }
  }, [comment])

  const trimmedContent = content.trim()
  const charCount = trimmedContent.length
  const isValid = charCount > 0 && charCount <= MAX_CHARS
  const hasChanges = comment ? trimmedContent !== comment.content : false

  async function handleSave() {
    if (!comment || !isValid || !hasChanges || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await onSave(comment.id, trimmedContent)
      if (result.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setContent('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit comment</DialogTitle>
          <DialogDescription>
            Update your comment. You can edit comments within 15 minutes of posting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isSubmitting}
            aria-label="Edit comment text"
          />
          <div className="flex justify-end">
            <span
              className={`text-xs ${
                charCount > MAX_CHARS
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              {charCount} / {MAX_CHARS}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || !hasChanges || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
