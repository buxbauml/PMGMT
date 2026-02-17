-- PROJ-6: Sprint Planning - Database Schema
-- Run this migration in Supabase SQL Editor (after 20260216_002_task_management.sql)

-- ============================================================
-- 1. SPRINTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Enforce end_date > start_date at the database level
  CONSTRAINT sprints_date_order CHECK (end_date > start_date)
);

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. INDEXES - SPRINTS
-- ============================================================

-- Core lookups
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON public.sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_workspace_id ON public.sprints(workspace_id);

-- Filtering by date range (for active/upcoming/overdue queries)
CREATE INDEX IF NOT EXISTS idx_sprints_start_date ON public.sprints(start_date);
CREATE INDEX IF NOT EXISTS idx_sprints_end_date ON public.sprints(end_date);

-- Filtering by completion status
CREATE INDEX IF NOT EXISTS idx_sprints_completed ON public.sprints(completed);

-- Composite: project + date ordering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_sprints_project_start ON public.sprints(project_id, start_date);

-- Created by (for creator lookup)
CREATE INDEX IF NOT EXISTS idx_sprints_created_by ON public.sprints(created_by);

-- ============================================================
-- 3. ADD sprint_id TO TASKS TABLE
-- ============================================================

-- Add nullable sprint_id column to tasks (null = backlog)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;

-- Index for querying tasks by sprint
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON public.tasks(sprint_id);

-- Composite: sprint + status (for progress calculation queries)
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_status ON public.tasks(sprint_id, status);

-- ============================================================
-- 4. RLS POLICIES - SPRINTS
-- ============================================================

-- Workspace members can view sprints in their workspace's projects
CREATE POLICY "Workspace members can view sprints"
  ON public.sprints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = sprints.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Only workspace admins/owners can create sprints
CREATE POLICY "Admins can create sprints"
  ON public.sprints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = sprints.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
    AND created_by = auth.uid()
  );

-- Only workspace admins/owners can update sprints
CREATE POLICY "Admins can update sprints"
  ON public.sprints FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = sprints.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Only workspace admins/owners can delete sprints
CREATE POLICY "Admins can delete sprints"
  ON public.sprints FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = sprints.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER update_sprints_updated_at
  BEFORE UPDATE ON public.sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
