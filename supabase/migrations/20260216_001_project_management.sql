-- PROJ-3: Project Creation and Management - Database Schema
-- Run this migration in Supabase SQL Editor (after 20260215_001_workspace_management.sql)

-- ============================================================
-- 1. PROJECTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  start_date DATE,
  end_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Ensure end_date >= start_date when both are set
  CONSTRAINT check_dates CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  )
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON public.projects(archived);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_archived ON public.projects(workspace_id, archived);

-- ============================================================
-- 2. RLS POLICIES - PROJECTS
-- ============================================================

-- Any workspace member can view projects in their workspaces
CREATE POLICY "Workspace members can view projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = projects.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Any workspace member can create projects
CREATE POLICY "Workspace members can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = projects.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Any workspace member can update projects (name, description, dates)
-- Archive permission is enforced at the API layer (admin/owner only)
CREATE POLICY "Workspace members can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = projects.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Any workspace member can delete projects
-- The "only if 0 tasks" rule is enforced at the API layer
CREATE POLICY "Workspace members can delete projects"
  ON public.projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = projects.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
