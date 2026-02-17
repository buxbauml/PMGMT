export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  archived: boolean
  created_at: string
  updated_at: string
  // Calculated fields (from task counts)
  total_tasks: number
  completed_tasks: number
}

export interface CreateProjectInput {
  name: string
  description?: string
  start_date?: string
  end_date?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
}
