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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
