# PROJ-4: Task Management

## Status: In Review
**Created:** 2026-02-14
**Last Updated:** 2026-02-16

## Dependencies
- Requires: PROJ-3 (Project Management) - tasks belong to projects

## User Stories
- As a workspace member, I want to create tasks within a project so that I can track work items
- As a task creator, I want to assign tasks to team members so that responsibilities are clear
- As a workspace member, I want to view all tasks in a project so that I know what needs to be done
- As an assignee, I want to mark tasks as complete so that I can track my progress
- As a workspace member, I want to filter tasks by status and assignee so that I can find relevant work
- As a task creator, I want to set priority levels so that urgent work is visible

## Acceptance Criteria
- [ ] User can create task with title and optional description
- [ ] Task title is required (3-200 characters)
- [ ] User can assign task to any workspace member
- [ ] User can set task status (To Do, In Progress, Done)
- [ ] User can set priority (Low, Medium, High)
- [ ] User can view list of all tasks within a project
- [ ] Task list shows title, assignee, status, and priority
- [ ] User can filter tasks by status, assignee, and priority
- [ ] User can edit task title, description, assignee, status, and priority
- [ ] User can delete tasks they created
- [ ] Workspace admin can delete any task
- [ ] Completed tasks show completion date and who completed them

## Edge Cases
- What happens if assigned user is removed from workspace? → Set task to unassigned, show warning
- What happens if user creates task without selecting assignee? → Task remains unassigned, visible to all
- What happens if task title is duplicate? → Allow duplicates (common in projects)
- What happens if user tries to delete task with comments? → Allow deletion, delete comments too (with confirmation)
- What happens if project is archived? → Tasks become read-only, cannot add new tasks
- What happens when filtering shows no results? → Show empty state "No tasks match filters"

## Technical Requirements
- **Database:** Tasks table with project_id and assignee_id foreign keys, RLS policies
- **Permissions:** All workspace members can create tasks, admins can delete any task
- **Performance:** Task list load < 300ms, filter response < 100ms
- **Validation:** Title required (3-200 chars), status enum, priority enum
- **Status Values:** to_do, in_progress, done
- **Priority Values:** low, medium, high

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
Task Management allows workspace members to create, assign, and track individual work items within projects. Each task has a title, description, assignee, status (To Do, In Progress, Done), and priority level. This feature provides the core work-tracking functionality for the project management system.

---

### Component Structure

```
Project Detail Page (/projects/[projectId])
│
├── Page Header
│   ├── Back Button (to workspace dashboard)
│   ├── Project Name & Description
│   ├── Project Progress Bar (from existing PROJ-3)
│   └── Project Metadata (dates, archive status)
│
├── IF no tasks in project
│   └── Tasks Empty State
│       ├── Icon/Illustration
│       ├── "No tasks yet" message
│       └── "Create Task" Button (opens Dialog)
│
├── IF tasks exist
│   └── Tasks Section
│       ├── Section Header
│       │   ├── "Tasks" Title with Count Badge
│       │   ├── Filter Controls
│       │   │   ├── Status Filter Dropdown (All, To Do, In Progress, Done)
│       │   │   ├── Assignee Filter Dropdown (All, Unassigned, Me, [Member Names])
│       │   │   └── Priority Filter Dropdown (All, Low, Medium, High)
│       │   └── "New Task" Button (opens Dialog)
│       │
│       └── Task Table
│           ├── Column Headers (sortable)
│           │   ├── Priority (icon)
│           │   ├── Title
│           │   ├── Assignee (avatar + name)
│           │   ├── Status (badge)
│           │   └── Actions
│           │
│           └── Task Row (for each task)
│               ├── Priority Icon (red/yellow/gray)
│               ├── Task Title (clickable, opens Edit Dialog)
│               ├── Assignee Avatar & Name
│               │   └── OR "Unassigned" text (if no assignee)
│               ├── Status Badge (colored pill)
│               │   └── Color: gray=To Do, blue=In Progress, green=Done
│               └── Actions Menu (3-dot dropdown)
│                   ├── Edit Task
│                   ├── Change Status (quick actions)
│                   └── Delete (if owner or admin)
│
└── Dialogs
    ├── Create Task Dialog
    │   ├── Title Input (required, 3-200 chars)
    │   ├── Description Textarea (optional, max 2000 chars)
    │   ├── Assignee Select Dropdown
    │   │   └── Options: Unassigned, [All Workspace Members]
    │   ├── Status Radio Group (To Do, In Progress, Done)
    │   │   └── Default: To Do
    │   ├── Priority Radio Group (Low, Medium, High)
    │   │   └── Default: Medium
    │   ├── Cancel Button
    │   └── Create Button (validates & submits)
    │
    └── Edit Task Dialog
        ├── Same fields as Create Dialog
        ├── IF status changed to Done
        │   └── Auto-record completion timestamp + user
        ├── Cancel Button
        ├── Save Button
        └── Delete Button (if owner or admin)
```

---

### Data Model

**Task Information Stored:**

Each task contains:
- **Unique ID** - Generated automatically by database
- **Project ID** - Which project this task belongs to
- **Title** - Short description (3-200 characters, required)
- **Description** - Detailed explanation (up to 2000 characters, optional)
- **Assignee** - Which workspace member is responsible (optional, can be unassigned)
- **Status** - Current state of work (To Do, In Progress, or Done)
- **Priority** - Urgency level (Low, Medium, or High)
- **Completion Info** - When task was marked Done and by whom (auto-recorded)
- **Created By** - Who created the task
- **Timestamps** - When task was created and last updated

**Storage Location:**
- Stored in: Database (Supabase PostgreSQL)
- Reason: Tasks need to sync across devices and be accessible to all workspace members

**Relationships:**
- Tasks belong to ONE project
- Tasks can be assigned to ONE workspace member (or left unassigned)
- When a project is deleted, all its tasks are deleted too
- When a workspace member is removed, their assigned tasks become "unassigned"

**Progress Calculation:**
- Project progress is calculated from task status
- Formula: (Number of tasks with status "Done" / Total number of tasks) × 100
- Example: 7 done tasks out of 10 total = 70% progress

---

### Tech Decisions

**1. Why use a database table instead of embedding tasks within projects?**
- Tasks are independent work items that need their own URLs, edit history, and comments (future PROJ-5)
- Filtering and sorting large numbers of tasks is faster with database queries
- Each task can be assigned to different people and tracked separately

**2. Why allow unassigned tasks?**
- Teams often create a backlog of work before deciding who will do it
- Flexible workflow: someone can volunteer to take an unassigned task
- Matches real-world team planning behavior

**3. Why three status values (To Do, In Progress, Done)?**
- Minimal viable workflow that works for most teams
- "To Do" = planned work not started yet
- "In Progress" = someone is actively working on it
- "Done" = completed and verified
- Teams that need more statuses (like "Review", "Blocked") can use PROJ-7 (Kanban Board) later

**4. Why three priority levels (Low, Medium, High)?**
- Simple enough for quick decision-making
- Clear visual distinction with color coding (gray, yellow, red)
- Avoids "priority inflation" that happens with 5+ levels
- Teams can use "High" sparingly to signal truly urgent work

**5. Why record completion timestamp and user?**
- Provides accountability: "Who marked this done and when?"
- Useful for velocity tracking in future reporting features
- Helps with debugging: "Why was this marked complete?"

**6. Why table view instead of card view?**
- Scan many tasks quickly in a compact list
- Easy to sort and filter by different columns
- Assignee avatars and status badges provide visual scanning
- Card/Kanban view will be available in PROJ-7

**7. Why auto-unassign when member is removed from workspace?**
- Prevents broken references (task assigned to non-existent user)
- Makes it visible that the work needs to be reassigned
- Safer than deleting tasks (preserves work history)

**8. Why make tasks read-only when project is archived?**
- Archived projects represent completed or cancelled work
- Prevents accidental changes to historical records
- Users can still view tasks for reference
- If changes are needed, admin can unarchive the project

---

### Dependencies

**New packages to install:**
- None! All necessary UI components (Table, Select, Dialog, Badge, Avatar) are already installed from PROJ-1, PROJ-2, and PROJ-3

**Already available components to use:**
- `Dialog` - For create/edit task modals
- `Select` - For assignee and filter dropdowns
- `Badge` - For status and priority indicators
- `Table` - For task list layout
- `Avatar` - For displaying assignee photos
- `Button` - For actions
- `Textarea` - For description field
- `RadioGroup` - For status and priority selection

---

### Database & API Structure

**Database Changes Needed:**
- New `tasks` table with columns for all task fields
- Foreign keys linking to projects and users
- Security rules (RLS policies) so workspace members can only see tasks in their workspace's projects
- Indexes for fast filtering by status, assignee, and priority

**API Endpoints Needed:**
- `GET /api/workspaces/[id]/projects/[projectId]/tasks` - List all tasks (with filters)
- `POST /api/workspaces/[id]/projects/[projectId]/tasks` - Create new task
- `GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]` - Get single task details
- `PATCH /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]` - Update task
- `DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]` - Delete task

**Security:**
- Only workspace members can view/create tasks in their workspace's projects
- Task creators can delete their own tasks
- Workspace admins can delete any task
- Archived projects: tasks are read-only (GET only)

---

### User Experience Flow

**Creating a Task:**
1. User views a project detail page
2. Clicks "New Task" button
3. Dialog opens with empty form
4. User types task title (required)
5. Optionally adds description, assignee, status, priority
6. Clicks "Create"
7. Task appears in table immediately
8. Project progress bar updates automatically

**Editing a Task:**
1. User clicks task title or "Edit" from actions menu
2. Dialog opens with current values pre-filled
3. User changes any field
4. If changing status to "Done", system records who/when
5. Clicks "Save"
6. Table row updates immediately
7. Project progress bar updates if status changed

**Filtering Tasks:**
1. User sees filters above task table
2. Clicks "Status" filter, selects "In Progress"
3. Table instantly shows only in-progress tasks
4. User can combine multiple filters (e.g., "In Progress" + "Assigned to Me" + "High Priority")
5. Filters are visible as chips that can be clicked to clear

**Handling Removed Member:**
1. Admin removes user from workspace
2. System finds all tasks assigned to that user
3. Sets those tasks to "Unassigned"
4. Shows warning to admin: "5 tasks were unassigned because [Name] left the workspace"
5. Tasks remain visible to team for reassignment

## QA Test Results (Round 4)

**Tested:** 2026-02-17
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (Next.js 16.1.1, Turbopack, 0 errors, 0 warnings)

### Previous Bugs - Resolution Status

| Bug | Previous Severity | Status |
|-----|------------------|--------|
| BUG-1: Quick status change validation | High | FIXED (Round 2) |
| BUG-2: Archived project API bypass | High | FIXED (Round 2) |
| BUG-3: No rate limiting on task POST | Medium | FIXED (Round 2) |
| BUG-4: No unassigned task warning on member removal | Low | FIXED (Round 2) |
| BUG-5: Create dialog "Unassigned" sends string | Medium | FIXED (Round 2) |
| BUG-6: Partial PATCH silently clears assignee | High | FIXED (Round 2) |
| BUG-7: No rate limiting on PATCH and DELETE | Low | FIXED (Round 2) |
| BUG-8: Edit dialog sends `null` description failing Zod | Medium | FIXED - `updateTaskSchema.description` now includes `.or(z.null())` (line 35) |

### Acceptance Criteria Status

#### AC-1: User can create task with title and optional description
- [x] Create task dialog renders with title and description fields
- [x] Title field is required, description is marked as optional
- [x] POST endpoint creates task and returns enriched data with 201 status
- [x] New task appears in table immediately (optimistic local state update)

#### AC-2: Task title is required (3-200 characters)
- [x] Zod schema enforces min 3, max 200 characters with `.trim()`
- [x] Database CHECK constraint: `char_length(title) BETWEEN 3 AND 200`
- [x] Frontend form shows validation messages via react-hook-form + zodResolver
- [x] Server returns first Zod issue message on validation failure

#### AC-3: User can assign task to any workspace member
- [x] Assignee Select dropdown populated with workspace members
- [x] API validates assignee is workspace member before creating/updating
- [x] "Unassigned" option available in dropdown
- [x] Create dialog correctly handles "unassigned" value (line 84)
- [x] Edit dialog correctly handles "unassigned" value (line 116)

#### AC-4: User can set task status (To Do, In Progress, Done)
- [x] RadioGroup with all three status options in Create and Edit dialogs
- [x] Default status is "To Do" for new tasks
- [x] Status values use correct enum: `to_do`, `in_progress`, `done`

#### AC-5: User can set priority (Low, Medium, High)
- [x] RadioGroup with all three priority options in Create and Edit dialogs
- [x] Default priority is "Medium" for new tasks
- [x] Priority values use correct enum: `low`, `medium`, `high`

#### AC-6: User can view list of all tasks within a project
- [x] TaskTable component renders all tasks in a Table
- [x] GET endpoint fetches tasks with `.limit(500)` and ordered by `created_at DESC`
- [x] Loading skeleton shown while fetching
- [x] TaskEmptyState shown when no tasks exist

#### AC-7: Task list shows title, assignee, status, and priority
- [x] Priority column with color-coded icons (red=high, yellow=medium, gray=low)
- [x] Title column (clickable, links to task detail page)
- [x] Assignee column with Avatar + name (hidden on mobile, shown inline below title)
- [x] Status column with colored badge (gray=To Do, blue=In Progress, green=Done)
- [x] Actions column with dropdown menu

#### AC-8: User can filter tasks by status, assignee, and priority
- [x] Three Select dropdowns for status, assignee, and priority filters
- [x] Client-side filtering in `useTask` hook via `useMemo`
- [x] "Clear filters" button appears when any filter is active
- [x] Badge shows filtered count vs. total count
- [x] Assignee filter includes "Me", "Unassigned", and all member names

#### AC-9: User can edit task title, description, assignee, status, and priority
- [x] Edit dialog pre-fills all fields from current task values
- [x] All fields editable: title, description, assignee, status, priority
- [x] PATCH endpoint updates only provided fields (partial update via all-optional Zod schema)
- [x] Form resets properly on close
- [x] Quick status change via dropdown preserves assignee (BUG-6 fixed)
- [x] Edit dialog correctly handles empty description (BUG-8 fixed: schema now accepts `null`)
- [x] Task detail page provides inline editing for status, priority, and assignee via Select dropdowns

#### AC-10: User can delete tasks they created
- [x] Delete button appears in Edit dialog when `canDelete` is true
- [x] Delete option in row action dropdown when `canUserDelete` returns true
- [x] API checks `task.created_by === user.id` for delete permission
- [x] Confirmation AlertDialog shown before deletion
- [x] Task detail page also has delete option in actions menu

#### AC-11: Workspace admin can delete any task
- [x] API checks `['owner', 'admin'].includes(membership.role)` for admin delete
- [x] Frontend `canDeleteAny` is set from `isOwner || isAdmin`
- [x] Both row dropdown and edit dialog respect admin delete permission
- [x] Task detail page respects admin delete permission

#### AC-12: Completed tasks show completion date and who completed them
- [x] Edit dialog shows green banner with completion date and user name when status is "done"
- [x] Task detail page shows green completion banner
- [x] API auto-records `completed_at` and `completed_by` when status changes to "done"
- [x] API clears `completed_at` and `completed_by` when status changes away from "done"
- [x] Creating a task directly as "done" also records completion info

### Edge Cases Status

#### EC-1: Assigned user removed from workspace
- [x] Database: `assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL` handles user deletion
- [x] Backend: Member removal API counts affected tasks, unassigns them, returns count in response
- [x] Frontend: Workspace settings shows timed warning message with unassigned task count

#### EC-2: Task created without selecting assignee
- [x] Task remains unassigned, visible to all
- [x] "Unassigned" text shown in assignee column
- [x] Assignee dropdown defaults to "Unassigned" placeholder

#### EC-3: Duplicate task titles
- [x] No unique constraint on task title - duplicates are allowed
- [x] Database schema has no title uniqueness check

#### EC-4: Delete task with comments
- [x] Comments cascade on task deletion (activity_logs also cascade via PROJ-5)
- [x] AlertDialog confirmation shown before deletion
- [x] Task detail page mentions "all its comments" in delete confirmation

#### EC-5: Project is archived - tasks become read-only
- [x] Frontend: Create Task button hidden when `project.archived` is true
- [x] Frontend: Edit task dialog not rendered when project is archived
- [x] Frontend: Action dropdown hidden when `isArchived` is true
- [x] Frontend: Empty state shows archive-specific message
- [x] API POST: Returns 403 "Cannot create tasks in an archived project"
- [x] API PATCH: Returns 403 "Cannot modify tasks in an archived project"
- [x] API DELETE: Returns 403 "Cannot delete tasks in an archived project"

#### EC-6: Filtering shows no results
- [x] Empty state shows "No tasks match the current filters."
- [x] "Clear filters" link shown below the empty message

### Security Audit Results

- [x] Authentication: All API routes check `supabase.auth.getUser()` and return 401 if not authenticated
- [x] Authorization (workspace): All routes verify workspace membership before proceeding
- [x] Authorization (project): All routes verify project belongs to workspace
- [x] Authorization (delete): Delete permission correctly checks creator OR admin/owner
- [x] Input validation: Zod schemas validate all inputs server-side (title length, status enum, priority enum, UUID format)
- [x] Database constraints: CHECK constraints on title length, status enum, priority enum
- [x] RLS enabled: Row Level Security policies on tasks table for SELECT, INSERT, UPDATE, DELETE
- [x] RLS INSERT policy: Enforces `created_by = auth.uid()` preventing spoofing
- [x] SQL injection: Parameterized queries via Supabase client (safe)
- [x] XSS: React's JSX escaping handles output encoding; no `dangerouslySetInnerHTML` used
- [x] Archived project enforcement: API-level checks on POST, PATCH, DELETE prevent bypass
- [x] Rate limiting (POST): 60/hour/user via `checkRateLimit`
- [x] Rate limiting (PATCH): 120/hour/user via `checkRateLimit`
- [x] Rate limiting (DELETE): 60/hour/user via `checkRateLimit`
- [x] Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, Referrer-Policy all configured in `next.config.ts`
- [x] Middleware: Auth session refresh on every request, unauthenticated users redirected to login
- [x] No secrets exposed: Environment variables properly configured, `.env.local.example` documents required vars with dummy values
- [x] No raw SQL: All database queries use Supabase client parameterized queries
- [x] CSRF: Supabase auth tokens handled via httpOnly cookies through middleware
- [x] Defense in depth: Middleware auth check + API route auth check + RLS policies (3 layers)

### Regression Test Results

- [x] PROJ-1 (User Authentication): Login redirect, auth state, middleware all functioning
- [x] PROJ-2 (Workspace Management): Workspace switching, member management not affected by task changes
- [x] PROJ-3 (Project Management): Project API correctly integrates task counts for progress calculation; archived project enforcement working; project deletion blocked when tasks exist (returns 409)
- [x] Build: `next build` compiles successfully with 0 TypeScript errors and 0 warnings

### Bugs Found

None. All previously reported bugs (BUG-1 through BUG-8) have been fixed and verified.

### Summary
- **Acceptance Criteria:** 12/12 passed
- **Edge Cases:** 6/6 passed
- **Previous Bugs Fixed:** 8/8 (BUG-1 through BUG-8 all resolved)
- **New Bugs Found:** 0
- **Security:** All checks passing. Authentication, authorization, input validation, rate limiting, RLS, security headers, and defense-in-depth all verified.
- **Regression:** PROJ-1, PROJ-2, PROJ-3 all functioning correctly with task management integration.
- **Build:** PASS - compiles successfully with 0 errors, 0 warnings
- **Production Ready:** YES
- **Recommendation:** Deploy. All acceptance criteria pass, all edge cases handled, all 8 previously reported bugs fixed, security audit clean, and no regressions found.

## Deployment

- **Production URL:** https://pmgmt-eight.vercel.app
- **Deployed:** 2026-02-19
- **Vercel Project:** pmgmt
- **Auto-deployed via:** GitHub push to `main` (commit `28fec55`)
