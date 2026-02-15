# PROJ-2: Workspace Management

## Status: In Progress
**Created:** 2026-02-14
**Last Updated:** 2026-02-15

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

### Overview
Workspace Management allows users to create and organize their teams. Each user can be a member of multiple workspaces and switch between them. The workspace owner can invite team members via email, assign roles, and manage membership.

---

### Component Structure

```
App Flow After Login
│
├── Home Page (/) - Protected Route
│   ├── IF user has NO workspaces
│   │   └── Empty State
│   │       ├── Illustration/Icon
│   │       ├── "Create your first workspace" message
│   │       └── "Create Workspace" Button (opens Dialog)
│   │
│   ├── IF user has workspaces
│   │   └── Workspace Dashboard
│   │       ├── Header with Workspace Switcher
│   │       │   ├── Current Workspace Name (Dropdown Trigger)
│   │       │   └── Workspace Dropdown Menu
│   │       │       ├── List of User's Workspaces (with Avatar/Icon)
│   │       │       ├── Separator
│   │       │       └── "Create New Workspace" Option
│   │       │
│   │       ├── Workspace Content Area
│   │       │   └── Projects List (Placeholder for PROJ-3)
│   │       │
│   │       └── Settings Button (opens Settings Sheet)
│   │
│   └── Workspace Settings (Side Sheet)
│       ├── General Tab
│       │   ├── Workspace Name (Editable, owner only)
│       │   └── Delete Workspace Button (owner only, with confirmation)
│       │
│       └── Members Tab
│           ├── Members List (Table)
│           │   ├── User Avatar + Name + Email
│           │   ├── Role Badge (Owner/Admin/Member)
│           │   └── Remove Button (owner/admin only, not self)
│           │
│           └── Invite Members Section (owner/admin only)
│               ├── Email Input (comma-separated for multiple)
│               ├── Role Selector (Admin/Member)
│               └── "Send Invitations" Button
│
├── Invitation Accept Page (/invite/[token])
│   ├── IF user is logged in
│   │   ├── Workspace Preview Card
│   │   │   ├── Workspace Name
│   │   │   ├── Invited by: [Owner Name]
│   │   │   └── Member Count
│   │   ├── "Join Workspace" Button
│   │   └── "Decline" Button
│   │
│   └── IF user is NOT logged in
│       └── "Sign in to accept invitation" Message
│           └── Link to /login (with redirect back to invite)
│
└── Create Workspace Dialog (Modal)
    ├── Workspace Name Input (3-50 chars, required)
    ├── Description (optional)
    └── "Create" Button
```

---

### Data Model

**Workspaces Table**
- Workspace ID (unique identifier, auto-generated)
- Workspace Name (3-50 characters, required)
- Description (optional, up to 500 characters)
- Owner User ID (references auth.users)
- Created timestamp
- Updated timestamp

**Workspace Members Table** (junction table for many-to-many relationship)
- Membership ID (unique identifier)
- Workspace ID (references workspaces table)
- User ID (references auth.users)
- Role (owner/admin/member)
- Joined timestamp
- Last accessed timestamp (updated when user switches to this workspace)

**Workspace Invitations Table**
- Invitation ID (unique identifier)
- Workspace ID (references workspaces table)
- Invited Email (email address)
- Invited By (user ID who sent the invite)
- Role (admin/member - what role they'll get when they accept)
- Token (secure random string for the invite link)
- Status (pending/accepted/expired)
- Created timestamp
- Expires timestamp (7 days from creation)

**User Profile Updates**
- Add field: Last Active Workspace ID (references workspaces table)
  - Used to remember which workspace to show on next login
  - Updated whenever user switches workspaces

---

### Tech Decisions

**Why Supabase Database?**
- **Multi-user collaboration** requires a centralized database (not browser localStorage)
- **Email invitations** need server-side token generation and validation
- **Role-based permissions** (owner/admin/member) require Row Level Security (RLS) policies

**Why workspace switcher in header?**
- Users need **quick access** to switch contexts without navigating away
- Follows common patterns (Slack, Notion, Linear) - familiar UX
- Keeps current workspace always visible

**Why remember last workspace?**
- **Reduces friction** - users typically work in one workspace at a time
- **Faster onboarding** - users land directly in their active context
- **Updated on every switch** - always reflects most recent activity

**Why 7-day invitation expiry?**
- **Security**: Limits window for token abuse if invite link is leaked
- **Best practice**: Most SaaS tools expire invites (GitHub: 7 days, Slack: 30 days)
- **Balance**: Long enough for users to respond, short enough to be secure

**Why email-based invitations (not in-app only)?**
- **Discoverability**: Invited users who haven't logged in recently will see the email
- **Friction reduction**: Direct link to accept - no need to navigate through the app
- **Standard pattern**: Expected behavior for team collaboration tools

---

### Dependencies

**No new packages needed**
- shadcn/ui components already installed (Dialog, Sheet, Table, Avatar, Badge, DropdownMenu, Alert)
- Supabase client already configured (@supabase/ssr, @supabase/supabase-js)
- Form handling with react-hook-form + zod (already in project)

---

### Backend Requirements Summary

**Database Schema:**
- 3 new tables: `workspaces`, `workspace_members`, `workspace_invitations`
- Update `profiles` table: add `last_active_workspace_id` field

**Row Level Security (RLS) Policies:**
- Users can read workspaces they are members of
- Only workspace owners can update/delete workspaces
- Only workspace owners/admins can invite members
- Only workspace owners/admins can view member lists
- Only workspace owners/admins can remove members (not themselves)

**Supabase Email Templates:**
- Workspace invitation email with accept link

**API Endpoints** (Supabase Functions or Database Functions):
- Accept invitation (validate token, add user to workspace_members, mark invitation as accepted)
- Generate invitation token (secure random string)
- Check invitation expiry (7 days from creation)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
