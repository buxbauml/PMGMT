# PROJ-9: Time Tracking

## Status: In Progress
**Created:** 2026-02-14
**Last Updated:** 2026-02-18

## Dependencies
- Requires: PROJ-4 (Task Management) - time is tracked per task

## User Stories
- As a workspace member, I want to log time spent on tasks so that I can track effort
- As a task creator, I want to set time estimates so that I can plan capacity
- As a workspace member, I want to see total time logged vs. estimated so that I know if we're over budget
- As a workspace member, I want to view my time logs so that I can review what I worked on
- As a workspace admin, I want to see team time summary so that I can understand capacity utilization

## Acceptance Criteria
- [ ] User can add time estimate to task (in hours, 0.5 increments)
- [ ] User can log time spent on task with description and duration
- [ ] Time log requires duration (in hours) and optional description
- [ ] Task detail shows total time logged vs. estimate
- [ ] Task detail shows list of all time logs with user, date, duration, and description
- [ ] User can edit or delete their own time logs
- [ ] User can view personal time log summary (daily, weekly, monthly)
- [ ] Workspace admin can view team time summary showing total hours per member
- [ ] Task shows time remaining (estimate - logged)
- [ ] Tasks going over estimate show visual warning

## Edge Cases
- What happens if task has no estimate but time is logged? → Show logged time only, no comparison
- What happens if logged time exceeds estimate? → Show warning badge, don't block logging
- What happens if user logs time on completed task? → Allow it, time can be logged retroactively
- What happens if time log is deleted? → Recalculate total logged time, update task display
- What happens if user sets estimate to 0? → Treat as "no estimate", allow time logging
- What happens if user tries to log negative or zero hours? → Show validation error "Duration must be positive"

## Technical Requirements
- **Database:** Time_logs table with task_id and user_id foreign keys, tasks.estimated_hours column, RLS policies
- **Permissions:** All workspace members can log time on tasks, only log owners can edit/delete
- **Performance:** Time log list load < 200ms, summary calculation < 500ms
- **Validation:** Duration must be positive number, max 24 hours per log entry
- **Duration Format:** Decimal hours (e.g., 1.5 = 1 hour 30 minutes)
- **Aggregation:** Calculate total_logged = SUM(time_logs.duration) for each task

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
Time Tracking extends the existing task system with two capabilities: (1) **effort estimation** — setting expected hours on a task, and (2) **time logging** — recording actual hours worked with notes. A new summary page lets members review their own time and lets admins see team utilization.

The pattern closely mirrors PROJ-5 (Comments) and PROJ-8 (File Attachments) — a list of user-owned records attached to tasks, with add/edit/delete and RLS-based access control. No new third-party packages are required.

---

### Component Structure

#### Task Detail Page (additions to existing page)

```
Task Detail Page
+-- [existing: Title, Status, Assignee, etc.]
+-- Time Tracking Section  (NEW — between description and file attachments)
|   +-- Time Progress Bar
|   |   +-- "Xh logged / Yh estimated" label
|   |   +-- Progress bar (fills based on logged/estimated ratio)
|   |   +-- Over-estimate warning badge (amber, only when logged > estimated)
|   |   +-- Time Remaining label (only when estimate is set)
|   +-- "Log Time" Button → opens Log Time Dialog
|   +-- Time Logs List
|       +-- Time Log Item (per log entry)
|           +-- Duration (e.g., "1h 30m")
|           +-- Description (optional)
|           +-- User avatar + name
|           +-- Date logged
|           +-- Edit button (own logs only) → Edit Log Dialog
|           +-- Delete button (own logs only) → Confirmation
+-- [existing: File Attachments]
+-- [existing: Activity Feed]
```

#### Task Create / Edit Dialog (additions to existing dialogs)

```
Create Task Dialog / Edit Task Dialog
+-- [existing: Title, Description, Status, etc.]
+-- Time Estimate Field  (NEW)
    +-- Number input (decimal, 0.5 increments, max 999)
    +-- Label: "Estimated Hours (e.g. 1.5 = 1h 30m)"
    +-- Clear button (sets estimate to null / "no estimate")
```

#### Log Time Dialog (new modal)

```
Log Time Dialog
+-- Duration input (decimal hours, required, max 24)
|   e.g. "1.5" → displayed as "1h 30m"
+-- Description textarea (optional, max 500 chars)
+-- Date picker (defaults to today, can backdate)
+-- Save / Cancel buttons
```

#### Time Summary Page (new page at `/time`)

```
Time Summary Page
+-- Page Header: "Time Tracking"
+-- View Toggle Tabs
|   +-- "My Time" tab (all members)
|   +-- "Team Time" tab (admins only — hidden for regular members)
+-- Period Filter
|   +-- Daily / Weekly / Monthly selector
|   +-- Date navigation (prev/next arrows, current period label)
+-- Summary Stats Row
|   +-- Total hours in selected period
|   +-- Number of tasks worked on
+-- Time Log Table
    +-- [My Time view] Date | Project | Task | Duration | Description | Actions (edit/delete)
    +-- [Team Time view] Member | Total Hours | Tasks Worked On  (aggregated, no edit/delete)
```

---

### Data Model

#### New column: `tasks.estimated_hours`
Added to the existing `tasks` table.
```
tasks
+-- estimated_hours  (decimal, nullable — null means "no estimate set")
                     (max 999 hours; 0 treated same as null)
```

#### New table: `time_logs`
```
time_logs
+-- id              (UUID, primary key)
+-- task_id         (UUID → tasks.id, cascades on task delete)
+-- workspace_id    (UUID → workspaces.id, for RLS scoping)
+-- user_id         (UUID → auth.users.id)
+-- duration        (decimal, required — in hours, e.g. 1.5)
+-- description     (text, optional — max 500 characters)
+-- logged_date     (date — the day the work was done, defaults to today)
+-- created_at      (timestamp)
+-- updated_at      (timestamp)
```

**Indexes:** `task_id` (for task detail load), `(workspace_id, user_id, logged_date)` (for summary page filtering).

**RLS Policies:**
- Any workspace member can **read** time logs for tasks in their workspace
- Any workspace member can **create** time logs on tasks in their workspace
- Only the **log owner** can update or delete their own logs
- Admins can **read** all logs in their workspace (for team summary)

---

### API Endpoints

Following the exact same pattern as comments (`/tasks/[taskId]/comments/`) and attachments (`/tasks/[taskId]/attachments/`):

```
GET    /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs
       → Returns all logs for the task, joined with uploader profile data
       → Also returns task.estimated_hours

POST   /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs
       → Creates a new log entry

PATCH  /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/[logId]
       → Updates duration, description, or logged_date (own logs only)

DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/[logId]
       → Deletes a log entry (own logs only)

GET    /api/workspaces/[id]/time-summary
       → Personal view: all logs for the current user, filterable by period
       → Team view (admin only): aggregated hours per member, filterable by period
```

The task PATCH endpoint (`/tasks/[taskId]`) is extended to also accept `estimated_hours`.

---

### Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Duration format | Decimal hours (1.5) | Matches spec requirement; simple arithmetic for totals |
| Duration display | Formatted as "1h 30m" | User-friendly; conversion done in a shared utility function |
| Time aggregation | Server-side SUM in SQL | Accurate totals; avoids floating-point rounding in JavaScript |
| Summary page location | New top-level `/time` page | Summaries are workspace-wide, not project-specific |
| Team summary access | Admin/owner only | Viewing all team members' time is a management-level concern |
| Date field | `logged_date` (date only, not timestamp) | Users log "I worked 2h on Monday", not an exact start time |
| No new packages | Use existing shadcn/ui | Table, Dialog, Tabs, Progress, Popover (date picker) all available |

---

### New Files

| File | Purpose |
|------|---------|
| `src/components/time-tracking-section.tsx` | Container for task detail (progress bar + log list + button) |
| `src/components/time-log-form.tsx` | Add/edit log dialog form |
| `src/components/time-log-list.tsx` | List of log entries with edit/delete |
| `src/components/time-progress-bar.tsx` | Visual estimate vs. logged bar with warning badge |
| `src/hooks/useTimeLog.ts` | Data fetching, create/update/delete log mutations |
| `src/app/time/page.tsx` | New summary page |
| `src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/route.ts` | GET + POST |
| `src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/time-logs/[logId]/route.ts` | PATCH + DELETE |
| `src/app/api/workspaces/[id]/time-summary/route.ts` | Personal + team aggregation |
| `supabase/migrations/YYYYMMDD_003_time_tracking.sql` | DB migration: column + table + RLS |

### Modified Files

| File | Change |
|------|--------|
| `src/app/projects/[projectId]/tasks/[taskId]/page.tsx` | Add `TimeTrackingSection` |
| `src/components/edit-task-dialog.tsx` | Add `estimated_hours` field |
| `src/components/create-task-dialog.tsx` | Add `estimated_hours` field |
| `src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/route.ts` | Accept `estimated_hours` in PATCH |
| `src/types/task.ts` | Add `estimated_hours` to Task type, add `TimeLog` interface |
| `src/lib/validations/task.ts` | Add `createTimeLogSchema`, `updateTimeLogSchema` |

---

### Dependencies

No new npm packages required. All UI components are available in the existing shadcn/ui installation (Table, Dialog, Tabs, Progress, Popover, Calendar for date picker).

---

### Security Considerations

- **RLS on `time_logs`**: Scoped to workspace membership; only log owners can mutate
- **Server-side validation**: Zod schema enforces duration range (0 < duration ≤ 24), max description length
- **Team summary gate**: Admin check server-side, not just hidden in UI
- **Input sanitization**: Descriptions rendered as text nodes (no HTML injection)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
