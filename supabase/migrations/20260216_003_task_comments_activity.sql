-- PROJ-5: Task Comments and Activity - Database Schema
-- Run this migration in Supabase SQL Editor (after 20260216_002_task_management.sql)

-- ============================================================
-- 1. COMMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ACTIVITY LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('created', 'status_changed', 'assigned', 'unassigned', 'completed')),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. INDEXES - COMMENTS
-- ============================================================

-- Primary lookup: comments by task (used on every task detail page load)
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments(task_id);

-- Secondary: comments by user (useful for "my comments" queries)
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- Composite: task + created_at for chronological listing
CREATE INDEX IF NOT EXISTS idx_comments_task_created ON public.comments(task_id, created_at ASC);

-- ============================================================
-- 4. INDEXES - ACTIVITY LOGS
-- ============================================================

-- Primary lookup: activity by task (used on every task detail page load)
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON public.activity_logs(task_id);

-- Secondary: activity by user (useful for "my activity" queries)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- Composite: task + created_at for chronological listing
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_created ON public.activity_logs(task_id, created_at ASC);

-- Activity type filter
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.activity_logs(activity_type);

-- ============================================================
-- 5. RLS POLICIES - COMMENTS
-- ============================================================

-- Workspace members can view comments on tasks in their workspace's projects
CREATE POLICY "Workspace members can view comments"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = comments.task_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can insert comments on tasks in their workspace's projects
CREATE POLICY "Workspace members can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = comments.task_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Comment author or workspace admin/owner can update comments
-- (author: edit within 15-min window; admin/owner: soft-delete via UPDATE)
CREATE POLICY "Author or admin can update comments"
  ON public.comments FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = comments.task_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Comment author or workspace admin/owner can delete (soft-delete) comments
CREATE POLICY "Author or admin can delete comments"
  ON public.comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = comments.task_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 6. RLS POLICIES - ACTIVITY LOGS
-- ============================================================

-- Workspace members can view activity logs for tasks in their workspace's projects
CREATE POLICY "Workspace members can view activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = activity_logs.task_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can insert activity logs for tasks in their workspace's projects
CREATE POLICY "Workspace members can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.projects ON projects.id = tasks.project_id
      JOIN public.workspace_members ON workspace_members.workspace_id = projects.workspace_id
      WHERE tasks.id = activity_logs.task_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Activity logs are immutable - no UPDATE or DELETE policies
-- (activity history should never be modified)

-- ============================================================
-- 7. UPDATED_AT TRIGGER FOR COMMENTS
-- ============================================================

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
