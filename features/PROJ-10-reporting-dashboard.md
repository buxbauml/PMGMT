# PROJ-10: Reporting Dashboard

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

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
- [ ] Dashboard shows completion trend over time (last 30 days) as line chart
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
