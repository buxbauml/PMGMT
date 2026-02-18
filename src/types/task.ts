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
  estimated_hours: number | null
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
  estimated_hours?: number | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  assignee_id?: string | null
  sprint_id?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  estimated_hours?: number | null
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

// --- File Attachments (PROJ-8) ---

export interface TaskAttachment {
  id: string
  task_id: string
  workspace_id: string
  original_filename: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_by: string
  created_at: string
  // Joined data
  uploaded_by_name: string | null
  uploaded_by_email: string | null
  thumbnail_url: string | null
}

/** MIME types allowed for file attachments */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
] as const

/** Human-readable file type labels for error messages */
export const ALLOWED_FILE_EXTENSIONS = 'JPG, PNG, GIF, WEBP, PDF, DOCX, TXT, ZIP'

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// --- Time Tracking (PROJ-9) ---

export interface TimeLog {
  id: string
  task_id: string
  workspace_id: string
  user_id: string
  duration: number
  description: string | null
  logged_date: string
  created_at: string
  updated_at: string
  // Joined data
  user_name: string | null
  user_email: string | null
  user_avatar_url: string | null
  // Computed
  is_owner: boolean
}

/**
 * Format decimal hours to a human-readable string.
 * e.g. 1.5 → "1h 30m", 0.25 → "15m", 2 → "2h"
 */
export function formatDuration(hours: number): string {
  if (hours <= 0) return '0m'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
