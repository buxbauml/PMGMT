# PROJ-6: Sprint Planning

## Status: In Review
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

## Dependencies
- Requires: PROJ-4 (Task Management) - sprints contain tasks

## User Stories
- As a workspace admin, I want to create sprints with start and end dates so that I can plan work in iterations
- As a workspace member, I want to assign tasks to sprints so that I know what to work on this iteration
- As a workspace member, I want to view sprint progress so that I know if we're on track
- As a workspace admin, I want to mark sprints as complete so that I can archive finished iterations
- As a workspace member, I want to see upcoming, active, and completed sprints so that I can plan ahead

## Acceptance Criteria
- [ ] Workspace admin can create sprint with name, start date, and end date
- [ ] Sprint name is required (3-100 characters)
- [ ] Sprint dates must be valid (end date after start date)
- [ ] User can assign tasks to a sprint
- [ ] Tasks can belong to only one sprint at a time
- [ ] User can view sprint details showing all tasks in that sprint
- [ ] Sprint view shows progress (% of tasks completed)
- [ ] Sprint view shows days remaining until end date
- [ ] User can filter sprints by status (upcoming, active, completed)
- [ ] Active sprint is automatically determined by current date
- [ ] Workspace admin can mark sprint as complete
- [ ] User can move tasks between sprints
- [ ] User can remove task from sprint (move to backlog)

## Edge Cases
- What happens if sprint end date is in the past but not marked complete? → Show as "Overdue", allow extending
- What happens if task is assigned to completed sprint? → All incomplete tasks are auto-marked as done when sprint is completed (with user confirmation)
- What happens if all tasks in sprint are completed early? → Suggest marking sprint complete
- What happens if user creates overlapping sprints? → Allow overlaps, show warning
- What happens if sprint has no tasks? → Show empty state, prompt to add tasks
- What happens if user deletes a sprint? → Tasks in sprint move to backlog (unassigned from sprint)

## Technical Requirements
- **Database:** Sprints table with workspace_id foreign key, tasks have optional sprint_id, RLS policies
- **Permissions:** Only workspace admins can create/delete sprints, all members can assign tasks
- **Performance:** Sprint list load < 200ms, sprint detail load < 300ms
- **Validation:** Name required (3-100 chars), dates required and valid
- **Status Logic:** upcoming (start_date > today), active (start_date <= today <= end_date), completed (manually marked or end_date < today)
- **Progress Calculation:** (completed tasks / total tasks) * 100

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
Sprint Planning adds time-boxed iterations to organize project tasks. Teams can create sprints with start/end dates, assign tasks, track progress, and mark sprints complete when done. This enables agile workflows without the complexity of story points or velocity tracking — just simple, visual sprint management.

---

### Component Structure

```
Sprint Management Page (/projects/[projectId]/sprints)
│
├── Page Header
│   ├── Project Name + Breadcrumb
│   ├── "New Sprint" Button (admin only)
│   └── Filter Tabs: Upcoming | Active | Completed
│
├── Sprint List (grouped by status)
│   │
│   ├── Active Sprint Card (0 or 1)
│   │   ├── Sprint Name + Date Range
│   │   ├── Progress Bar (% tasks completed)
│   │   ├── Days Remaining Badge
│   │   ├── Task Count Summary (3 of 10 done)
│   │   ├── Quick Stats (tasks by status)
│   │   └── "View Details" Link
│   │
│   ├── Upcoming Sprint Cards (future sprints)
│   │   ├── Sprint Name + Date Range
│   │   ├── Task Count (not started)
│   │   ├── "Edit" | "Delete" (admin only)
│   │   └── "View Details" Link
│   │
│   └── Completed Sprint Cards (past sprints)
│       ├── Sprint Name + Date Range
│       ├── Final Stats (tasks completed, completion date)
│       └── "View Details" Link (read-only)
│
└── Empty State (if no sprints)
    ├── Illustration
    ├── "No sprints yet" message
    └── "Create your first sprint" CTA

---

Sprint Detail Page (/projects/[projectId]/sprints/[sprintId])
│
├── Page Header
│   ├── Back Button (to sprint list)
│   ├── Sprint Name (editable inline, admin only)
│   ├── Sprint Date Range (editable, admin only)
│   ├── Sprint Status Badge (upcoming/active/overdue/completed)
│   └── Actions Dropdown (admin only)
│       ├── Edit Sprint
│       ├── Mark as Complete (if active/overdue)
│       ├── Reopen Sprint (if completed)
│       └── Delete Sprint
│
├── Sprint Stats Row
│   ├── Progress Circle (% complete)
│   ├── Days Remaining (or "Overdue by X days")
│   ├── Task Count (3 / 10 completed)
│   └── Completion Date (if marked complete)
│
├── Sprint Task List
│   ├── Section Header
│   │   ├── "Tasks in Sprint" Title
│   │   ├── Count Badge
│   │   └── "Add Tasks" Button → Opens task selector dialog
│   │
│   ├── IF no tasks
│   │   └── Empty State
│   │       ├── "No tasks assigned yet"
│   │       └── "Add tasks to this sprint" CTA
│   │
│   └── IF tasks exist
│       └── Task Table (reuse TaskTable component)
│           ├── Task rows with title, status, priority, assignee
│           ├── Status badges (to_do, in_progress, done)
│           ├── "Remove from Sprint" action (moves to backlog)
│           └── Click row → Navigate to task detail page
│
└── Dialogs
    ├── Create/Edit Sprint Dialog
    │   ├── Sprint Name Input (3-100 chars)
    │   ├── Start Date Picker
    │   ├── End Date Picker
    │   ├── Validation: end > start
    │   └── Save Button
    │
    └── Add Tasks to Sprint Dialog
        ├── Search/Filter: Show only backlog tasks (no sprint assigned)
        ├── Task List (checkbox multi-select)
        ├── Checkbox: All unassigned tasks
        └── "Add to Sprint" Button
```

---

### Data Model

**Sprint Information Stored:**

Each sprint contains:
- **Unique ID** - Generated automatically by database
- **Workspace ID** - Which workspace this sprint belongs to
- **Project ID** - Which project this sprint belongs to (sprints are per-project)
- **Name** - Sprint name (3-100 characters, required, e.g., "Sprint 12", "Q1 Release")
- **Start Date** - When the sprint begins (required)
- **End Date** - When the sprint ends (required, must be after start date)
- **Status** - Derived from dates and completion: `upcoming`, `active`, `overdue`, `completed`
- **Completed** - Whether sprint was manually marked complete (true/false, default false)
- **Completed At** - When sprint was marked complete (optional)
- **Completed By** - User who marked sprint complete (optional)
- **Created At** - When sprint was created
- **Created By** - User who created the sprint

**Task Updates:**

Tasks table gets a new optional field:
- **Sprint ID** - Which sprint this task is assigned to (optional, nullable)
- If null → task is in the "backlog" (not assigned to any sprint)
- Tasks can belong to only ONE sprint at a time

**Storage Location:**
- Stored in: Database (Supabase PostgreSQL)
- Two changes: new `sprints` table, add `sprint_id` column to existing `tasks` table
- Reason: Sprint data needs to persist and sync across devices for team collaboration

**Relationships:**
- Sprints belong to ONE project (and indirectly to ONE workspace)
- Tasks optionally belong to ONE sprint
- When a sprint is deleted, tasks' `sprint_id` is set to NULL (move to backlog)
- When a project is deleted, all its sprints are deleted (CASCADE)
- Sprints cannot be moved between projects

**Status Calculation Logic:**
- Status is computed at read time based on dates and `completed` flag
- **Upcoming:** `start_date > current_date`
- **Active:** `start_date <= current_date <= end_date AND completed = false`
- **Overdue:** `end_date < current_date AND completed = false`
- **Completed:** `completed = true`

---

### Tech Decisions

**1. Why are sprints tied to projects, not workspaces?**
- Each project has its own sprint cadence (some teams do 2-week sprints, others 4-week)
- Mixing tasks from different projects in one sprint creates confusion
- Sprint metrics (velocity, burndown) are meaningful per-project, not across all workspace projects
- Teams can run sprints in parallel across different projects

**2. Why derive status from dates instead of storing it?**
- Single source of truth: dates determine status, not a separate field that could get out of sync
- Status automatically updates as time passes (sprint becomes active, then overdue)
- No background jobs needed to update status
- Exception: `completed` is a manual flag because teams may finish early or want to close an overdue sprint

**3. Why allow overlapping sprints?**
- Some teams run parallel tracks (e.g., "Bug Fix Sprint" alongside "Feature Sprint")
- Teams may pre-plan future sprints while current sprint is active
- Show a warning but don't block it — trust teams to manage their own process
- UI filter tabs let users focus on one sprint at a time

**4. Why move tasks to backlog instead of deleting them when sprint is deleted?**
- Tasks represent work that still needs to be done — deleting sprint shouldn't delete work
- Backlog (sprint_id = NULL) is a safe "unscheduled" state
- Users can reassign tasks to another sprint or keep them in backlog
- Prevents accidental data loss

**5. Why only admins can create/delete sprints?**
- Sprint planning is typically done by project leads or scrum masters
- Prevents clutter from too many ad-hoc sprints
- All members can still assign tasks to sprints (tactical work)
- Matches real-world team workflows (planning vs execution roles)

**6. Why no "velocity" or "story points" in MVP?**
- Not all teams use story points — many just count tasks
- Simple progress (% done) is easier to understand for non-technical stakeholders
- Can add estimation fields later if users request it
- Keeps MVP focused on core sprint planning workflow

**7. Why show "days remaining" instead of full calendar integration?**
- Simple countdown is clear and actionable ("3 days left!")
- Calendar events are external tools (Google Calendar, Outlook) — out of scope
- Users can infer sprint timeline from start/end dates
- Future enhancement: export sprint to .ics file

---

### Dependencies

**New packages to install:**
- **react-day-picker** — Date range picker for sprint creation dialog

**Already available components to use:**
- `Badge` — Sprint status badges
- `Progress` — Progress bar for completion percentage
- `Button` — Actions
- `Dialog` — Create/edit sprint dialog
- `Input` — Sprint name input
- `Table` — Reuse TaskTable component
- `Card` — Sprint cards
- `DropdownMenu` — Sprint actions menu
- `Alert` — Warnings for overlapping sprints

---

### Database & API Structure

**Database Changes Needed:**
- New `sprints` table with `workspace_id` and `project_id` foreign keys
- Add `sprint_id` column to existing `tasks` table (nullable, foreign key to sprints)
- Security rules (RLS policies) so workspace members can view sprints, admins can create/delete
- Indexes on `project_id`, `sprint_id`, and date columns for fast queries

**API Endpoints Needed:**
- `GET /api/workspaces/[id]/projects/[projectId]/sprints` — List all sprints for a project (with task counts)
- `POST /api/workspaces/[id]/projects/[projectId]/sprints` — Create new sprint (admin only)
- `GET /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId]` — Get single sprint with full task list
- `PATCH /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId]` — Update sprint (name, dates, mark complete)
- `DELETE /api/workspaces/[id]/projects/[projectId]/sprints/[sprintId]` — Delete sprint (admin only, moves tasks to backlog)
- Existing task endpoints get an optional `sprint_id` field in request body (to assign/remove from sprint)

**Security:**
- Only workspace members can view sprints in their projects
- Only workspace admins/owners can create, edit, or delete sprints
- All members can assign tasks to sprints (update `sprint_id` on task)
- Validation: end_date must be after start_date, enforced server-side

---

### User Experience Flow

**Creating a Sprint:**
1. User (admin) navigates to `/projects/[projectId]/sprints`
2. Clicks "New Sprint" button
3. Dialog opens with name input, start date picker, end date picker
4. Enters "Sprint 12", start: "2026-02-20", end: "2026-03-05"
5. Clicks "Create Sprint"
6. Sprint appears in "Upcoming" section (if start date is future) or "Active" (if today is between dates)

**Assigning Tasks to Sprint:**
1. User clicks into sprint detail page
2. Clicks "Add Tasks" button
3. Dialog shows list of backlog tasks (no sprint assigned)
4. User checks 5 tasks
5. Clicks "Add to Sprint"
6. Tasks now appear in sprint task list with their status, assignee, priority

**Viewing Sprint Progress:**
1. User views sprint list or detail page
2. Progress bar shows "3 of 10 tasks completed (30%)"
3. Days remaining badge shows "5 days left" (green) or "Overdue by 2 days" (red)
4. Quick stats: 3 done, 5 in progress, 2 to do

**Marking Sprint as Complete:**
1. Admin clicks sprint actions dropdown
2. Clicks "Mark as Complete"
3. Sprint status changes to "Completed"
4. `completed_at` timestamp recorded
5. Sprint moves to "Completed" filter tab
6. All remaining tasks stay in sprint (for retrospective) but team can move them to new sprint if needed

**Deleting a Sprint:**
1. Admin clicks "Delete Sprint" from actions menu
2. Confirmation dialog: "5 tasks will be moved to backlog. Continue?"
3. Admin confirms
4. Sprint is deleted, tasks' `sprint_id` set to NULL

## QA Test Results

**Tested:** 2026-02-17
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Re-verified:** 2026-02-17 (third pass - full code audit after fixes)

### Acceptance Criteria Status

#### AC-1: Workspace admin can create sprint with name, start date, and end date
- [x] POST endpoint exists at `/api/workspaces/[id]/projects/[projectId]/sprints`
- [x] Admin/owner role check enforced before creation (line 167 of sprints/route.ts)
- [x] Create sprint dialog has name, start_date, end_date fields
- [x] Sprint is inserted into database with correct fields
- [x] Returns 201 with enriched sprint data including computed status
- [x] Rate limited to 30 sprint creations per hour per user

#### AC-2: Sprint name is required (3-100 characters)
- [x] Zod validation enforces `min(3)` and `max(100)` with `.trim()` (sprint.ts validation)
- [x] Database CHECK constraint: `char_length(name) BETWEEN 3 AND 100` (migration line 12)
- [x] Client-side form validation via zodResolver
- [x] Server returns descriptive error message on validation failure

#### AC-3: Sprint dates must be valid (end date after start date)
- [x] Zod `.refine()` validates `end > start` on create (createSprintSchema)
- [x] Zod `.refine()` validates `end > start` on update when both dates provided (updateSprintSchema)
- [x] Database CHECK constraint: `end_date > start_date` (migration line 22)
- [x] PATCH endpoint validates dates when only one date is changed (fetches current sprint to compare, lines 254-277)

#### AC-4: User can assign tasks to a sprint
- [x] POST endpoint at `.../sprints/[sprintId]/tasks` accepts `task_ids` array
- [x] Any workspace member can assign tasks (no admin check required)
- [x] AddTasksToSprintDialog shows backlog tasks with search, multi-select, and select-all
- [x] Batch limit of 50 tasks per request enforced
- [x] Rate limited to 120 add-tasks per hour per user

#### AC-5: Tasks can belong to only one sprint at a time
- [x] `sprint_id` is a single nullable foreign key on tasks table (not many-to-many)
- [x] Assigning to a new sprint overwrites previous sprint_id automatically via SQL UPDATE
- [x] Database schema enforces single sprint per task by design

#### AC-6: User can view sprint details showing all tasks in that sprint
- [x] GET endpoint at `.../sprints/[sprintId]` returns sprint data + full task list
- [x] Sprint detail page renders task table with title, status, priority, assignee
- [x] Tasks fetched with profile joins (assignee, creator, completer names)
- [x] Tasks limited to 500 per sprint

#### AC-7: Sprint view shows progress (% of tasks completed)
- [x] Progress calculated as `(completed_tasks / total_tasks) * 100` with `Math.round`
- [x] Progress bar rendered using shadcn `Progress` component
- [x] Text shows "X of Y tasks" with percentage
- [x] Sprint card shows progress for active and overdue sprints

#### AC-8: Sprint view shows days remaining until end date
- [x] `getDaysRemaining()` utility calculates diff from today to end date
- [x] `DaysRemainingBadge` component handles: overdue (red), ends today (yellow), 1-3 days (yellow), 4+ days (gray)
- [x] Sprint detail page shows "Days remaining" stat card
- [x] Overdue sprints show "Overdue by X days" in destructive badge

#### AC-9: User can filter sprints by status (upcoming, active, completed)
- [x] Filter tabs implemented: All, Active, Upcoming, Overdue, Completed
- [x] Client-side filtering via `useSprint` hook with `useMemo`
- [x] Each tab shows count badge with number of sprints in that status
- [x] Empty state shown when no sprints match filter
- [x] Note: Filter includes "Overdue" tab beyond spec requirements - this is an enhancement

#### AC-10: Active sprint is automatically determined by current date
- [x] `computeSprintStatus()` derives status from dates and completed flag
- [x] Status computed at read time, not stored in database
- [x] Upcoming: `start_date > today`, Active: `start <= today <= end && !completed`, Overdue: `end < today && !completed`, Completed: `completed = true`
- [x] Dates normalized with `setHours(0,0,0,0)` for correct day-boundary comparisons

#### AC-11: Workspace admin can mark sprint as complete
- [x] PATCH endpoint accepts `{ completed: true }` and records `completed_at` and `completed_by`
- [x] Admin/owner role check enforced
- [x] "Mark as complete" action in dropdown menu (visible for active/overdue sprints)
- [x] "Reopen sprint" action available for completed sprints
- [x] Confirmation dialog warns user that incomplete tasks will be auto-marked as done
- [x] Auto-completes all incomplete tasks when sprint is marked complete (line 297-307)

#### AC-12: User can move tasks between sprints
- [x] Tasks can be removed from sprint (move to backlog) via DELETE endpoint
- [x] Tasks can be added to another sprint via POST endpoint
- [x] Direct "Move to sprint" submenu in task row dropdown (DropdownMenuSub with other sprints listed)
- [x] handleMoveToSprint() reassigns task to target sprint in one click
- [x] Error feedback shown via actionError banner if move fails

#### AC-13: User can remove task from sprint (move to backlog)
- [x] DELETE endpoint at `.../sprints/[sprintId]/tasks/[taskId]` sets `sprint_id` to NULL
- [x] "Remove from sprint" action in task row dropdown
- [x] Confirmation dialog before removal: shows task title, warns about moving to backlog
- [x] Sprint detail and backlog refresh after removal
- [x] Rate limited to 120 removals per hour per user

### Edge Cases Status

#### EC-1: Sprint end date is in the past but not marked complete
- [x] Shows as "Overdue" status (red badge with AlertTriangle icon)
- [x] Overdue badge shows "Overdue by X days" count
- [x] Admin can extend sprint by editing dates via Edit sprint dialog

#### EC-2: Task assigned to completed sprint
- [x] When sprint is marked complete, all incomplete tasks are auto-completed (with user confirmation dialog)
- [x] Tasks stay in completed sprint for retrospective viewing
- [x] Tasks can be moved to new sprint via "Move to sprint" dropdown action
- [x] Behavior matches spec: "All incomplete tasks are auto-marked as done when sprint is completed (with user confirmation)"

#### EC-3: All tasks in sprint completed early
- [x] Green banner appears: "All X tasks are completed. Ready to close this sprint?"
- [x] "Mark as complete" button in the banner for quick action
- [x] Only shows for admins on non-completed sprints with tasks

#### EC-4: User creates overlapping sprints
- [x] Overlapping sprints are allowed (not blocked)
- [x] Server detects overlapping sprints and returns a `warning` field in POST response
- [x] `useSprint.createSprint()` returns `json.warning` to the caller
- [x] `CreateSprintDialog` renders overlap warning in yellow banner, auto-dismisses after 6 seconds

#### EC-5: Sprint has no tasks
- [x] Sprint detail shows empty state: "No tasks assigned to this sprint yet"
- [x] CTA button to "Add tasks to this sprint" in empty state
- [x] Sprint list shows "0 tasks planned" for empty upcoming sprints

#### EC-6: User deletes a sprint
- [x] Tasks moved to backlog: `sprint_id` set to NULL before sprint deletion
- [x] Confirmation dialog shows task count: "X tasks will be moved to the backlog"
- [x] Admin/owner role check enforced
- [x] Redirects to sprint list after successful deletion

### Additional Edge Cases Identified

#### EC-7: Sprint deletion rollback on failure
- [x] Sprint deletion first collects task IDs, then nullifies sprint_ids, then deletes sprint
- [x] If deletion fails after nullifying, code attempts to restore task sprint_ids back (compensation pattern at lines 470-474 of [sprintId]/route.ts)
- [x] Not a true database transaction, but the rollback logic adequately mitigates data inconsistency risk

#### EC-8: Very long sprint names
- [x] Enforced at validation (100 char max) and database level
- [x] UI uses `truncate` CSS class on sprint name in cards and header

#### EC-9: Same-day start and end date
- [x] Database constraint `end_date > start_date` rejects same-day sprints (DATE type comparison)
- [x] Zod validation also rejects `end <= start`

#### EC-10: task_ids input validation on add-tasks endpoint
- [x] POST `.../sprints/[sprintId]/tasks` now validates each task_id against UUID regex (lines 94-102 of tasks/route.ts)
- [x] Returns 400 with message "Each task_id must be a valid UUID" for invalid entries

#### EC-11: Cross-project task assignment prevention
- [x] Add-tasks endpoint includes `.eq('project_id', projectId)` on the UPDATE query (line 109 of tasks/route.ts)
- [x] Tasks from other projects are silently ignored (not assigned), preventing cross-project contamination

#### EC-12: Delete sprint - no error feedback on failure
- [ ] BUG: `handleDeleteSprint()` in sprint detail page (lines 331-345) does not show error feedback if the DELETE request fails (e.g., 403, 500). The dialog closes and nothing happens.

#### EC-13: Reopen sprint - no error feedback on failure
- [ ] BUG: `handleReopenSprint()` in sprint detail page (lines 324-329) discards the error from `handleUpdateSprint()` if reopening fails. No user feedback.

#### EC-14: Remove task from sprint - no error feedback on failure
- [ ] BUG: `handleRemoveTask()` in sprint detail page (lines 372-388) does not show error feedback if the DELETE request fails. The confirmation dialog closes silently.

### Security Audit Results

- [x] **Authentication:** All API endpoints check `supabase.auth.getUser()` and return 401 if not authenticated
- [x] **Authorization (Sprint CRUD):** Create/Update/Delete sprints restricted to admin/owner role. Regular members get 403.
- [x] **Authorization (Task assignment):** Any workspace member can assign tasks to sprints (correct per spec)
- [x] **Authorization (Cross-workspace):** Workspace membership verified before all operations. Non-members get 403.
- [x] **Input validation:** All sprint inputs validated with Zod schemas server-side. Invalid JSON returns 400.
- [x] **Input validation (task_ids):** Each task_id validated as UUID format before database query
- [x] **SQL injection:** Supabase client uses parameterized queries - no raw SQL injection vectors
- [x] **XSS prevention:** Sprint names rendered as text content (not dangerouslySetInnerHTML). React auto-escapes.
- [x] **Rate limiting (Sprint creation):** Sprint creation rate-limited to 30/hour per user
- [x] **Rate limiting (Sprint update):** Sprint update rate-limited to 60/hour per user
- [x] **Rate limiting (Sprint deletion):** Sprint deletion rate-limited to 30/hour per user
- [x] **Rate limiting (Add tasks):** Add tasks to sprint rate-limited to 120/hour per user
- [x] **Rate limiting (Remove task):** Remove task from sprint rate-limited to 120/hour per user
- [x] **RLS policies:** Comprehensive SELECT/INSERT/UPDATE/DELETE policies on sprints table
- [x] **Foreign key integrity:** sprint_id ON DELETE SET NULL, project_id ON DELETE CASCADE
- [x] **Project archived check (Create):** Cannot create sprints in archived projects
- [x] **Project archived check (Update):** Cannot modify sprints in archived projects
- [x] **Project archived check (Delete):** Cannot delete sprints in archived projects
- [x] **Data exposure:** API responses do not leak sensitive data. Only profile names, emails, and avatar URLs exposed (appropriate for team collaboration).
- [x] **IDOR protection (Sprint):** Sprint fetched with both `sprintId` AND `projectId` filter, preventing cross-project sprint access
- [x] **IDOR protection (Tasks):** Add-tasks endpoint filters by `project_id`, preventing cross-project task assignment

### Regression Test Results

- [x] **Task Management (PROJ-4):** Task type includes `sprint_id` field. Task create/update APIs accept optional `sprint_id`. Task validation schema includes `sprint_id`. Task update endpoint validates sprint exists in project before assigning. No breaking changes to existing task functionality.
- [x] **Task Comments (PROJ-5):** Activity logs still function. Task CRUD unchanged. Comment system unaffected by sprint_id addition.
- [x] **Build:** `npm run build` compiles successfully with no TypeScript errors (verified 2026-02-17)
- [x] **All routes registered:** All 6 sprint API routes and 2 sprint pages appear in build output

### Previous Bugs - Resolution Status

#### PREV-BUG-1: No rate limiting on task assignment/removal endpoints
- **Status:** FIXED
- **Evidence:** `POST .../sprints/[sprintId]/tasks` now has rate limiting (120/hr, lines 41-54 of tasks/route.ts). `DELETE .../sprints/[sprintId]/tasks/[taskId]` now has rate limiting (120/hr, lines 45-58 of [taskId]/route.ts).

#### PREV-BUG-2: Non-atomic sprint deletion (no transaction)
- **Status:** MITIGATED
- **Evidence:** Sprint deletion now collects task IDs before nullifying, and if the DELETE fails, attempts to restore task sprint_ids (lines 438-484 of [sprintId]/route.ts). Not a true DB transaction, but compensation/rollback logic handles the failure case.

#### PREV-BUG-3: Missing UUID validation on task_ids
- **Status:** FIXED
- **Evidence:** UUID_REGEX defined at line 5 of tasks/route.ts. Each task_id validated against regex at lines 94-102. Returns 400 for invalid UUIDs.

#### PREV-BUG-4: Silent failure in "Move to sprint" action
- **Status:** FIXED
- **Evidence:** `handleMoveToSprint()` now sets `actionError` state on failure (line 237 of sprint detail page). Error banner displayed at lines 622-635.

### New Bugs Found

#### BUG-5: No error feedback when sprint deletion fails
- **Severity:** Low
- **Steps to Reproduce:**
  1. On sprint detail page, click "Delete sprint" from actions dropdown
  2. Confirm deletion in the dialog
  3. If the server returns an error (e.g., 403 Forbidden, 500 Internal Server Error)
  4. Expected: User sees an error message explaining the failure
  5. Actual: The dialog closes, isDeleting resets, but no error message is shown. User is left on the sprint detail page with no feedback.
- **File:** `/src/app/projects/[projectId]/sprints/[sprintId]/page.tsx` lines 331-345
- **Priority:** Nice to have

#### BUG-6: No error feedback when sprint reopen fails
- **Severity:** Low
- **Steps to Reproduce:**
  1. On sprint detail page for a completed sprint, click "Reopen sprint" from actions dropdown
  2. If the PATCH request fails (e.g., rate limit exceeded, archived project, network error)
  3. Expected: User sees an error message
  4. Actual: The error from `handleUpdateSprint()` is returned but never displayed to the user. The `result.error` value is discarded.
- **File:** `/src/app/projects/[projectId]/sprints/[sprintId]/page.tsx` lines 324-329
- **Priority:** Nice to have

#### BUG-7: No error feedback when task removal from sprint fails
- **Severity:** Low
- **Steps to Reproduce:**
  1. On sprint detail page, click "Remove from sprint" on a task
  2. Confirm in the dialog
  3. If the DELETE request fails (e.g., network error, server error)
  4. Expected: User sees an error message
  5. Actual: The confirmation dialog closes, isRemoving resets, but no error message is shown.
- **File:** `/src/app/projects/[projectId]/sprints/[sprintId]/page.tsx` lines 372-388
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 13/13 passed
- **Edge Cases:** 11/14 passed (3 low-severity missing error feedback issues)
- **Previous Bugs:** 4/4 resolved (3 fixed, 1 mitigated)
- **New Bugs Found:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** All checks passed (rate limiting, RLS, IDOR, input validation all verified)
- **Production Ready:** YES
- **Recommendation:** Deploy. The 3 remaining low-severity bugs (BUG-5, BUG-6, BUG-7) are all missing error feedback on failure paths for sprint deletion, reopen, and task removal. These are non-blocking UX polish items that can be addressed in a follow-up sprint.

## Deployment
_To be added by /deploy_
