-- PROJ-9: Time Tracking

ALTER TABLE tasks ADD COLUMN estimated_hours DECIMAL CHECK (estimated_hours > 0 AND estimated_hours <= 999);

CREATE TABLE time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration DECIMAL NOT NULL CHECK (duration > 0 AND duration <= 24),
  description TEXT CHECK (char_length(description) <= 500),
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read time logs"
  ON time_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = time_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can create time logs"
  ON time_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = time_logs.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own time logs"
  ON time_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own time logs"
  ON time_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_time_logs_task_id ON time_logs(task_id);
CREATE INDEX idx_time_logs_summary ON time_logs(workspace_id, user_id, logged_date);

CREATE OR REPLACE FUNCTION update_time_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_logs_updated_at
  BEFORE UPDATE ON time_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_time_logs_updated_at();
