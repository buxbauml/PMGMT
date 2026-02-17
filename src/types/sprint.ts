export type SprintStatus = 'upcoming' | 'active' | 'overdue' | 'completed'

export interface Sprint {
  id: string
  workspace_id: string
  project_id: string
  name: string
  start_date: string
  end_date: string
  completed: boolean
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Computed
  status: SprintStatus
  // Aggregated task counts (provided by API)
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  todo_tasks: number
  // Joined data
  completed_by_name: string | null
  created_by_name: string | null
}

export interface CreateSprintInput {
  name: string
  start_date: string
  end_date: string
}

export interface UpdateSprintInput {
  name?: string
  start_date?: string
  end_date?: string
  completed?: boolean
}

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  overdue: 'Overdue',
  completed: 'Completed',
}

/**
 * Compute the sprint status from dates and completed flag.
 * Status is derived at read time, not stored in the database.
 */
export function computeSprintStatus(
  startDate: string,
  endDate: string,
  completed: boolean
): SprintStatus {
  if (completed) return 'completed'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  if (start > today) return 'upcoming'
  if (end < today) return 'overdue'
  return 'active'
}

/**
 * Calculate days remaining (positive) or overdue (negative) from today to end date.
 */
export function getDaysRemaining(endDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const diffMs = end.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}
