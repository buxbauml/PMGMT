-- Fix infinite recursion in workspace_members RLS policies
--
-- The SELECT policy on workspace_members queries workspace_members itself,
-- and the workspaces SELECT policy also queries workspace_members.
-- This creates a recursive chain when any operation triggers a SELECT on
-- workspace_members. Fix: use a SECURITY DEFINER function to check membership
-- without triggering RLS.

-- 1. Create a helper function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = uid
  );
$$;

-- 2. Create a helper to check admin/owner role (also bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = uid AND role IN ('owner', 'admin')
  );
$$;

-- 3. Fix workspace_members SELECT policy (was self-referencing)
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 4. Fix workspace_members INSERT policy (was also self-referencing)
DROP POLICY IF EXISTS "Service can insert members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can insert own membership" ON public.workspace_members;
CREATE POLICY "Users can insert own membership"
  ON public.workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Fix workspace_members UPDATE policy (also self-referencing)
DROP POLICY IF EXISTS "Members can update own or admin can update others" ON public.workspace_members;
CREATE POLICY "Members can update own or admin can update others"
  ON public.workspace_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

-- 6. Fix workspace_members DELETE policy (also self-referencing)
DROP POLICY IF EXISTS "Owner/admin can remove members" ON public.workspace_members;
CREATE POLICY "Owner/admin can remove members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- 7. Fix workspaces SELECT policy (queries workspace_members which triggers the chain)
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));

-- 8. Fix workspace_invitations policies (also query workspace_members)
DROP POLICY IF EXISTS "Admins can view workspace invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can view workspace invitations"
  ON public.workspace_invitations FOR SELECT
  USING (
    public.is_workspace_admin(workspace_id, auth.uid())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can create invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can create invitations"
  ON public.workspace_invitations FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can update invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can update invitations"
  ON public.workspace_invitations FOR UPDATE
  USING (
    public.is_workspace_admin(workspace_id, auth.uid())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can delete invitations"
  ON public.workspace_invitations FOR DELETE
  USING (public.is_workspace_admin(workspace_id, auth.uid()));
