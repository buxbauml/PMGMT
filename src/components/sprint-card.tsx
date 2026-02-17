'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

import type { Sprint, SprintStatus } from '@/types/sprint'
import { SPRINT_STATUS_LABELS, getDaysRemaining } from '@/types/sprint'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SprintCardProps {
  sprint: Sprint
  projectId: string
}

function SprintStatusBadge({ status }: { status: SprintStatus }) {
  const variants: Record<SprintStatus, string> = {
    upcoming:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    active:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    overdue:
      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    completed:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status]}`}
    >
      {status === 'active' && <Clock className="h-3 w-3" />}
      {status === 'overdue' && <AlertTriangle className="h-3 w-3" />}
      {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'upcoming' && <CalendarDays className="h-3 w-3" />}
      {SPRINT_STATUS_LABELS[status]}
    </span>
  )
}

function DaysRemainingBadge({ endDate }: { endDate: string }) {
  const days = getDaysRemaining(endDate)

  if (days < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Overdue by {Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''}
      </Badge>
    )
  }

  if (days === 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-xs"
      >
        Ends today
      </Badge>
    )
  }

  if (days <= 3) {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-xs"
      >
        {days} day{days !== 1 ? 's' : ''} left
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {days} day{days !== 1 ? 's' : ''} left
    </Badge>
  )
}

export function SprintCard({ sprint, projectId }: SprintCardProps) {
  const progressPercent =
    sprint.total_tasks > 0
      ? Math.round((sprint.completed_tasks / sprint.total_tasks) * 100)
      : 0

  const startFormatted = format(new Date(sprint.start_date), 'MMM d')
  const endFormatted = format(new Date(sprint.end_date), 'MMM d, yyyy')

  return (
    <Link href={`/projects/${projectId}/sprints/${sprint.id}`}>
      <Card className="group transition-colors hover:border-foreground/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{sprint.name}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {startFormatted} &mdash; {endFormatted}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SprintStatusBadge status={sprint.status} />
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Progress bar for active/overdue sprints */}
          {(sprint.status === 'active' || sprint.status === 'overdue') && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {sprint.completed_tasks} of {sprint.total_tasks} tasks{' '}
                  {sprint.total_tasks > 0 && (
                    <span className="font-medium">({progressPercent}%)</span>
                  )}
                </span>
                <DaysRemainingBadge endDate={sprint.end_date} />
              </div>
            </div>
          )}

          {/* Upcoming sprints: show task count */}
          {sprint.status === 'upcoming' && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {sprint.total_tasks} task{sprint.total_tasks !== 1 ? 's' : ''}{' '}
                planned
              </span>
              <DaysRemainingBadge endDate={sprint.start_date} />
            </div>
          )}

          {/* Completed sprints: show final stats */}
          {sprint.status === 'completed' && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {sprint.completed_tasks} of {sprint.total_tasks} tasks
                completed
              </span>
              {sprint.completed_at && (
                <span>
                  Completed{' '}
                  {format(new Date(sprint.completed_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          )}

          {/* Quick stats for active/overdue */}
          {(sprint.status === 'active' || sprint.status === 'overdue') &&
            sprint.total_tasks > 0 && (
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                {sprint.todo_tasks > 0 && (
                  <span>{sprint.todo_tasks} to do</span>
                )}
                {sprint.in_progress_tasks > 0 && (
                  <span>{sprint.in_progress_tasks} in progress</span>
                )}
                {sprint.completed_tasks > 0 && (
                  <span>{sprint.completed_tasks} done</span>
                )}
              </div>
            )}
        </CardContent>
      </Card>
    </Link>
  )
}

export { SprintStatusBadge, DaysRemainingBadge }
