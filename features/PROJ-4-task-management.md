# PROJ-4: Task Management

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
