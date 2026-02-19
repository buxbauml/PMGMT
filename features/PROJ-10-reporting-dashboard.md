# PROJ-10: Reporting Dashboard

## Status: In Review
**Created:** 2026-02-14
**Last Updated:** 2026-02-18

## Dependencies
- Requires: PROJ-4 (Task Management) - reports are based on task data
- Requires: PROJ-6 (Sprint Planning) - for sprint velocity metrics
- Optional: PROJ-9 (Time Tracking) - for time-based reports

## User Stories
- As a workspace admin, I want to see team velocity so that I can plan future sprints
- As a workspace member, I want to see task completion trends so that I know if we're improving
- As a workspace admin, I want to see member workload distribution so that I can balance assignments
- As a workspace member, I want to see sprint burndown so that I know if we'll hit our deadline
- As a workspace admin, I want to export reports so that I can share with stakeholders

## Acceptance Criteria
- [ ] Dashboard shows key metrics: total tasks, completed tasks, completion rate
- [ ] Dashboard shows team velocity (avg tasks completed per sprint)
- [ ] Dashboard shows task breakdown by status (To Do, In Progress, Done) as pie chart
- [ ] Dashboard shows task breakdown by assignee as bar chart
- [ ] Dashboard shows completion trend over time (last 8 weeks) as line chart
- [ ] Dashboard shows sprint burndown if active sprint exists
- [ ] User can filter reports by date range
- [ ] User can filter reports by project
- [ ] If time tracking is enabled, show total hours logged and avg time per task
- [ ] Workspace admin can export dashboard data as CSV

## Edge Cases
- What happens if workspace has no completed tasks? → Show empty state with encouragement message
- What happens if no sprints have been created? → Hide velocity metric, show message
- What happens if date range has no data? → Show "No data for selected period"
- What happens if chart has too many data points? → Aggregate by week instead of day
- What happens if user changes project filter? → Recalculate all metrics for that project only
- What happens if two admins export simultaneously? → Each gets their own CSV file

## Technical Requirements
- **Charts:** Use Recharts library for data visualization
- **Performance:** Dashboard load < 1000ms, chart render < 500ms
- **Permissions:** All workspace members can view dashboard, only admins can export
- **Calculations:**
  - Completion Rate = (completed_tasks / total_tasks) * 100
  - Velocity = avg(tasks_completed_per_sprint) over last 5 sprints
  - Burndown = ideal_remaining vs actual_remaining per day in sprint
- **Export Format:** CSV with columns: metric_name, value, date
- **Browser Support:** Modern browsers with Canvas support for charts

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
The Reporting Dashboard is a read-only analytics page that aggregates existing data (tasks, time logs, sprints, projects) into charts and summary metrics. **No new database tables are needed** — all data is computed by querying the existing tables server-side. The frontend uses Recharts (a lightweight React chart library) to render bar charts, pie charts, and line charts.

---

### Component Structure

```
/reports page (new)
+-- Reports Header
|   +-- Title + Workspace name
|   +-- Project Filter Dropdown (all projects or specific one)
+-- Stats Overview Row (4 metric cards)
|   +-- Total Tasks card
|   +-- Completion Rate card (% + mini progress bar)
|   +-- Avg Velocity card (tasks/sprint average)
|   +-- Total Hours Logged card (if time tracking data exists)
+-- Charts Row
|   +-- Tasks by Status (Pie/Donut Chart)
|   +-- Tasks by Assignee (Bar Chart - top assignees)
+-- Completion Trend (Line Chart — tasks completed per week, last 8 weeks)
+-- Sprint Burndown Section (shown only if active sprint exists)
|   +-- Burndown Chart (Line Chart: ideal vs actual remaining tasks per day)
+-- Export Button (admin/owner only → downloads CSV)
```

---

### Data Model (No New Tables)

All data is computed from existing tables:

```
Key Stats come from:
- tasks table → count total, count by status
- tasks.completed_at → completed count
- sprints + tasks → velocity calculation
- time_logs → total hours if PROJ-9 is active

Tasks by Assignee comes from:
- tasks.assignee_id grouped by user → count per person
- Joined with profiles table for names

Completion Trend (last 8 weeks) comes from:
- tasks.completed_at → group completed tasks by week

Sprint Burndown comes from:
- sprints.start_date, sprints.end_date → date range
- activity_logs (completed events) → which tasks were done on which day
- This gives: tasks remaining per day = total sprint tasks minus cumulative completions

CSV Export contains:
- All the above data in flat table format
```

---

### New API Endpoints

**`GET /api/workspaces/[id]/reports?projectId=&period=`**

Returns all aggregated data in a single call:
- Total/completed/in-progress/to-do task counts
- Per-assignee task counts (for bar chart)
- Per-week completion counts for the last 8 weeks (for trend line)
- Sprint velocity (last 5 completed sprints)
- Active sprint burndown data (if applicable)
- Total hours logged (from time_logs)

**`GET /api/workspaces/[id]/reports/export?projectId=`**

Admin-only endpoint that streams a CSV file with workspace metrics. No database changes needed — same data as above, formatted as CSV.

---

### Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Charts | Recharts library | Specified in requirements; lightweight (~60KB), React-native, no Canvas config needed |
| Data fetching | Single `/reports` API | One round-trip; server aggregates efficiently; client just renders |
| Burndown calculation | Uses existing `activity_logs` table | Completions are already recorded when tasks are marked done — no new tracking infra |
| Filtering | Project filter only (v1) | Date range adds significant complexity; project filter covers 80% of use cases |
| Export | Browser-streamed CSV | No server storage needed; simple and secure |
| Permissions | Backend checks for team data | API returns empty arrays for non-admin member data; never trust frontend-only hiding |

---

### New Files Needed

| File | Purpose |
|------|---------|
| `src/app/reports/page.tsx` | Main reports page with filter + all sections |
| `src/components/report-stat-card.tsx` | Metric card (number + label) — reusable |
| `src/components/report-status-chart.tsx` | Pie chart of tasks by status |
| `src/components/report-assignee-chart.tsx` | Bar chart of tasks per assignee |
| `src/components/report-trend-chart.tsx` | Line chart of weekly completions |
| `src/components/report-burndown-chart.tsx` | Sprint burndown line chart |
| `src/app/api/workspaces/[id]/reports/route.ts` | Aggregation API (GET) |
| `src/app/api/workspaces/[id]/reports/export/route.ts` | CSV export API (GET, admin only) |

---

### Dependencies

**New package to install:**
- `recharts` — React charting library (bar, pie, line charts)

**Existing UI components reused:**
- `src/components/ui/card.tsx` — stat cards
- `src/components/ui/tabs.tsx` — optional tab layout
- `src/components/ui/select.tsx` — project filter dropdown
- `src/components/ui/badge.tsx` — status labels
- `src/components/ui/progress.tsx` — completion % bars
- `src/components/ui/button.tsx` — export button

## QA Test Results

**Tested:** 2026-02-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Dashboard shows key metrics (total tasks, completed tasks, completion rate)
- [x] API returns `totalTasks`, `completedTasks`, `completionRate` correctly computed
- [x] Frontend displays "Total Tasks" stat card with numeric value
- [x] Frontend displays "Completion Rate" stat card with percentage and progress bar
- [x] Completion rate formula matches spec: `(completed / total) * 100`, rounded to integer

#### AC-2: Dashboard shows team velocity (avg tasks completed per sprint)
- [x] API computes velocity from last 5 completed sprints
- [x] Velocity = `round(total_done_tasks / sprint_count, 1)`
- [x] "Avg Velocity" stat card shows value with "tasks/sprint" suffix
- [x] Shows "N/A" with "No completed sprints yet" subtitle when no sprints exist

#### AC-3: Dashboard shows task breakdown by status as pie chart
- [x] API returns `statusBreakdown` array with To Do, In Progress, Done counts
- [x] `ReportStatusChart` renders a donut (pie) chart via Recharts
- [x] Color-coded: slate for To Do, blue for In Progress, green for Done
- [x] Displays percentage labels on chart segments
- [x] Shows "No task data available" when all values are 0

#### AC-4: Dashboard shows task breakdown by assignee as bar chart
- [x] API groups tasks by `assignee_id` and resolves profile names
- [x] Top 15 assignees returned, sorted by task count descending
- [x] `ReportAssigneeChart` renders horizontal bar chart via Recharts
- [x] X-axis labels rotate at -30 degrees when more than 5 assignees
- [x] Shows "No assignee data available" when no assignees exist

#### AC-5: Dashboard shows completion trend over time (last 30 days) as line chart
- [x] API computes `completionTrend` for last 8 weeks (not 30 days -- see BUG-1)
- [ ] BUG: Spec says "last 30 days" but implementation shows last 8 weeks (~56 days). The tech design changed this to 8 weeks, but the acceptance criterion was not updated.
- [x] `ReportTrendChart` renders a line chart with weekly data points
- [x] Green line with dots marking each data point

#### AC-6: Dashboard shows sprint burndown if active sprint exists
- [x] API finds active sprint (not completed, start_date <= today, end_date >= today)
- [x] Computes ideal burndown line (linear decrease) and actual remaining per day
- [x] `ReportBurndownChart` renders dual-line chart: dashed ideal vs solid actual
- [x] Sprint name displayed in a Badge next to the title
- [x] Section completely hidden in frontend when `burndown` is null

#### AC-7: User can filter reports by date range
- [ ] BUG: Date range filtering is NOT implemented. Neither the API nor the frontend has any date range / period filter. The tech design explicitly deferred this: "Date range adds significant complexity; project filter covers 80% of use cases." This acceptance criterion is unmet.

#### AC-8: User can filter reports by project
- [x] Project filter dropdown in the page header using shadcn Select
- [x] "All projects" default option; lists non-archived projects
- [x] API accepts `?projectId=` query param and filters all metrics accordingly
- [x] API verifies the project belongs to the workspace before returning data
- [x] Re-fetches report data automatically when project filter changes

#### AC-9: If time tracking is enabled, show total hours logged and avg time per task
- [x] API fetches from `time_logs` table, filters by relevant project tasks
- [x] Returns `null` gracefully if `time_logs` table does not exist (try/catch)
- [x] "Hours Logged" stat card shows formatted duration or "N/A" if no data
- [ ] BUG: Spec says "avg time per task" should also be shown, but neither the API computes it nor the frontend displays it. Only total hours logged is implemented.

#### AC-10: Workspace admin can export dashboard data as CSV
- [x] Export endpoint at `/api/workspaces/[id]/reports/export`
- [x] Checks admin/owner role before allowing export
- [x] Returns 403 for regular members
- [x] CSV format with `metric_name,value,date` columns matching spec
- [x] Includes summary metrics, velocity, assignee breakdown, weekly trend, hours logged
- [x] CSV properly escapes values with commas/quotes
- [x] Frontend "Export CSV" button only visible to admin/owner
- [x] Downloads file with workspace-name and date in filename

### Edge Cases Status

#### EC-1: Workspace has no completed tasks
- [x] Shows empty state with "No data to display yet" message and "Go to projects" CTA
- [x] Stat cards show 0 / 0% with progress bar at 0
- [x] Charts show "No data available" messages

#### EC-2: No sprints have been created
- [x] Velocity stat card shows "N/A" with "No completed sprints yet"
- [x] Burndown section completely hidden (conditional render)

#### EC-3: Date range has no data
- [ ] NOT TESTABLE: Date range filtering is not implemented (see AC-7)

#### EC-4: Chart has too many data points (aggregate by week instead of day)
- [x] Completion trend already aggregates by week (8 weekly buckets)
- [x] Burndown chart generates one data point per day within sprint range, capped at today
- [x] Assignee chart limited to top 15 entries via `.slice(0, 15)`

#### EC-5: User changes project filter - recalculate all metrics
- [x] `useCallback` with `selectedProjectId` dependency triggers re-fetch
- [x] `useEffect` watches `fetchReports` to re-run when filter changes
- [x] API recalculates all metrics from scratch for the selected project

#### EC-6: Two admins export simultaneously
- [x] Each export request builds CSV independently server-side
- [x] No shared state or file system usage; streamed directly in response
- [x] No collision possible

### Security Audit Results

- [x] Authentication: API routes verify session via `supabase.auth.getUser()`; middleware redirects unauthenticated users from `/reports` page
- [x] Authorization: Workspace membership checked before returning any data; export restricted to admin/owner roles
- [x] Input validation: `projectId` query param verified against workspace ownership before use
- [ ] BUG: No Zod schema validation on query parameters (`projectId`, `workspaceId`). Arbitrary strings are passed directly to Supabase queries. While Supabase uses parameterized queries (preventing SQL injection), malformed UUIDs could cause unnecessary database errors. Note: this is a project-wide pattern, not specific to PROJ-10.
- [ ] BUG: No rate limiting on reports API endpoints. The `/reports` endpoint performs multiple database queries (tasks, sprints, profiles, time_logs) and could be used for resource exhaustion. The rate-limit utility exists in the project but is not applied here.
- [x] No secrets exposed in API responses
- [x] No sensitive data leakage: API does not return user IDs or private data beyond names/emails already visible to workspace members
- [x] CSV export uses proper Content-Disposition header to prevent XSS via file download
- [x] Admin client (service role) used only for DB operations after authentication via cookie-based client

### Bugs Found

#### BUG-1: Date range filtering not implemented
- **Severity:** High
- **Steps to Reproduce:**
  1. Go to `/reports` page
  2. Look for a date range filter
  3. Expected: A date picker or range selector to filter report data by time period
  4. Actual: No date range filter exists; only a project filter is available
- **Note:** The tech design explicitly deferred this ("Date range adds significant complexity; project filter covers 80% of use cases"). AC-7 in the spec is unmet.
- **Priority:** Fix before deployment (or formally remove AC-7 from acceptance criteria)

#### BUG-2: Average time per task not shown
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to `/reports` page (with time tracking data)
  2. Look at the "Hours Logged" stat card
  3. Expected: Shows both "total hours logged" AND "avg time per task" as stated in AC-9
  4. Actual: Only total hours logged is displayed; average per task is not computed or shown
- **Priority:** Fix before deployment

#### BUG-3: Completion trend period mismatch with spec
- **Severity:** Low
- **Steps to Reproduce:**
  1. Go to `/reports` page
  2. View "Completion Trend" chart
  3. Expected: AC-5 says "last 30 days"
  4. Actual: Shows last 8 weeks (~56 days), aggregated by week
- **Note:** The tech design changed this to 8 weeks (reasonable for weekly aggregation). The acceptance criterion should be updated to match.
- **Priority:** Nice to have (update spec wording)

#### BUG-4: No rate limiting on reports endpoints
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Make rapid repeated requests to `/api/workspaces/[id]/reports`
  2. Each request triggers 4-6 database queries
  3. Expected: Rate limiting prevents abuse (project has `rate-limit.ts` utility available)
  4. Actual: No rate limiting applied; unlimited requests allowed
- **Priority:** Fix in next sprint

#### BUG-5: No Zod validation on API query parameters
- **Severity:** Low
- **Steps to Reproduce:**
  1. Call `/api/workspaces/[id]/reports?projectId=not-a-uuid`
  2. Expected: 400 Bad Request with validation error
  3. Actual: Passes invalid value to Supabase, which returns 0 results (graceful but not clean)
- **Note:** Project-wide pattern. Supabase parameterized queries prevent SQL injection.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 8/10 passed (AC-7 date range filter missing, AC-9 partially met - avg time per task missing)
- **Bugs Found:** 5 total (0 critical, 1 high, 2 medium, 2 low)
- **Security:** Minor issues found (no rate limiting, no input validation schemas); no critical vulnerabilities
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (date range filter) or formally descope it from acceptance criteria; fix BUG-2 (avg time per task). Then re-run QA.

## Deployment
_To be added by /deploy_
