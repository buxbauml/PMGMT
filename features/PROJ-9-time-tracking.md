# PROJ-9: Time Tracking

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
