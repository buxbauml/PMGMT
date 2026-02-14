# PROJ-2: Workspace Management

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

## Dependencies
- Requires: PROJ-1 (User Authentication) - for authenticated user checks

## User Stories
- As a logged-in user, I want to create a workspace so that I can organize my team's projects
- As a workspace owner, I want to invite team members by email so that they can collaborate with me
- As an invited user, I want to accept workspace invitations so that I can join the team
- As a workspace member, I want to see all workspaces I'm part of so that I can switch between teams
- As a workspace owner, I want to remove members so that I can manage who has access
- As a workspace owner, I want to delete my workspace so that I can remove it when no longer needed

## Acceptance Criteria
- [ ] User can create a new workspace with a name (3-50 characters)
- [ ] User who creates workspace is automatically assigned as owner
- [ ] Workspace owner can invite members by entering email addresses
- [ ] Invited users receive email invitation with accept link
- [ ] Users can see a list of all workspaces they are a member of
- [ ] Users can switch between workspaces
- [ ] Workspace owner can view list of all members
- [ ] Workspace owner can assign admin role to members
- [ ] Workspace owner can remove members (except themselves)
- [ ] Workspace owner can delete workspace (with confirmation)
- [ ] Only workspace owner can delete workspace

## Edge Cases
- What happens if user invites someone who doesn't have an account? → Send invite email, prompt them to sign up first
- What happens if workspace name is duplicate? → Allow duplicates (different teams can have same name)
- What happens if user tries to delete workspace with active projects? → Show warning with count, require confirmation
- What happens if last owner leaves workspace? → Prevent action, must assign another owner first
- What happens if invitation email is clicked after 7 days? → Invitation expires, show error and option to request new invite
- What happens if user tries to join workspace they're already in? → Show message "Already a member"

## Technical Requirements
- **Database:** Workspaces table with RLS policies
- **Permissions:** Only workspace owners can invite/remove members
- **Performance:** Workspace list load < 200ms
- **Email Service:** Use Supabase email templates for invitations
- **Validation:** Workspace name required, 3-50 characters

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
