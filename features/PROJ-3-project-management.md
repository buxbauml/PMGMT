# PROJ-3: Project Creation and Management

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
