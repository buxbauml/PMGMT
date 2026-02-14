# PROJ-6: Sprint Planning

## Status: Planned
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
- What happens if task is assigned to archived sprint? → Task moves to backlog automatically
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
