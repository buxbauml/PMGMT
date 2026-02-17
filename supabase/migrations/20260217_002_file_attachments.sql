-- PROJ-8: File Attachments - Database Schema
-- Run this migration in Supabase SQL Editor (after 20260217_001_sprint_planning.sql)

-- ============================================================
-- 1. TASK ATTACHMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- max 10 MB
  mime_type TEXT NOT NULL CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip'
  )),
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_workspace_id ON public.task_attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON public.task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(task_id, created_at DESC);

-- ============================================================
-- 3. RLS POLICIES - TASK ATTACHMENTS TABLE
-- ============================================================

-- Workspace members can view attachments in their workspace
CREATE POLICY "Workspace members can view attachments"
  ON public.task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = task_attachments.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can upload attachments (must set uploaded_by to own user id)
CREATE POLICY "Workspace members can insert attachments"
  ON public.task_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = task_attachments.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Uploaders can delete their own attachments; admins/owners can delete any
CREATE POLICY "Uploaders and admins can delete attachments"
  ON public.task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = task_attachments.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 4. SUPABASE STORAGE BUCKET (private - signed URLs only)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. STORAGE POLICIES
-- ============================================================
-- Storage paths follow the pattern: {workspace_id}/{task_id}/{timestamp}_{filename}
-- We use storage.foldername(name)[1] to extract the workspace_id from the path.

-- Workspace members can upload files to their workspace folder
CREATE POLICY "Workspace members can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = (storage.foldername(name))[1]::uuid
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can read files in their workspace folder (for signed URLs)
CREATE POLICY "Workspace members can read files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = (storage.foldername(name))[1]::uuid
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members can delete files in their workspace folder
-- (API layer enforces uploader-or-admin permission)
CREATE POLICY "Workspace members can delete files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = (storage.foldername(name))[1]::uuid
        AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. ATTACHMENT LIMIT PER TASK
-- ============================================================
-- Enforce max 50 attachments per task at the database level
CREATE OR REPLACE FUNCTION check_attachment_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.task_attachments WHERE task_id = NEW.task_id) >= 50 THEN
    RAISE EXCEPTION 'Maximum of 50 attachments per task reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_attachment_limit
  BEFORE INSERT ON public.task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION check_attachment_limit();
