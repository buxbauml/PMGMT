# PROJ-5: Task Comments and Activity

## Status: In Review
**Created:** 2026-02-14
**Last Updated:** 2026-02-16

## Dependencies
- Requires: PROJ-4 (Task Management) - comments are attached to tasks

## User Stories
- As a workspace member, I want to comment on tasks so that I can discuss work with my team
- As a task assignee, I want to see all comments on a task so that I understand the context
- As a comment author, I want to edit or delete my comments so that I can correct mistakes
- As a workspace member, I want to see task activity history so that I know what changed
- As a workspace member, I want to see who commented and when so that I can follow the conversation

## Acceptance Criteria
- [ ] User can add comments to any task in their workspace
- [ ] Comment text is required (1-2000 characters)
- [ ] Comments display author name, avatar, and timestamp
- [ ] Comments are sorted chronologically (oldest first)
- [ ] User can edit their own comments within 15 minutes of posting
- [ ] User can delete their own comments
- [ ] Workspace admin can delete any comment
- [ ] Task activity feed shows status changes, assignment changes, and completion
- [ ] Activity items show who made the change and when
- [ ] Activity feed is mixed with comments in chronological order

## Edge Cases
- What happens if user deletes a comment? → Show "[Comment deleted]" placeholder to preserve context
- What happens if comment author is removed from workspace? → Comment remains, show "[Former member]" as author
- What happens if task is deleted? → All comments are deleted too
- What happens if user edits comment after 15 minutes? → Edit button is disabled, show "Edit window expired"
- What happens if two users comment simultaneously? → Both comments appear, sorted by server timestamp
- What happens if comment contains only whitespace? → Show validation error "Comment cannot be empty"

## Technical Requirements
- **Database:** Comments table with task_id and user_id foreign keys, activity_logs table, RLS policies
- **Permissions:** All workspace members can comment, admins can delete any comment
- **Performance:** Comment list load < 200ms, new comment save < 300ms
- **Validation:** Comment text required (1-2000 chars)
- **Edit Window:** 15 minutes from created_at timestamp
- **Activity Types:** status_changed, assigned, unassigned, completed, created

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
Task Comments and Activity adds collaborative discussion and change tracking to tasks. Team members can add comments to discuss work, and an activity feed automatically shows who changed what and when. This creates a complete history for each task, combining manual comments with system-generated activity logs.

---

### Component Structure

```
Task Detail Page (/projects/[projectId]/tasks/[taskId])
│
├── Page Header
│   ├── Back Button (to project task list)
│   ├── Task Title (large, editable inline)
│   ├── Task Metadata Row
│   │   ├── Status Badge (clickable dropdown to change)
│   │   ├── Priority Badge (clickable dropdown to change)
│   │   ├── Assignee Avatar + Name (clickable dropdown to reassign)
│   │   └── Created By + Date
│   └── Actions Menu (3-dot dropdown)
│       ├── Delete Task
│       └── Copy Link

├── Task Description Section
│   ├── Description Label
│   └── Description Text (editable inline, or "No description" empty state)

├── Comments & Activity Section
│   ├── Section Header
│   │   ├── "Activity" Title with Count Badge (total comments + activity items)
│   │   └── Filter Toggle (All / Comments Only / Activity Only)
│   │
│   ├── IF no comments/activity
│   │   └── Empty State
│   │       ├── Icon/Illustration
│   │       ├── "No activity yet" message
│   │       └── "Be the first to comment" prompt
│   │
│   ├── IF items exist
│   │   └── Activity Feed (chronological, oldest first)
│   │       ├── Comment Item (for each comment)
│   │       │   ├── Author Avatar + Name
│   │       │   ├── Timestamp (relative: "2 hours ago")
│   │       │   ├── Comment Text
│   │       │   ├── Edited Badge (if edited)
│   │       │   └── Actions Dropdown (if owner or admin)
│   │       │       ├── Edit (if < 15 min old)
│   │       │       └── Delete
│   │       │
│   │       └── Activity Item (for each system event)
│   │           ├── System Icon (colored dot)
│   │           ├── Activity Description (e.g., "Alice changed status from To Do to In Progress")
│   │           └── Timestamp (relative)
│   │
│   └── Add Comment Form (at bottom)
│       ├── Author Avatar (current user)
│       ├── Textarea (placeholder: "Add a comment...")
│       ├── Character Counter (X / 2000)
│       └── Submit Button

└── Dialogs
    └── Edit Comment Dialog
        ├── Textarea (pre-filled with current comment text)
        ├── Character Counter
        ├── Cancel Button
        └── Save Button
```

---

### Data Model

**Comment Information Stored:**

Each comment contains:
- **Unique ID** - Generated automatically by database
- **Task ID** - Which task this comment belongs to
- **User ID** - Who wrote the comment
- **Comment Text** - The actual message (1-2000 characters, required)
- **Created At** - When the comment was posted
- **Updated At** - When the comment was last edited (if edited)
- **Deleted** - Whether the comment was soft-deleted (true/false)

**Activity Log Information Stored:**

Each activity event contains:
- **Unique ID** - Generated automatically
- **Task ID** - Which task this activity relates to
- **User ID** - Who made the change
- **Activity Type** - What kind of change (status_changed, assigned, unassigned, completed, created)
- **Old Value** - What the field was before (optional, for status/assignment changes)
- **New Value** - What the field is now (optional)
- **Created At** - When the activity happened

**Storage Location:**
- Stored in: Database (Supabase PostgreSQL)
- Two tables: `comments` and `activity_logs`
- Reason: Comments need to sync across devices and be visible to all team members. Activity logs create an audit trail.

**Relationships:**
- Comments belong to ONE task
- Activity logs belong to ONE task
- When a task is deleted, all its comments and activity logs are deleted too (CASCADE)
- When a workspace member is removed, their comments remain but show "[Former member]" as author
- Comments can be soft-deleted (marked deleted but not removed from database)

**Edit Window Logic:**
- Comments can be edited for 15 minutes after creation
- Frontend checks: `(now - created_at) < 15 minutes`
- After 15 minutes, edit button is disabled with tooltip "Edit window expired"

---

### Tech Decisions

**1. Why a separate Task Detail Page instead of showing comments in a dialog?**
- Tasks with rich discussion need more screen space than a modal provides
- Gives each task its own URL that can be shared with teammates
- Better for accessibility (escape key doesn't close the page)
- Easier to link directly to a specific task from notifications or external tools

**2. Why mix comments and activity in one timeline?**
- Provides complete context: see when someone commented AND when the status changed
- Mirrors real-world team tools (Jira, Linear, Asana all do this)
- Easier to understand the sequence of events
- Example: "Why was this task marked done?" → See comment explaining it right above the activity

**3. Why oldest-first sorting instead of newest-first?**
- Conversations read naturally top-to-bottom (like chat or email threads)
- Users scroll down to see latest updates and add their own comment at the bottom
- Activity feeds that are newest-first feel backwards for discussion

**4. Why allow editing for only 15 minutes?**
- Short window prevents abuse (can't change what you said days later)
- Long enough to fix typos or clarify immediately
- Matches typical team communication tools
- If you need to correct after 15 minutes, just add a new comment

**5. Why soft-delete comments instead of hard-delete?**
- Preserves conversation context: if Alice says "Agreed!" and Bob's comment is deleted, Alice's reply looks orphaned
- Shows "[Comment deleted]" placeholder so the timeline still makes sense
- Prevents confusion when someone refers to a comment that's now gone
- Can be purged later by background job if needed

**6. Why not use a rich text editor for comments?**
- Plain text keeps it simple and fast
- Most task comments are short updates, not formatted documents
- Avoids XSS risks and parsing complexity
- Users can use markdown syntax informally (we just store plain text)
- Rich formatting can be added later if users request it

**7. Why separate Activity Logs table instead of parsing task history?**
- Explicit activity events are faster to query than computing diffs
- Allows capturing "why" context (e.g., who closed the task and when)
- Easier to filter: "show me all tasks Alice completed this week"
- Enables future features like notifications ("task assigned to you")

**8. Why show activity for status, assignment, and completion but not title edits?**
- Status, assignment, and completion are high-signal changes teams care about
- Title/description edits happen frequently and would clutter the feed
- Users can see title/description were updated via the `updated_at` timestamp

---

### Dependencies

**New packages to install:**
- None! All necessary UI components (Avatar, Badge, Button, Textarea, Dialog) are already installed from previous features

**Already available components to use:**
- `Avatar` - For comment author photos
- `Badge` - For status/priority in task header
- `Button` - For actions
- `Textarea` - For comment input
- `Dialog` - For edit comment modal
- `DropdownMenu` - For quick status/priority/assignee changes

---

### Database & API Structure

**Database Changes Needed:**
- New `comments` table with task_id and user_id foreign keys
- New `activity_logs` table with task_id and user_id foreign keys
- Security rules (RLS policies) so workspace members can only see comments/activity for tasks in their workspace
- Indexes for fast loading by task_id

**API Endpoints Needed:**
- `GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]` - Get single task with full details (already exists from PROJ-4, may need enrichment)
- `GET /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/activity` - Get comments + activity logs for a task (merged, sorted chronologically)
- `POST /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments` - Add a new comment
- `PATCH /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]` - Edit a comment (with 15-min window check)
- `DELETE /api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]` - Delete a comment (soft-delete, set deleted=true)

**Activity Log Generation:**
- When task status changes (via PATCH `/tasks/[taskId]`), insert an activity log entry
- When task assignee changes, insert an activity log entry
- When task is marked completed, insert an activity log entry
- When task is created, insert an activity log entry

**Security:**
- Only workspace members can view/post comments on tasks in their workspace's projects
- Comment authors can edit/delete their own comments
- Workspace admins can delete any comment
- Edit window enforced server-side: check `created_at + 15 minutes > now()`

---

### User Experience Flow

**Viewing a Task:**
1. User clicks task title from project task list
2. Browser navigates to `/projects/[projectId]/tasks/[taskId]`
3. Page loads with task details, description, and activity feed
4. Comments and activity logs are shown in chronological order
5. User scrolls to see full history

**Adding a Comment:**
1. User types in the "Add a comment" textarea at bottom of page
2. Character counter shows remaining characters (X / 2000)
3. User clicks "Comment" button
4. Comment appears immediately in the feed (optimistic update)
5. Other team members see the new comment when they reload or view the task

**Editing a Comment (within 15 minutes):**
1. User clicks "Edit" from their comment's action menu
2. Dialog opens with current comment text pre-filled
3. User modifies the text
4. User clicks "Save"
5. Comment updates inline with "(edited)" badge
6. After 15 minutes, "Edit" option is grayed out or hidden

**Seeing Activity:**
1. User views task activity feed
2. System-generated events (status changes, assignments) appear with colored dot icon
3. Activity items show: "Alice changed status from To Do to In Progress - 2 hours ago"
4. Activity is mixed with comments in chronological order
5. User can filter to "Comments Only" or "Activity Only" if feed is long

**Former Member Handling:**
1. Admin removes Bob from the workspace
2. Bob's existing comments remain visible
3. Comments show "[Former member]" instead of Bob's name
4. Bob's avatar is replaced with a generic icon
5. Other team members can still read Bob's comments for context

## QA Test Results

**Tested:** 2026-02-17 (Re-test after bug fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (Next.js 16.1.1 Turbopack build compiles successfully, all routes registered)

---

### Acceptance Criteria Status

#### AC-1: User can add comments to any task in their workspace
- [x] POST `/api/.../tasks/[taskId]/comments` endpoint exists and properly validates workspace membership
- [x] Comment form component (`comment-form.tsx`) renders with textarea, character counter, and submit button
- [x] Optimistic update adds comment to local state immediately via `useTaskActivity` hook
- [x] Auth check: returns 401 if not logged in
- [x] Membership check: returns 403 if user is not a workspace member
- [x] Project/task validation: returns 404 if project or task doesn't exist
- [x] Archived project check: returns 403 if project is archived

#### AC-2: Comment text is required (1-2000 characters)
- [x] Zod schema validates min 1 char, max 2000 chars with trim
- [x] Database CHECK constraint enforces `char_length(content) BETWEEN 1 AND 2000`
- [x] Frontend character counter shows `X / 2000` with red color when exceeded
- [x] Submit button is disabled when content is empty or exceeds 2000 chars

#### AC-3: Comments display author name, avatar, and timestamp
- [x] Comment items show author avatar (initials fallback), name, and relative timestamp
- [x] Author data joined via `profiles` table in Supabase query
- [x] Relative timestamps via `date-fns` `formatDistanceToNow`

#### AC-4: Comments are sorted chronologically (oldest first)
- [x] Activity API orders by `created_at ASC`
- [x] Frontend `useTaskActivity` hook sorts merged timeline by `created_at` ascending
- [x] Database index `idx_comments_task_created` supports efficient chronological queries

#### AC-5: User can edit their own comments within 15 minutes of posting
- [x] PATCH endpoint checks `comment.user_id !== user.id` for ownership
- [x] 15-minute window calculated server-side: `diffMs > fifteenMinutes` returns 403
- [x] Frontend `isWithinEditWindow()` function shows/hides edit button
- [x] Edit dialog pre-fills current comment text, validates 1-2000 chars
- [x] "(edited)" badge shown when `updated_at !== created_at`
- [x] After 15 minutes, edit button is disabled with "Edit window expired" tooltip

#### AC-6: User can delete their own comments
- [x] DELETE endpoint checks `comment.user_id === user.id` for ownership
- [x] Delete confirmation dialog shown before executing
- [x] Soft-delete sets `content: '[deleted]'` which satisfies CHECK constraint (BUG-1 FIXED)
- [x] Frontend shows "[Comment deleted]" placeholder for soft-deleted comments

#### AC-7: Workspace admin can delete any comment
- [x] API route checks `['owner', 'admin'].includes(membership.role)` for admin access
- [x] RLS UPDATE policy now includes admin/owner check via workspace_members role (BUG-2 FIXED)

#### AC-8: Task activity feed shows status changes, assignment changes, and completion
- [x] Task PATCH endpoint generates activity log entries for status_changed, assigned, unassigned, completed
- [x] Task POST (creation) generates "created" activity log entry
- [x] Activity icons: colored dots for each activity type (blue=status, green=completed, indigo=assigned, etc.)
- [x] Assignment activity now resolves UUIDs to display names before storing (BUG-3 FIXED)

#### AC-9: Activity items show who made the change and when
- [x] Activity logs joined with `profiles` table to get user name/email/avatar
- [x] Relative timestamps shown for each activity item
- [x] Former member handling: shows "[Former member]" when `is_member` is false

#### AC-10: Activity feed is mixed with comments in chronological order
- [x] `useTaskActivity` hook merges comments and activity_logs into unified `TimelineItem[]`
- [x] Sort by `created_at` ascending (oldest first)
- [x] Filter toggle: "All" / "Comments" / "Activity" buttons in section header
- [x] Total count badge shows combined count of comments + activity items

---

### Edge Cases Status

#### EC-1: Deleted comment shows "[Comment deleted]" placeholder
- [x] Frontend `CommentItem` component checks `comment.deleted` and renders "[Comment deleted]" with generic avatar
- [x] Server-side soft-delete now works correctly: sets `content: '[deleted]'` (BUG-1 FIXED)

#### EC-2: Former member's comments show "[Former member]" as author
- [x] Activity API fetches current workspace member IDs and sets `is_member` field
- [x] Frontend renders "[Former member]" when `is_member` is false
- [x] Generic "?" avatar shown for former members
- [x] Comments are preserved when member is removed from workspace
- [x] Full account deletion now sets `user_id` to NULL via `ON DELETE SET NULL` (BUG-4 FIXED)

#### EC-3: Task deletion cascades to comments and activity logs
- [x] Database schema: `task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE` on both tables
- [x] Task DELETE API properly deletes task, and CASCADE handles cleanup

#### EC-4: Edit button disabled after 15 minutes with "Edit window expired" tooltip
- [x] Frontend `isWithinEditWindow()` returns false after 15 minutes
- [x] Disabled edit option shown with tooltip "Edit window expired" via TooltipProvider
- [x] Server-side enforces 15-minute check independently as a second line of defense

#### EC-5: Simultaneous comments sorted by server timestamp
- [x] Comments ordered by `created_at ASC` from database (server-generated timestamps)
- [x] New comments appended to local state array and timeline re-sorted on next fetch

#### EC-6: Whitespace-only comment shows validation error
- [x] Zod schema: `.trim().refine((val) => val.trim().length > 0, 'Comment cannot be empty')`
- [x] Frontend: `trimmedContent = content.trim()`, `charCount = trimmedContent.length`, submit disabled when charCount is 0
- [x] Double validation: both client-side and server-side reject whitespace-only input

---

### Security Audit Results

#### Authentication
- [x] All API routes check `supabase.auth.getUser()` and return 401 if not authenticated
- [x] Task detail page redirects to `/login` if not authenticated
- [x] Session cookie used for authentication (Supabase SSR)

#### Authorization
- [x] Workspace membership verified before any comment/activity operations
- [x] Comment edit restricted to comment author only (API + RLS)
- [x] Comment delete restricted to author or admin (API-level check + RLS UPDATE policy)
- [x] RLS UPDATE policy correctly allows both author and admin/owner for soft-delete (BUG-2 FIXED)
- [x] Project-to-workspace ownership verified (prevents accessing tasks across workspaces)
- [x] Task-to-project ownership verified

#### Input Validation
- [x] All inputs validated with Zod schemas before processing
- [x] XSS: Comment content stored as plain text, rendered via React JSX (auto-escaped by React)
- [x] No `dangerouslySetInnerHTML` or raw `innerHTML` usage anywhere in the codebase
- [x] SQL injection: Supabase client uses parameterized queries
- [x] Comment text: `.trim()` and `.refine()` prevent empty/whitespace injection
- [x] Invalid JSON body returns 400 error

#### Rate Limiting
- [x] Comment creation: 60/hour per user
- [x] Comment editing: 60/hour per user
- [x] Task updates: 120/hour per user
- [x] Rate limit returns 429 with reset countdown
- [x] In-memory rate limiter with periodic cleanup (acceptable for current scale)

#### Row Level Security
- [x] RLS enabled on `comments` and `activity_logs` tables
- [x] SELECT policies: workspace members can view comments/activity for their workspace tasks
- [x] INSERT policies: workspace members can insert comments/activity with correct user_id
- [x] UPDATE policy: comment author OR workspace admin/owner can update (correctly supports soft-delete)
- [x] DELETE policy: author or admin can delete
- [x] Activity logs: immutable (no UPDATE or DELETE policies) -- good audit trail

#### Data Exposure
- [x] API responses return only necessary fields (no raw database rows exposed)
- [x] User passwords/tokens not exposed in comment or activity responses
- [x] Profile data limited to name, email, avatar_url

#### Additional Security Observations
- [x] No environment variables or secrets hardcoded in source
- [x] Archived project protection: cannot comment on tasks in archived projects
- [x] Activity logs immutable: cannot be edited or deleted (good audit trail)
- [x] Orphaned comments (user_id NULL after account deletion) cannot be edited by anyone -- correct behavior

---

### Previously Reported Bugs -- Status

#### BUG-1 (was Critical): Soft-delete fails due to database CHECK constraint violation
- **Status:** FIXED
- **Fix Applied:** DELETE handler now sets `content: '[deleted]'` (9 chars) instead of `content: ''` (0 chars), satisfying the `CHECK (char_length(content) BETWEEN 1 AND 2000)` constraint.
- **Verified in:** `/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts` line 299

#### BUG-2 (was High): Admin/owner cannot soft-delete other users' comments (RLS policy mismatch)
- **Status:** FIXED
- **Fix Applied:** RLS UPDATE policy now includes `OR EXISTS (... workspace_members ... role IN ('owner', 'admin'))` check, allowing admins to perform soft-delete via UPDATE.
- **Verified in:** `/supabase/migrations/20260216_003_task_comments_activity.sql` lines 96-111

#### BUG-3 (was Medium): Assignment/unassignment activity displays raw UUIDs instead of user names
- **Status:** FIXED
- **Fix Applied:** Task PATCH route now resolves assignee UUIDs to display names via `profiles` table lookup before storing in `new_value`/`old_value`. Task POST route also resolves assignee name for initial assignment.
- **Verified in:** `/src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/route.ts` lines 274-327 and `/src/app/api/workspaces/[id]/projects/[projectId]/tasks/route.ts` lines 250-268

#### BUG-4 (was Low): User account deletion cascades to delete all comments
- **Status:** FIXED
- **Fix Applied:** Both `comments` and `activity_logs` tables now use `ON DELETE SET NULL` for `user_id` foreign key instead of `ON DELETE CASCADE`.
- **Verified in:** `/supabase/migrations/20260216_003_task_comments_activity.sql` lines 11 and 25

---

### New Observations (Non-blocking, Low Severity)

1. **No rate limiting on comment DELETE endpoint:** The POST (create) and PATCH (edit) comment routes have rate limiting, but the DELETE (soft-delete) route does not. Since users can only delete their own comments (limited set) and admins have legitimate bulk-delete needs, this is low-risk but noted for consistency.
2. **Optimistic delete state inconsistency:** The `useTaskActivity` hook sets `content: ''` in local state on delete, while the server sets `content: '[deleted]'`. This has no functional impact because the frontend checks `comment.deleted` first and renders the "[Comment deleted]" placeholder without using content. Data is consistent after page refresh.
3. **No real-time updates:** Comments and activity do not update in real-time for other users viewing the same task. They must refresh the page. Acceptable for MVP.
4. **Activity API makes duplicate workspace member queries:** The activity route fetches workspace members twice (once for comments, once for activity logs). Could be optimized to a single query.
5. **No auto-scroll after posting comment:** After posting a comment, the page does not auto-scroll to the new comment at the bottom. Minor UX enhancement opportunity.
6. **Loading skeleton and empty state:** Well-implemented loading state with skeleton components and proper "No activity yet" / "Be the first to comment" empty state.

---

### Summary
- **Acceptance Criteria:** 10/10 passed
- **Edge Cases:** 6/6 passed
- **Previously Reported Bugs:** 4/4 FIXED (BUG-1, BUG-2, BUG-3, BUG-4)
- **New Bugs Found:** 0
- **Security:** PASS (all checks passed, no vulnerabilities found)
- **Build:** PASS
- **Production Ready:** YES
- **Recommendation:** All critical, high, and medium bugs from the previous QA round have been fixed. The feature is ready for deployment.

## Deployment

- **Production URL:** https://pmgmt-eight.vercel.app
- **Deployed:** 2026-02-19
- **Vercel Project:** pmgmt
- **Auto-deployed via:** GitHub push to `main` (commit `28fec55`)
