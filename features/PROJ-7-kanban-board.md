# PROJ-7: Kanban Board View

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

## Dependencies
- Requires: PROJ-4 (Task Management) - visualizes tasks in columns by status

## User Stories
- As a workspace member, I want to view tasks in a kanban board so that I can see workflow at a glance
- As a workspace member, I want to drag tasks between columns so that I can update status quickly
- As a workspace member, I want to filter the board by assignee and sprint so that I can focus on relevant tasks
- As a workspace member, I want to click a task card to view details so that I can see full context
- As a workspace member, I want to see task counts per column so that I know workload distribution

## Acceptance Criteria
- [ ] Board displays three columns: To Do, In Progress, Done
- [ ] Each task appears as a card in the column matching its status
- [ ] Task cards show title, assignee avatar, and priority indicator
- [ ] User can drag task cards between columns
- [ ] Dropping a task in a new column updates its status
- [ ] Column headers show count of tasks in that column
- [ ] User can filter board by assignee (show only their tasks)
- [ ] User can filter board by sprint (show only sprint tasks)
- [ ] Clicking a task card opens task detail modal
- [ ] Board updates in real-time when other users make changes
- [ ] Board is responsive (stacks columns vertically on mobile)

## Edge Cases
- What happens if column has 50+ tasks? → Implement virtual scrolling for performance
- What happens if user drags task but network fails? → Revert to original position, show error toast
- What happens if two users drag the same task simultaneously? → Last update wins, other user sees position change
- What happens if board is filtered and user creates new task? → New task appears if it matches filters
- What happens on mobile where drag-and-drop is difficult? → Show dropdown to change status instead
- What happens if task is deleted while user is viewing it? → Close modal, show toast "Task was deleted"

## Technical Requirements
- **UI Library:** Use @dnd-kit/core for drag-and-drop functionality
- **Real-time:** Use Supabase Realtime subscriptions for live updates
- **Performance:** Board render < 500ms for up to 100 tasks
- **Responsive:** Board works on mobile (375px+), tablet (768px+), desktop (1440px+)
- **Accessibility:** Keyboard navigation support for drag-and-drop

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
