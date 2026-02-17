-- PROJ-4: Task Management - Database Schema
-- Run this migration in Supabase SQL Editor (after 20260216_001_project_management.sql)

-- ============================================================
-- 1. TASKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('to_do', 'in_progress', 'done')) DEFAULT 'to_do',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Core lookup: tasks by project
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- Filtering indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);

-- Composite index for common query: tasks in a project filtered by status
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON public.tasks(project_id, status);

-- ============================================================
-- 3. RLS POLICIES - TASKS
-- ============================================================

-- Workspace members can view tasks in their workspace's projects
CREATE POLICY "Workspace members can view tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE projects.id = tasks.project_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can create tasks in their workspace's projects
CREATE POLICY "Workspace members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE projects.id = tasks.project_id
        AND workspace_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Workspace members can update tasks in their workspace's projects
CREATE POLICY "Workspace members can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE projects.id = tasks.project_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Task creator can delete their own tasks, workspace admins/owners can delete any
CREATE POLICY "Creator or admin can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    -- Task creator can delete own tasks
    created_by = auth.uid()
    OR
    -- Workspace admin/owner can delete any task in their workspace
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE projects.id = tasks.project_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
