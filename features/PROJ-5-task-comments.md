# PROJ-5: Task Comments and Activity

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
