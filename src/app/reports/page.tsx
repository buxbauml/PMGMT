'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useProject } from '@/hooks/useProject'
import { formatDuration } from '@/types/task'

import { AppHeader } from '@/components/app-header'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { ReportStatCard } from '@/components/report-stat-card'
import { ReportStatusChart } from '@/components/report-status-chart'
import { ReportAssigneeChart } from '@/components/report-assignee-chart'
import { ReportTrendChart } from '@/components/report-trend-chart'
import { ReportBurndownChart } from '@/components/report-burndown-chart'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// Types for the reports API response
interface ReportData {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  todoTasks: number
  completionRate: number
  velocity: number | null
  totalHoursLogged: number | null
  avgTimePerTask: number | null
  statusBreakdown: { name: string; value: number }[]
  assigneeBreakdown: { name: string; tasks: number }[]
  completionTrend: { week: string; completed: number }[]
  burndown: {
    sprintName: string
    data: { date: string; ideal: number; actual: number }[]
  } | null
}

// Date range presets
const DATE_RANGES = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
] as const

function getDateRange(preset: string): { startDate: string | null; endDate: string | null } {
  if (preset === 'all') return { startDate: null, endDate: null }
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const start = new Date(now)
  start.setDate(now.getDate() - days)
  return { startDate: start.toISOString().split('T')[0], endDate: end }
}

export default function ReportsPage() {
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

  const {
    allProjects,
  } = useProject(activeWorkspace?.id ?? null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all')

  // Report data
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Export state
  const [exporting, setExporting] = useState(false)

  const canExport = isOwner || isAdmin

  // Fetch report data
  const fetchReports = useCallback(async () => {
    if (!activeWorkspace) return
    setReportLoading(true)
    setReportError(null)

    try {
      const params = new URLSearchParams()
      if (selectedProjectId !== 'all') {
        params.set('projectId', selectedProjectId)
      }
      const { startDate, endDate } = getDateRange(selectedDateRange)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/reports?${params.toString()}`
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setReportError(json.error ?? 'Failed to load report data')
        return
      }

      const json = await res.json()
      setReportData(json.data ?? null)
    } catch {
      setReportError('Failed to load report data')
    } finally {
      setReportLoading(false)
    }
  }, [activeWorkspace, selectedProjectId, selectedDateRange])

  // Fetch reports when workspace or filter changes
  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Handle CSV export
  async function handleExport() {
    if (!activeWorkspace || !canExport) return
    setExporting(true)

    try {
      const params = new URLSearchParams()
      if (selectedProjectId !== 'all') {
        params.set('projectId', selectedProjectId)
      }

      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/reports/export?${params.toString()}`
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Failed to export report')
        return
      }

      // Download the CSV file
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${activeWorkspace.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Report exported successfully')
    } catch {
      toast.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

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

  // Non-archived projects for the filter
  const filterProjects = allProjects.filter((p) => !p.archived)

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

          {/* Page header with filter and export */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Reports
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Date range filter */}
              <Select
                value={selectedDateRange}
                onValueChange={setSelectedDateRange}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Project filter */}
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {filterProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export button (admin/owner only) */}
              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || reportLoading}
                  className="gap-1.5"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Error state */}
          {reportError && (
            <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {reportError}
            </div>
          )}

          {/* Stats overview row */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ReportStatCard
              label="Total Tasks"
              value={reportData?.totalTasks ?? 0}
              loading={reportLoading}
            />
            <ReportStatCard
              label="Completion Rate"
              value={
                reportData
                  ? `${reportData.completionRate}%`
                  : '0%'
              }
              subtitle={
                reportData
                  ? `${reportData.completedTasks} of ${reportData.totalTasks} tasks`
                  : undefined
              }
              progress={reportData?.completionRate ?? 0}
              loading={reportLoading}
            />
            <ReportStatCard
              label="Avg Velocity"
              value={
                reportData?.velocity !== null && reportData?.velocity !== undefined
                  ? `${reportData.velocity} tasks/sprint`
                  : 'N/A'
              }
              subtitle={
                reportData?.velocity !== null && reportData?.velocity !== undefined
                  ? 'Based on last 5 sprints'
                  : 'No completed sprints yet'
              }
              loading={reportLoading}
            />
            <ReportStatCard
              label="Hours Logged"
              value={
                reportData?.totalHoursLogged !== null && reportData?.totalHoursLogged !== undefined
                  ? formatDuration(reportData.totalHoursLogged)
                  : 'N/A'
              }
              subtitle={
                reportData?.totalHoursLogged !== null && reportData?.totalHoursLogged !== undefined
                  ? reportData.avgTimePerTask !== null && reportData.avgTimePerTask !== undefined
                    ? `Avg ${formatDuration(reportData.avgTimePerTask)} per task`
                    : 'From time tracking'
                  : 'No time logs yet'
              }
              loading={reportLoading}
            />
          </div>

          {/* Charts row: Status pie + Assignee bar */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReportStatusChart
              data={reportData?.statusBreakdown ?? []}
              loading={reportLoading}
            />
            <ReportAssigneeChart
              data={reportData?.assigneeBreakdown ?? []}
              loading={reportLoading}
            />
          </div>

          {/* Completion trend line chart */}
          <div className="mb-6">
            <ReportTrendChart
              data={reportData?.completionTrend ?? []}
              loading={reportLoading}
            />
          </div>

          {/* Sprint burndown (only shown if active sprint exists) */}
          {reportData?.burndown && (
            <div className="mb-6">
              <ReportBurndownChart
                sprintName={reportData.burndown.sprintName}
                data={reportData.burndown.data}
                loading={reportLoading}
              />
            </div>
          )}

          {/* Empty state when no tasks at all */}
          {!reportLoading && !reportError && reportData?.totalTasks === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
              <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium">No data to display yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start creating tasks in your projects to see reports here.
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/">Go to projects</Link>
              </Button>
            </div>
          )}
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
    </div>
  )
}
