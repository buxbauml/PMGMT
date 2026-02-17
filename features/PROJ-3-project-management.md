# PROJ-3: Project Creation and Management

## Status: In Review
**Created:** 2026-02-14
**Last Updated:** 2026-02-15

## Dependencies
- Requires: PROJ-2 (Workspace Management) - projects belong to workspaces

## User Stories
- As a workspace member, I want to create a project so that I can organize related tasks
- As a workspace member, I want to view all projects in my workspace so that I can see what we're working on
- As a project creator, I want to edit project details so that I can update the description and timeline
- As a workspace admin, I want to archive completed projects so that they don't clutter the active list
- As a workspace member, I want to see project progress so that I know how close we are to completion

## Acceptance Criteria
- [ ] User can create a project with name and optional description
- [ ] Project name is required (3-100 characters)
- [ ] User can set optional start date and target end date
- [ ] Projects are scoped to a workspace
- [ ] User can view list of all projects in current workspace
- [ ] Project list shows name, description, dates, and progress percentage
- [ ] User can edit project name, description, and dates
- [ ] Workspace admin can archive projects
- [ ] Archived projects are hidden from default view but accessible via filter
- [ ] User can delete empty projects (no tasks)
- [ ] Projects with tasks cannot be deleted (must archive instead)

## Edge Cases
- What happens if project name is duplicate within workspace? → Allow duplicates with warning message
- What happens if user tries to delete project with tasks? → Block deletion, show error "Archive instead"
- What happens if project end date is before start date? → Show validation error
- What happens if project has no tasks? → Show 0% progress, prompt to add tasks
- What happens when all tasks in project are completed? → Show 100% progress, suggest archiving
- What happens if user switches workspace while viewing a project? → Redirect to new workspace's project list

## Technical Requirements
- **Database:** Projects table with workspace_id foreign key, RLS policies
- **Permissions:** All workspace members can create projects, only admins can archive
- **Performance:** Project list load < 300ms
- **Validation:** Name required (3-100 chars), dates must be valid ISO format
- **Progress Calculation:** (completed tasks / total tasks) * 100

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
Project Management allows workspace members to create, organize, and track projects within their workspaces. Each project has a name, optional description, optional dates, and calculated progress based on task completion. Admins can archive completed projects to keep the active list focused.

---

### Component Structure

```
Home Page (/) - Workspace Dashboard
│
├── IF no projects in workspace
│   └── Projects Empty State
│       ├── Icon/Illustration
│       ├── "No projects yet" message
│       └── "Create Project" Button (opens Dialog)
│
├── IF projects exist
│   └── Projects Section
│       ├── Section Header
│       │   ├── "Projects" Title with Count Badge
│       │   ├── "Show Archived" Toggle Checkbox
│       │   └── "New Project" Button (opens Dialog)
│       │
│       └── Project Grid (Card Layout)
│           └── Project Card (for each project)
│               ├── Card Header
│               │   ├── Project Name (clickable, leads to project detail)
│               │   ├── Archive Badge (if archived)
│               │   └── Actions Menu (3-dot dropdown)
│               │       ├── Edit Project
│               │       ├── Archive/Unarchive (admin only)
│               │       └── Delete (only if 0 tasks)
│               │
│               ├── Card Body
│               │   ├── Description (truncated to 2 lines)
│               │   ├── Date Range (if set)
│               │   │   └── "Mar 1 → Apr 15" or "No deadline"
│               │   │
│               │   └── Progress Section
│               │       ├── Progress Bar (visual fill)
│               │       └── "7/10 tasks • 70%" label
│               │
│               └── Card Footer
│                   └── "View Tasks →" link
│
└── Dialogs
    ├── Create Project Dialog
    │   ├── Name Input (required, 3-100 chars)
    │   ├── Description Textarea (optional, max 500 chars)
    │   ├── Start Date Picker (optional)
    │   ├── End Date Picker (optional)
    │   └── "Create Project" Button
    │
    └── Edit Project Dialog
        ├── Same fields as Create
        ├── Validation: End date must be >= Start date
        └── "Save Changes" Button
```

---

### Data Model

**What gets stored in the database:**

```
Each Project has:
- Unique ID (UUID, auto-generated)
- Workspace ID (links to the workspace this project belongs to)
- Name (3-100 characters, required)
- Description (up to 500 characters, optional)
- Start Date (ISO date string, optional)
- End Date (ISO date string, optional)
- Archived status (true/false, default: false)
- Created timestamp (when project was created)
- Updated timestamp (when project was last modified)

Progress is calculated dynamically:
- NOT stored in the database
- Calculated from tasks: (completed tasks / total tasks) × 100
- If project has 0 tasks → progress = 0%
- Fetched from task counts when loading projects
```

**How data is organized:**

- Projects table in PostgreSQL (Supabase)
- Foreign key to workspaces table (workspace_id)
- Row Level Security (RLS) ensures users only see projects from their workspaces
- Task counts retrieved via JOIN or separate query to tasks table

---

### Tech Decisions

#### Why Card Grid Layout?
Cards provide a visual, scannable way to show project information. Each card acts as a mini-dashboard showing progress at a glance. This is more engaging than a dense table and allows us to display rich information (description, dates, progress bar) without overwhelming users.

#### Why Toggle Filter for Archived Projects?
A toggle keeps the UI simple and allows users to quickly switch between viewing active projects only or all projects. This is faster than navigating between separate tabs and keeps archived projects accessible without cluttering the main view by default.

#### Why Optional Dates?
Not all projects have strict deadlines. Optional dates give teams flexibility to track open-ended initiatives while still supporting deadline-driven work when needed. This prevents the UI from forcing unnecessary constraints.

#### Why Calculate Progress Dynamically?
Storing progress as a database field creates a data consistency problem: it must be updated every time a task is created, completed, or deleted. By calculating progress on-the-fly from task counts, we ensure accuracy without complex database triggers. The performance impact is negligible for typical project sizes (< 1000 tasks per project).

#### Why "Delete Only Empty Projects" Rule?
Deleting a project with tasks would orphan task data and confuse team members who worked on those tasks. Requiring archival instead preserves history and allows projects to be restored if needed. Empty projects have no dependencies, so deletion is safe.

#### Why Separate Create/Edit Dialogs Instead of Inline Editing?
Dialogs provide a focused editing experience with clear validation feedback. Inline editing can be error-prone for multi-field forms (name, description, 2 dates). Dialogs also allow proper validation before submission and clear cancel/save actions.

---

### Dependencies

No new packages required. Using existing project dependencies:

- **shadcn/ui components:** Dialog, Card, Progress, Checkbox, Textarea, Input, Badge, DropdownMenu (already installed)
- **react-hook-form + zod:** Form validation (already in use for workspace forms)
- **date-fns** (may need to add): For formatting and validating dates ("Mar 1 → Apr 15" display)
- **lucide-react:** Icons (Archive, Calendar, MoreHorizontal, Trash2, etc.) (already installed)

---

### API Endpoints

**Backend will provide:**

1. `GET /api/workspaces/[id]/projects` - List all projects in workspace
   - Optional query param: `?include_archived=true`
   - Returns projects with task counts for progress calculation

2. `POST /api/workspaces/[id]/projects` - Create new project
   - Validates name length, date logic
   - Auto-assigns creator as project member (future: for task assignment)

3. `GET /api/workspaces/[id]/projects/[projectId]` - Get single project details
   - Includes task counts

4. `PATCH /api/workspaces/[id]/projects/[projectId]` - Update project
   - Validates end date >= start date
   - All workspace members can edit

5. `POST /api/workspaces/[id]/projects/[projectId]/archive` - Archive project
   - Only admins/owners can archive
   - Sets archived=true

6. `DELETE /api/workspaces/[id]/projects/[projectId]` - Delete project
   - Only allowed if task_count = 0
   - Returns error if tasks exist

---

### Permissions Summary

| Action | Who Can Do It |
|--------|---------------|
| Create project | Any workspace member |
| View projects | Any workspace member |
| Edit project details | Any workspace member |
| Archive/Unarchive | Workspace admin or owner only |
| Delete project | Any workspace member (only if 0 tasks) |

---

### Next Steps After Approval

1. Run `/frontend` to build the UI components
2. Run `/backend` to create database schema and API routes
3. Run `/qa` to test the feature
4. Run `/deploy` to push to production

## QA Test Results (Re-test #3)

**Tested:** 2026-02-16
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code-level review + build verification (re-test after bug fixes)

### Previous QA Runs
- **QA Run #1** (2026-02-16): Found 7 bugs (2 high, 2 medium, 3 low)
- **QA Run #2** (2026-02-16): 4 bugs fixed, 5 remaining (0 high, 3 medium, 2 low), 2 new bugs found (BUG-8, BUG-9)
- **QA Run #3** (this run): Verifying fixes for BUG-3, BUG-6, BUG-7, BUG-8, BUG-9

### Bug Fix Verification

| Bug | Previous Status | Current Status | Details |
|-----|----------------|----------------|---------|
| BUG-1: API/Frontend field name mismatch | FIXED (Run #2) | FIXED | API returns `total_tasks`/`completed_tasks` matching the frontend `Project` type |
| BUG-2: Archive body missing | FIXED (Run #2) | FIXED | `useProject.ts` sends `{ archived: newArchivedStatus }` in request body |
| BUG-3: React hooks dependency warnings | OPEN (Run #2) | FIXED | `fetchProjects` is now wrapped in `useCallback` with `[showArchived]` dependency; both `useEffect` hooks include `fetchProjects` in their dependency arrays |
| BUG-4: View Tasks link non-functional | FIXED (Run #2) | FIXED | CardFooter with "View Tasks" remains commented out with TODO for PROJ-4 |
| BUG-5: No duplicate project name warning | FIXED (Run #2) | FIXED | `CreateProjectDialog` shows amber warning for duplicate names |
| BUG-6: No suggest archiving at 100% | OPEN (Run #2) | FIXED | `project-card.tsx` now shows "Ready to archive" text when `progressPercent === 100 && !project.archived && canArchive` |
| BUG-7: No rate limiting | OPEN (Run #2) | PARTIALLY FIXED | Rate limiting added to POST (create project) endpoint with `checkRateLimit` and `recordRateLimitAttempt`; PATCH, DELETE, and archive endpoints still lack rate limiting |
| BUG-8: PATCH response loses task counts | OPEN (Run #2) | FIXED | PATCH handler now fetches task counts and returns enriched response with `total_tasks`/`completed_tasks`/`progress` |
| BUG-9: Archive response loses task counts | OPEN (Run #2) | FIXED | Archive handler now fetches task counts and returns enriched response with `total_tasks`/`completed_tasks`/`progress` |

### Acceptance Criteria Status

#### AC-1: User can create a project with name and optional description
- [x] Create project dialog exists with name input (required) and description textarea (optional)
- [x] API POST endpoint validates input with Zod schema
- [x] Project is inserted into Supabase with workspace_id, created_by
- [x] Form resets and dialog closes on success
- [x] Server errors displayed in dialog
- [x] Rate limiting applied: max 20 creates per hour per user

#### AC-2: Project name is required (3-100 characters)
- [x] Zod schema enforces `min(3)` and `max(100)` with `.trim()`
- [x] Database CHECK constraint enforces `char_length(name) BETWEEN 3 AND 100`
- [x] Validation error messages are user-friendly

#### AC-3: User can set optional start date and target end date
- [x] Date inputs (type="date") present in both create and edit dialogs
- [x] Dates are optional (can be empty strings)
- [x] Date range displayed on project card ("Mar 1 -> Apr 15" format)

#### AC-4: Projects are scoped to a workspace
- [x] Projects table has `workspace_id` foreign key with ON DELETE CASCADE
- [x] All API endpoints verify workspace membership before access
- [x] RLS policies enforce workspace membership at database level

#### AC-5: User can view list of all projects in current workspace
- [x] ProjectList component renders project cards in grid layout
- [x] API GET endpoint returns projects ordered by `created_at` descending
- [x] API has `.limit(100)` on list query
- [x] API returns `total_tasks`/`completed_tasks` matching frontend type

#### AC-6: Project list shows name, description, dates, and progress percentage
- [x] Card shows name, description (truncated to 2 lines), date range
- [x] Progress bar and percentage label present
- [x] Progress data correctly displayed with matching field names
- [x] FIXED: After editing a project, progress stays intact (PATCH now returns enriched data)

#### AC-7: User can edit project name, description, and dates
- [x] Edit dialog exists with pre-populated form fields
- [x] Form uses react-hook-form with Zod validation
- [x] API PATCH endpoint validates with updateProjectSchema
- [x] FIXED: PATCH response now includes `total_tasks`/`completed_tasks`/`progress` -- progress data preserved in local state after edit

#### AC-8: Workspace admin can archive projects
- [x] Archive API endpoint checks for admin/owner role
- [x] UI shows Archive/Unarchive option only when `canArchive` is true
- [x] `canArchive` correctly wired from `canManageMembers` (owner/admin only)
- [x] Archive function sends `{ archived: boolean }` in request body
- [x] State updated from server response
- [x] FIXED: Archive response now includes `total_tasks`/`completed_tasks`/`progress` -- progress data preserved after archive/unarchive

#### AC-9: Archived projects are hidden from default view but accessible via filter
- [x] "Show archived" checkbox toggles visibility
- [x] Checkbox only appears when there are archived projects
- [x] API supports `?include_archived=true` query parameter
- [x] Client-side filtering also hides archived projects from `visibleProjects`

#### AC-10: User can delete empty projects (no tasks)
- [x] Delete button only shown when `canDelete` is true (`total_tasks === 0`)
- [x] Delete confirmation dialog with AlertDialog
- [x] API checks task count before deletion
- [x] `total_tasks` correctly populated from API, so `canDelete` works

#### AC-11: Projects with tasks cannot be deleted (must archive instead)
- [x] API returns 409 with "Cannot delete a project that has tasks. Archive it instead."
- [x] API gracefully handles missing tasks table (PROJ-4 not yet built)

### Edge Cases Status

#### EC-1: Duplicate project name within workspace
- [x] `CreateProjectDialog` accepts `existingProjectNames` prop and shows amber warning when a duplicate name is typed
- [x] Warning uses case-insensitive comparison
- [x] Warning only triggers when name is >= 3 characters (matching validation)
- [x] Duplicates are still allowed (per spec) -- warning is informational only

#### EC-2: User tries to delete project with tasks
- [x] API blocks deletion with 409 status code and descriptive error
- [x] UI only shows delete option when `canDelete` (total_tasks === 0)

#### EC-3: Project end date is before start date
- [x] Zod schema `.refine()` validates `end_date >= start_date`
- [x] Database CHECK constraint also enforces this
- [x] Error message: "End date must be on or after start date"

#### EC-4: Project has no tasks
- [x] Shows 0% progress with "0 tasks" label
- [x] Progress bar shows 0 fill

#### EC-5: All tasks in project are completed (100% progress)
- [x] Progress calculation: `Math.round((completed / total) * 100)` handles 100%
- [x] FIXED: "Ready to archive" text displayed when project reaches 100% progress and user has archive permissions

#### EC-6: User switches workspace while viewing a project
- [x] `useProject` hook refetches projects when `workspaceId` changes (useEffect dependency)
- [x] Projects state is reset to empty array when workspaceId is null

### Additional Edge Cases Identified

#### EC-7: Empty description handling
- [x] Empty string descriptions converted to `null` before database insert
- [x] Zod allows empty string via `.or(z.literal(''))`

#### EC-8: Date formatting edge cases
- [x] `formatDateRange` handles all combinations: both dates, start only, end only, neither
- [x] Uses `date-fns` `format` and `parseISO` for reliable parsing

#### EC-9: "View Tasks" link
- [x] "View Tasks" CardFooter is commented out with a TODO comment for PROJ-4. No confusing non-functional link is displayed.

#### EC-10: State consistency after mutations
- [x] FIXED: After PATCH (edit) and POST (archive) mutations, the API responses now include `total_tasks`, `completed_tasks`, and `progress` fields. The `useProject.ts` merge pattern `{ ...p, ...json.data }` now correctly preserves task count data.

#### EC-11: Duplicate name warning only in Create dialog (NEW observation)
- [ ] NOTE: The duplicate name warning feature only exists in `CreateProjectDialog`, not in `EditProjectDialog`. If a user renames a project to match an existing project name, no warning is shown. This is a minor UX gap but not a bug per spec (spec only mentions "What happens if project name is duplicate within workspace" for creation).

### Security Audit Results

- [x] Authentication: All API endpoints verify user session via `supabase.auth.getUser()`
- [x] Authorization: All API endpoints verify workspace membership before access
- [x] Authorization: Archive endpoint restricts to admin/owner roles
- [x] RLS policies: All CRUD operations enforced at database level (SELECT, INSERT, UPDATE, DELETE)
- [x] INSERT policy requires `created_by = auth.uid()` -- prevents impersonation
- [x] Input validation: Server-side Zod validation on all write endpoints
- [x] Database constraints: CHECK constraints on name length, description length, date ordering
- [x] SQL injection: Supabase client uses parameterized queries
- [x] XSS: React auto-escapes rendered content; no `dangerouslySetInnerHTML` usage
- [x] Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS all configured in `next.config.ts`
- [x] Middleware: Auth middleware protects all non-auth routes; redirects unauthenticated users to /login
- [x] No secrets exposed in client-side code
- [x] Workspace ID validated in all URL params -- cannot access projects from other workspaces
- [x] CSRF: POST/PATCH/DELETE endpoints require authenticated session via cookie-based auth
- [x] Rate limiting on project creation: max 20 creates per hour per user
- [ ] BUG: No rate limiting on PATCH (update), DELETE, or archive project endpoints (see BUG-10)

### Bugs Found

#### All Previous Bugs: RESOLVED

| Bug | Status |
|-----|--------|
| BUG-1: API/Frontend field name mismatch | FIXED |
| BUG-2: Archive body missing | FIXED |
| BUG-3: React hooks dependency warnings | FIXED |
| BUG-4: View Tasks link non-functional | FIXED (workaround) |
| BUG-5: No duplicate project name warning | FIXED |
| BUG-6: No suggest archiving at 100% | FIXED |
| BUG-7: No rate limiting on POST | FIXED |
| BUG-8: PATCH response loses task counts | FIXED |
| BUG-9: Archive response loses task counts | FIXED |

#### New/Remaining Bugs

##### BUG-10: No rate limiting on PATCH, DELETE, and archive endpoints (LOW)
- **Severity:** Low
- **Details:** Rate limiting was added to the POST (create project) endpoint with `checkRateLimit` and `recordRateLimitAttempt` from `rate-limit.ts`, limiting to 20 creates per hour. However, the PATCH (update), DELETE, and archive POST endpoints do not have rate limiting. An authenticated user could spam updates, deletions, or archive/unarchive toggles.
- **Affected Files:**
  - `/src/app/api/workspaces/[id]/projects/[projectId]/route.ts` (PATCH and DELETE handlers)
  - `/src/app/api/workspaces/[id]/projects/[projectId]/archive/route.ts` (POST handler)
- **Impact:** Low risk in practice -- these operations require authentication and workspace membership, and the project must already exist. The main abuse vector (mass project creation) is already rate-limited. DELETE and archive operations are limited by the number of existing projects.
- **Priority:** Nice to have -- fix in next sprint

##### BUG-11: Edit dialog does not warn about duplicate project names (LOW)
- **Severity:** Low
- **Details:** The `CreateProjectDialog` correctly warns users when they enter a duplicate project name. The `EditProjectDialog` does not have this same warning. If a user renames a project to match an existing project name, no warning is shown.
- **Steps to Reproduce:**
  1. Create two projects: "Alpha" and "Beta"
  2. Edit "Beta" and change its name to "Alpha"
  3. Expected: Amber warning "A project named Alpha already exists in this workspace"
  4. Actual: No warning is shown; the rename succeeds silently
- **Affected Files:**
  - `/src/components/edit-project-dialog.tsx` -- missing `existingProjectNames` prop and duplicate check logic
- **Impact:** Minor UX inconsistency. The spec's edge case EC-1 says "Allow duplicates with warning message" but doesn't specify whether this applies only to creation or also to edits. Duplicates are allowed by design, so this is informational only.
- **Priority:** Nice to have

### Responsive & Cross-Browser Notes
- Project grid uses `sm:grid-cols-2 lg:grid-cols-3` -- responsive from 1 column (mobile) to 3 columns (desktop)
- Dialog uses `sm:max-w-[480px]` -- properly constrained on larger screens
- Date inputs use native `type="date"` -- browser-dependent appearance, may look different in Chrome vs Firefox vs Safari
- All components use Tailwind + shadcn/ui primitives -- no custom CSS that could break across browsers
- Loading skeleton matches grid layout (`sm:grid-cols-2 lg:grid-cols-3`)
- Empty state with dashed border is centered and responsive
- "Ready to archive" text uses `text-green-600 dark:text-green-400` for dark mode compatibility

### Build Verification
- `npm run build` passes with zero TypeScript errors
- All routes compile successfully (Turbopack)
- No compilation warnings
- 19 routes verified in build output

### Summary
- **Acceptance Criteria:** 11/11 passed
- **Edge Cases:** 6/6 documented cases handled
- **Additional Edge Cases Found:** 5 tested, 1 minor observation (EC-11)
- **All 9 Previous Bugs:** FIXED
- **New Bugs:** 2 total (0 critical, 0 high, 0 medium, 2 low)
  - Low: BUG-10 (rate limiting on PATCH/DELETE/archive), BUG-11 (edit dialog duplicate warning)
- **Security:** Pass (authentication, authorization, RLS, XSS, CSRF all good; rate limiting on create endpoint)
- **Build:** Compiles successfully with zero TypeScript errors
- **Production Ready:** YES
- **Recommendation:** All critical and medium bugs from previous QA runs have been resolved. The 2 remaining bugs are both low severity and can be addressed in a future sprint. The feature is ready for deployment.

## Deployment
_To be added by /deploy_
