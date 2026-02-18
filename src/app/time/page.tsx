'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react'

import { formatDuration, type TimeLog } from '@/types/task'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { TimeLogForm } from '@/components/time-log-form'
import { WorkspaceSettings } from '@/components/workspace-settings'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Types for time summary data
interface MyTimeEntry {
  id: string
  duration: number
  description: string | null
  logged_date: string
  task_id: string
  task_title: string
  project_name: string
  project_id: string
}

interface TeamTimeEntry {
  user_id: string
  user_name: string | null
  user_email: string
  total_hours: number
  tasks_worked_on: number
}

type PeriodType = 'daily' | 'weekly' | 'monthly'

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

function getPeriodLabel(date: Date, period: PeriodType): string {
  switch (period) {
    case 'daily':
      return format(date, 'EEEE, MMM d, yyyy')
    case 'weekly': {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      const end = endOfWeek(date, { weekStartsOn: 1 })
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    }
    case 'monthly':
      return format(date, 'MMMM yyyy')
  }
}

function navigatePeriod(date: Date, period: PeriodType, direction: 'prev' | 'next'): Date {
  const fn = direction === 'next'
    ? { daily: addDays, weekly: addWeeks, monthly: addMonths }
    : { daily: subDays, weekly: subWeeks, monthly: subMonths }
  return fn[period](date, 1)
}

export default function TimeSummaryPage() {
  const { isAuthenticated, loading: authLoading, signOut, user } = useAuth()
  const {
    workspaces,
    activeWorkspace,
    activeMembers,
    isOwner,
    isAdmin,
    canManageMembers,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMembers,
    removeMember,
    updateMemberRole,
    transferOwnership,
  } = useWorkspace()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [activeTab, setActiveTab] = useState<'my-time' | 'team-time'>('my-time')
  const [period, setPeriod] = useState<PeriodType>('weekly')
  const [currentDate, setCurrentDate] = useState(new Date())

  // My time data
  const [myTimeEntries, setMyTimeEntries] = useState<MyTimeEntry[]>([])
  const [myTimeLoading, setMyTimeLoading] = useState(false)
  const [myTimeError, setMyTimeError] = useState<string | null>(null)

  // Team time data
  const [teamTimeEntries, setTeamTimeEntries] = useState<TeamTimeEntry[]>([])
  const [teamTimeLoading, setTeamTimeLoading] = useState(false)
  const [teamTimeError, setTeamTimeError] = useState<string | null>(null)

  // Edit/delete state for My Time entries
  const [editingEntry, setEditingEntry] = useState<MyTimeEntry | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<MyTimeEntry | null>(null)

  const showTeamTab = isOwner || isAdmin

  // Fetch my time
  const fetchMyTime = useCallback(async () => {
    if (!activeWorkspace) return
    setMyTimeLoading(true)
    setMyTimeError(null)

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/time-summary?view=personal&period=${period}&date=${format(currentDate, 'yyyy-MM-dd')}`
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setMyTimeError(json.error ?? 'Failed to load time data')
        return
      }
      const json = await res.json()
      setMyTimeEntries(json.data ?? [])
    } catch {
      setMyTimeError('Failed to load time data')
    } finally {
      setMyTimeLoading(false)
    }
  }, [activeWorkspace, currentDate, period])

  // Fetch team time
  const fetchTeamTime = useCallback(async () => {
    if (!activeWorkspace || !showTeamTab) return
    setTeamTimeLoading(true)
    setTeamTimeError(null)

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/time-summary?view=team&period=${period}&date=${format(currentDate, 'yyyy-MM-dd')}`
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setTeamTimeError(json.error ?? 'Failed to load team time data')
        return
      }
      const json = await res.json()
      setTeamTimeEntries(json.data ?? [])
    } catch {
      setTeamTimeError('Failed to load team time data')
    } finally {
      setTeamTimeLoading(false)
    }
  }, [activeWorkspace, currentDate, period, showTeamTab])

  // Edit a time log entry from My Time table
  async function handleEditEntry(values: {
    duration: number
    description?: string
    logged_date: string
  }): Promise<{ error: string | null }> {
    if (!activeWorkspace || !editingEntry) return { error: 'No entry selected' }
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${editingEntry.project_id}/tasks/${editingEntry.task_id}/time-logs/${editingEntry.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        return { error: json.error ?? 'Failed to update time log' }
      }
      // Refresh data
      fetchMyTime()
      return { error: null }
    } catch {
      return { error: 'Failed to update time log' }
    }
  }

  // Delete a time log entry from My Time table
  async function handleDeleteEntry() {
    if (!activeWorkspace || !deletingEntry) return
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/projects/${deletingEntry.project_id}/tasks/${deletingEntry.task_id}/time-logs/${deletingEntry.id}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setMyTimeEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id))
      }
    } finally {
      setDeletingEntry(null)
    }
  }

  useEffect(() => {
    if (activeTab === 'my-time') {
      fetchMyTime()
    } else if (activeTab === 'team-time' && showTeamTab) {
      fetchTeamTime()
    }
  }, [activeTab, fetchMyTime, fetchTeamTime, showTeamTab])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [authLoading, isAuthenticated])

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const myTotalHours = myTimeEntries.reduce((sum, e) => sum + e.duration, 0)
  const myTasksWorkedOn = new Set(myTimeEntries.map((e) => e.task_id)).size

  const teamTotalHours = teamTimeEntries.reduce((sum, e) => sum + e.total_hours, 0)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      {workspaces.length > 0 && (
        <AppHeader
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSwitchWorkspace={switchWorkspace}
          onCreateWorkspace={() => setShowCreateDialog(true)}
          onOpenSettings={() => setShowSettings(true)}
          onSignOut={signOut}
        />
      )}

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-1.5" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to projects
              </Link>
            </Button>
          </div>

          {/* Page header */}
          <div className="mb-6 flex items-center gap-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Time Tracking
            </h1>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'my-time' | 'team-time')}
          >
            <TabsList>
              <TabsTrigger value="my-time">My Time</TabsTrigger>
              {showTeamTab && (
                <TabsTrigger value="team-time">Team Time</TabsTrigger>
              )}
            </TabsList>

            {/* Period filter */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as PeriodType[]).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriod(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setCurrentDate((d) => navigatePeriod(d, period, 'prev'))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous</span>
                </Button>
                <span className="min-w-[200px] text-center text-sm font-medium">
                  {getPeriodLabel(currentDate, period)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setCurrentDate((d) => navigatePeriod(d, period, 'next'))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Today
                </Button>
              </div>
            </div>

            {/* My Time Tab */}
            <TabsContent value="my-time" className="mt-4 space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {myTimeLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        formatDuration(myTotalHours)
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tasks Worked On
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {myTimeLoading ? (
                        <Skeleton className="h-8 w-12" />
                      ) : (
                        myTasksWorkedOn
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Loading */}
              {myTimeLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Error */}
              {myTimeError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {myTimeError}
                </div>
              )}

              {/* Empty state */}
              {!myTimeLoading && !myTimeError && myTimeEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="mb-3 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No time logged for this period
                  </p>
                </div>
              )}

              {/* Time log table */}
              {!myTimeLoading && myTimeEntries.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myTimeEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(entry.logged_date + 'T00:00:00'), 'MMM d')}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/projects/${entry.project_id}`}
                              className="text-sm hover:underline"
                            >
                              {entry.project_name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/projects/${entry.project_id}/tasks/${entry.task_id}`}
                              className="text-sm hover:underline"
                            >
                              {entry.task_title}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatDuration(entry.duration)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {entry.description || '-'}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider delayDuration={300}>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setEditingEntry(entry)
                                        setShowEditDialog(true)
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      <span className="sr-only">Edit</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => setDeletingEntry(entry)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Team Time Tab */}
            {showTeamTab && (
              <TabsContent value="team-time" className="mt-4 space-y-4">
                {/* Summary stat */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Team Total Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {teamTimeLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        formatDuration(teamTotalHours)
                      )}
                    </p>
                  </CardContent>
                </Card>

                {/* Loading */}
                {teamTimeLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Error */}
                {teamTimeError && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {teamTimeError}
                  </div>
                )}

                {/* Empty state */}
                {!teamTimeLoading && !teamTimeError && teamTimeEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No team time logged for this period
                    </p>
                  </div>
                )}

                {/* Team time table */}
                {!teamTimeLoading && teamTimeEntries.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead className="text-right">Total Hours</TableHead>
                          <TableHead className="text-right">Tasks Worked On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTimeEntries.map((entry) => (
                          <TableRow key={entry.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[9px]">
                                    {getInitials(entry.user_name, entry.user_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">
                                  {entry.user_name || entry.user_email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatDuration(entry.total_hours)}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.tasks_worked_on}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Create workspace dialog */}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateWorkspace={async (values) => {
          const result = await createWorkspace(values)
          return { error: result.error }
        }}
      />

      {/* Workspace settings sheet */}
      {activeWorkspace && (
        <WorkspaceSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          workspace={activeWorkspace}
          members={activeMembers}
          isOwner={isOwner}
          canManageMembers={canManageMembers}
          onUpdate={updateWorkspace}
          onDelete={deleteWorkspace}
          onInviteMembers={inviteMembers}
          onRemoveMember={removeMember}
          onUpdateRole={updateMemberRole}
          onTransferOwnership={transferOwnership}
        />
      )}

      {/* Edit time log dialog */}
      <TimeLogForm
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setEditingEntry(null)
        }}
        editingLog={
          editingEntry
            ? ({
                id: editingEntry.id,
                duration: editingEntry.duration,
                description: editingEntry.description,
                logged_date: editingEntry.logged_date,
              } as TimeLog)
            : null
        }
        onSubmit={handleEditEntry}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingEntry}
        onOpenChange={(open) => {
          if (!open) setDeletingEntry(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this{' '}
              {deletingEntry ? formatDuration(deletingEntry.duration) : ''} time
              log entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteEntry}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
