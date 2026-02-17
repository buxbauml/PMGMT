'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentFormProps {
  userName: string | null
  userEmail: string | null
  onSubmit: (content: string) => Promise<{ data: unknown; error: string | null }>
}

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

const MAX_CHARS = 2000

export function CommentForm({ userName, userEmail, onSubmit }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedContent = content.trim()
  const charCount = trimmedContent.length
  const isValid = charCount > 0 && charCount <= MAX_CHARS

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await onSubmit(trimmedContent)
      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(userName, userEmail)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
            aria-label="Comment text"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs ${
                  charCount > MAX_CHARS
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {charCount} / {MAX_CHARS}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Comment'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
