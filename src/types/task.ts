export type TaskStatus = 'to_do' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  project_id: string
  sprint_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  status: TaskStatus
  priority: TaskPriority
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined data
  assignee_name: string | null
  assignee_email: string | null
  assignee_avatar_url: string | null
  created_by_name: string | null
  completed_by_name: string | null
}

export interface CreateTaskInput {
  title: string
  description?: string
  assignee_id?: string | null
  sprint_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  assignee_id?: string | null
  sprint_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

// --- Comments & Activity (PROJ-5) ---

export interface Comment {
  id: string
  task_id: string
  user_id: string
  content: string
  deleted: boolean
  created_at: string
  updated_at: string
  // Joined data
  user_name: string | null
  user_email: string | null
  user_avatar_url: string | null
  // Computed by the frontend - whether current user is the workspace member who wrote it
  is_member: boolean
}

export type ActivityType =
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'completed'
  | 'created'

export interface ActivityLog {
  id: string
  task_id: string
  user_id: string
  activity_type: ActivityType
  old_value: string | null
  new_value: string | null
  created_at: string
  // Joined data
  user_name: string | null
  user_email: string | null
  user_avatar_url: string | null
  is_member: boolean
}

/**
 * A unified timeline item that can be either a comment or an activity log.
 * Sorted chronologically in the activity feed.
 */
export type TimelineItem =
  | { type: 'comment'; data: Comment }
  | { type: 'activity'; data: ActivityLog }

export type ActivityFilter = 'all' | 'comments' | 'activity'
