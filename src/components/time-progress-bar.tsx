'use client'

import { AlertTriangle } from 'lucide-react'
import { formatDuration } from '@/types/task'
import { Badge } from '@/components/ui/badge'

interface TimeProgressBarProps {
  totalLogged: number
  estimatedHours: number | null
}

export function TimeProgressBar({
  totalLogged,
  estimatedHours,
}: TimeProgressBarProps) {
  const hasEstimate =
    estimatedHours !== null && estimatedHours !== undefined && estimatedHours > 0
  const isOverEstimate = hasEstimate && totalLogged > estimatedHours!
  const percentage = hasEstimate
    ? Math.min(Math.round((totalLogged / estimatedHours!) * 100), 100)
    : 0
  const remaining = hasEstimate ? estimatedHours! - totalLogged : 0

  return (
    <div className="space-y-2">
      {/* Labels row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {formatDuration(totalLogged)} logged
          {hasEstimate && (
            <span className="text-muted-foreground">
              {' '}/ {formatDuration(estimatedHours!)} estimated
            </span>
          )}
        </p>
        {isOverEstimate && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Over estimate
          </Badge>
        )}
      </div>

      {/* Progress bar (only shown when estimate is set) */}
      {hasEstimate && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              isOverEstimate
                ? 'bg-amber-500 dark:bg-amber-600'
                : 'bg-primary'
            }`}
            style={{
              width: `${isOverEstimate ? 100 : percentage}%`,
            }}
          />
        </div>
      )}

      {/* Time remaining (only when estimate is set and not over) */}
      {hasEstimate && !isOverEstimate && remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatDuration(remaining)} remaining
        </p>
      )}

      {/* Over estimate amount */}
      {isOverEstimate && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {formatDuration(totalLogged - estimatedHours!)} over estimate
        </p>
      )}
    </div>
  )
}
