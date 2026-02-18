'use client'

import { useState } from 'react'
import { Clock, Loader2, Plus } from 'lucide-react'

import type { TimeLog } from '@/types/task'
import { useTimeLog } from '@/hooks/useTimeLog'
import { TimeProgressBar } from '@/components/time-progress-bar'
import { TimeLogForm } from '@/components/time-log-form'
import { TimeLogList } from '@/components/time-log-list'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface TimeTrackingSectionProps {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
  estimatedHours: number | null
}

export function TimeTrackingSection({
  workspaceId,
  projectId,
  taskId,
  estimatedHours,
}: TimeTrackingSectionProps) {
  const {
    timeLogs,
    totalLogged,
    loading,
    error,
    createTimeLog,
    updateTimeLog,
    deleteTimeLog,
  } = useTimeLog({ workspaceId, projectId, taskId })

  const [showLogDialog, setShowLogDialog] = useState(false)
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null)

  if (!taskId) return null

  async function handleCreate(values: {
    duration: number
    description?: string
    logged_date: string
  }) {
    const result = await createTimeLog(values)
    return { error: result.error }
  }

  async function handleUpdate(values: {
    duration: number
    description?: string
    logged_date: string
  }) {
    if (!editingLog) return { error: 'No log selected' }
    const result = await updateTimeLog(editingLog.id, values)
    return { error: result.error }
  }

  function handleEdit(log: TimeLog) {
    setEditingLog(log)
  }

  return (
    <div className="space-y-3">
      <Separator />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">
              Time Tracking
              {timeLogs.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({timeLogs.length})
                </span>
              )}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowLogDialog(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Log time
          </Button>
        </div>

        {/* Progress bar */}
        {(totalLogged > 0 || estimatedHours) && (
          <div className="mb-4">
            <TimeProgressBar
              totalLogged={totalLogged}
              estimatedHours={estimatedHours}
            />
          </div>
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

        {/* Time logs list */}
        {!loading && (
          <TimeLogList
            timeLogs={timeLogs}
            onEdit={handleEdit}
            onDelete={deleteTimeLog}
          />
        )}
      </div>

      {/* Log time dialog */}
      <TimeLogForm
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        onSubmit={handleCreate}
      />

      {/* Edit time log dialog */}
      <TimeLogForm
        open={editingLog !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLog(null)
        }}
        editingLog={editingLog}
        onSubmit={handleUpdate}
      />
    </div>
  )
}
