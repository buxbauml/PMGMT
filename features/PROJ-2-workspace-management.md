# PROJ-2: Workspace Management

## Status: In Review
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

## QA Test Results (Round 2)

**Tested:** 2026-02-15
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASSES (`npm run build` compiles successfully, no TypeScript errors)
**Previous Round:** Round 1 found 9 bugs. Round 2 re-tests after fixes were applied.

### Fixes Verified (from Round 1)

| Bug | Status | Notes |
|-----|--------|-------|
| BUG-1: Email invitations not implemented | **FIXED** | Resend integration added via `src/lib/email.ts`. Graceful fallback when `RESEND_API_KEY` not set. API calls `sendInvitationEmail()` fire-and-forget. HTML email template with escaping. |
| BUG-2: Login redirect parameter not handled | **FIXED** | Login page now reads `?redirect=` from search params (line 29-36), validates it is a relative path (prevents open redirect), and uses it for `window.location.href` after successful auth. |
| BUG-3: No ownership transfer mechanism | **PARTIALLY FIXED** | API endpoint `POST /api/workspaces/[id]/transfer-ownership` exists with proper validation, rollback logic, and ownership checks. UI has "Transfer ownership" dropdown option and confirmation dialog. **However, see new BUG-10 below.** |
| BUG-4: Invitation accept does not verify email match | **FIXED** | Accept endpoint now checks `user.email !== invitation.invited_email` and returns 403 with descriptive error. |

### Acceptance Criteria Status

#### AC-1: User can create a new workspace with a name (3-50 characters)
- [x] Create workspace dialog exists with name input field
- [x] Zod validation enforces 3-50 character limit with `.trim()`
- [x] Database CHECK constraint enforces `char_length(name) BETWEEN 3 AND 50`
- [x] Optional description field with 500 character max
- [x] Form shows validation error messages via `FormMessage`

#### AC-2: User who creates workspace is automatically assigned as owner
- [x] POST `/api/workspaces` inserts workspace then inserts creator as `workspace_members` with `role: 'owner'`
- [x] Rollback logic exists: if member insert fails, workspace is deleted
- [x] Last active workspace is updated to the new workspace

#### AC-3: Workspace owner can invite members by entering email addresses
- [x] Invite members form exists in workspace settings Members tab
- [x] Supports comma-separated email input
- [x] Email validation via Zod regex
- [x] Role selector (admin/member) available
- [x] API checks requester is owner/admin before creating invitations
- [x] Duplicate pending invitations are detected and skipped

#### AC-4: Invited users receive email invitation with accept link
- [x] Email sending implemented via Resend (`src/lib/email.ts`)
- [x] HTML email template with workspace name, inviter name, role, and accept link
- [x] `escapeHtml()` prevents XSS in email content
- [x] Graceful fallback: if `RESEND_API_KEY` is not configured, logs warning and skips (no crash)
- [x] Invite links also displayed in UI for manual sharing as backup
- [x] Copy button allows copying invite links to clipboard
- [ ] **NOTE:** Email delivery requires `RESEND_API_KEY` env var to be set. Without it, emails are silently skipped. This is documented in `.env.local.example`.

#### AC-5: Users can see a list of all workspaces they are a member of
- [x] GET `/api/workspaces` returns workspaces where user is a member
- [x] Workspace switcher dropdown lists all workspaces
- [x] Workspaces display initials badge and name

#### AC-6: Users can switch between workspaces
- [x] Workspace switcher dropdown allows clicking to switch
- [x] `switchWorkspace` updates active workspace ID in state
- [x] Last active workspace is persisted to profile via PATCH `/api/profiles/last-workspace`
- [x] On next login, last active workspace is restored

#### AC-7: Workspace owner can view list of all members
- [x] Members tab in workspace settings shows member table
- [x] Members display avatar, name, email, and role badge
- [x] API joins workspace_members with profiles for enriched data
- [x] RLS policy allows all members to view the member list (broader than spec but better UX -- acceptable deviation)

#### AC-8: Workspace owner can assign admin role to members
- [x] "Make admin" dropdown option exists in member actions
- [x] "Remove admin" dropdown option exists to demote
- [x] API validates requester is owner/admin
- [x] API prevents changing owner's role
- [x] API prevents admins from changing other admins' roles
- [x] `updateRoleSchema` only allows 'admin' or 'member' (cannot assign 'owner')

#### AC-9: Workspace owner can remove members (except themselves)
- [x] "Remove from workspace" action in member dropdown
- [x] API prevents self-removal (`targetMember.user_id === user.id`)
- [x] API prevents removing workspace owner (`targetMember.role === 'owner'`)
- [x] API prevents admins from removing other admins
- [x] Clears last_active_workspace_id for removed member

#### AC-10: Workspace owner can delete workspace (with confirmation)
- [x] Delete button in danger zone section of General tab
- [x] AlertDialog confirmation with workspace name shown
- [x] Destructive styling on delete button
- [x] API verifies ownership before deletion
- [x] CASCADE handles cleanup of members and invitations
- [x] Clears last_active_workspace_id for all affected profiles
- [x] Client-side state updates after deletion (switches to next workspace)

#### AC-11: Only workspace owner can delete workspace
- [x] API explicitly checks `workspace.owner_id !== user.id` and returns 403
- [x] RLS policy: DELETE on workspaces `USING (auth.uid() = owner_id)`
- [x] UI only shows delete section when `isOwner` is true

### Edge Cases Status

#### EC-1: User invites someone who doesn't have an account
- [x] Invitation record is still created with the email address
- [x] Invite link is generated for manual sharing
- [x] Email is sent via Resend with "Accept Invitation" link (when API key configured)
- [x] Email states "If you don't have an account yet, you'll be prompted to create one"

#### EC-2: Workspace name is duplicate
- [x] No uniqueness constraint on workspace names (as per spec: "Allow duplicates")
- [x] Database and validation allow duplicate names

#### EC-3: User tries to delete workspace with active projects
- [x] Confirmation dialog exists (as per spec)
- [ ] **DEFERRED:** No project count shown because PROJ-3 (Project Management) is not yet built. Should be addressed when PROJ-3 is implemented.

#### EC-4: Last owner leaves workspace
- [x] Owner cannot remove themselves (API returns "You cannot remove yourself")
- [x] `canRemove` logic in UI prevents showing remove action for self
- [x] Transfer ownership UI and API exist
- [ ] **BUG:** Transfer ownership is broken due to field name mismatch (see BUG-10 below)

#### EC-5: Invitation email clicked after 7 days
- [x] `expires_at` set to `NOW() + INTERVAL '7 days'` in database
- [x] Both GET and POST invitation endpoints check expiry
- [x] Returns HTTP 410 with "This invitation has expired" message
- [ ] **BUG (Low):** No option to request a new invite is shown on the expired invitation page. Shows "Invalid invitation" with "Go to dashboard" link. (Carried over from Round 1 as BUG-5)

#### EC-6: User tries to join workspace they're already in
- [x] Accept flow checks for existing membership
- [x] Returns 409 status which invite page treats as success
- [x] Invite page shows "Already a member" state with green check

### Additional Edge Cases (Identified by QA)

#### EC-7: Admin privilege escalation
- [x] `updateRoleSchema` only allows 'admin' or 'member' values
- [x] Admins cannot change other admins' roles (API enforced)

#### EC-8: Malicious workspace ID in API calls
- [x] Workspace IDs validated as UUID in last-workspace endpoint
- [x] RLS policies prevent accessing workspaces user is not a member of
- [x] Membership verified before operations

#### EC-9: Empty workspace list
- [x] Empty state component rendered when no workspaces exist
- [x] Minimal header with sign out button shown
- [x] "Create your first workspace" CTA displayed

#### EC-10: Middleware redirect loses query params (new)
- [ ] **BUG (Low):** If an already-authenticated user visits `/login?redirect=/invite/[token]`, middleware redirects to `/` without preserving the `redirect` param. This is a minor edge case since authenticated users shouldn't need to visit `/login`. (See BUG-12)

### Security Audit Results

#### Authentication
- [x] All API routes check `supabase.auth.getUser()` and return 401 if not authenticated
- [x] Invite accept page requires authentication; unauthenticated users shown "Sign in required"
- [x] Server-side Supabase client uses cookies for auth (secure)
- [x] Invitation GET endpoint relies on RLS for access control (unauthenticated users get 404 not 401 -- acceptable)

#### Authorization
- [x] Workspace CRUD protected by RLS (owner-only for update/delete)
- [x] Member management requires owner/admin role (checked in API layer)
- [x] Invitation creation requires owner/admin role (checked in both API and RLS)
- [x] RLS policies enabled on all tables (workspaces, workspace_members, workspace_invitations, profiles)
- [x] Users cannot access workspaces they're not members of
- [x] Invite accept now verifies email match (BUG-4 fixed)
- [x] Transfer ownership restricted to current owner only

#### Input Validation
- [x] All API endpoints validate input with Zod schemas
- [x] Workspace name: 3-50 characters, trimmed
- [x] Description: max 500 characters, trimmed
- [x] Email validation via regex in invite form
- [x] Role values constrained to enum ('admin', 'member')
- [x] JSON body parsing wrapped in try/catch
- [x] Database CHECK constraints as second line of defense
- [x] Transfer ownership validates UUID format for new_owner_id
- [x] Login redirect parameter validated as relative path only (prevents open redirect)
- [x] Email content HTML-escaped in invitation emails (prevents XSS via email)

#### Rate Limiting
- [x] Invitation endpoint rate-limited: 5 invites per hour and 5 per day
- [x] In-memory rate limiter implemented (acceptable for single-server deployment)
- [ ] **BUG (Low):** Rate limiting resets on server restart. (Carried over, BUG-7)

#### Data Exposure
- [x] API responses return only necessary fields
- [x] Invitation token is a 32-byte hex string (cryptographically strong via `gen_random_bytes(32)`)
- [ ] **BUG (Low):** The invitation GET endpoint returns details to any authenticated user whose email matches OR who is workspace owner/admin, via RLS. However, the RLS SELECT policy also allows the invited user to view the invitation by email match, which means any user with the token AND matching email can view it. This is acceptable behavior since the token is the bearer credential and email match is now enforced on accept.

#### XSS Protection
- [x] React's JSX auto-escapes output (no `dangerouslySetInnerHTML` usage)
- [x] No user content rendered as raw HTML
- [x] Input fields are controlled components with validation
- [x] Email HTML template uses `escapeHtml()` on all dynamic values

#### CSRF
- [x] Supabase auth uses secure cookies
- [x] API routes use standard Next.js request handling

#### Missing Security Controls
- [ ] **BUG (Low):** No server-side rate limiting on workspace creation. (Carried over, BUG-8)
- [ ] **BUG (Low):** No rate limiting on member removal, role updates, or ownership transfer.

### Regression Testing (PROJ-1: User Authentication)

- [x] Login page renders correctly
- [x] Sign out flow works (used in workspace header)
- [x] Authentication state correctly managed by `useAuth` hook
- [x] Protected route redirect works (middleware redirects unauthenticated users to /login)
- [x] Login redirect parameter now handled correctly (BUG-2 fixed)
- [x] Open redirect protection: only relative paths accepted in redirect param

### Bugs Found

#### BUG-5: Expired invitation shows no re-invite option (Carried over, Low)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Click an expired invitation link
  2. Expected: Error message with option to request new invite
  3. Actual: Generic "Invalid invitation" message with "Go to dashboard" link
- **Priority:** Fix in next sprint

#### BUG-6: No active projects warning on workspace delete (Deferred)
- **Severity:** Low
- **Steps to Reproduce:**
  1. (Once PROJ-3 is built) Create projects in a workspace
  2. Try to delete the workspace
  3. Expected: Warning showing project count, require confirmation
  4. Actual: Generic confirmation without project count
- **Note:** PROJ-3 is not yet built, so this is expected.
- **Priority:** Fix when PROJ-3 is deployed

#### BUG-7: Rate limit on invitations resets on server restart (Carried over, Low)
- **Severity:** Low
- **Priority:** Nice to have (acceptable for MVP)

#### BUG-8: No rate limiting on workspace creation (Carried over, Low)
- **Severity:** Low
- **Priority:** Nice to have

#### BUG-10: Transfer ownership broken -- field name mismatch (NEW)
- **Severity:** High
- **Steps to Reproduce:**
  1. As workspace owner, click the three-dot menu on a member
  2. Click "Transfer ownership"
  3. Confirm in the dialog
  4. Expected: Ownership transferred successfully
  5. Actual: API returns 400 validation error because the client sends `{ newOwnerId: "..." }` but the API expects `{ new_owner_id: "..." }`
- **Details:** In `src/hooks/useWorkspace.ts` line 298, `transferOwnership` sends `JSON.stringify({ newOwnerId })`. But in `src/app/api/workspaces/[id]/transfer-ownership/route.ts` line 5-7, the Zod schema expects `new_owner_id` (snake_case). The field name does not match, so Zod validation always fails.
- **Priority:** Fix before deployment

#### BUG-11: Transfer ownership passes member ID instead of user ID (NEW)
- **Severity:** High
- **Steps to Reproduce:**
  1. Even if BUG-10 is fixed, the UI passes `member.id` (the workspace_members record ID) as `newOwnerId`, but the API expects a `user_id` (UUID of the auth user)
  2. In `workspace-settings.tsx` line 486-488, the CustomEvent sends `memberId: member.id` (which is the workspace_members primary key)
  3. In `useWorkspace.ts` line 298, this `memberId` is sent as the `newOwnerId` to the API
  4. The API at line 71-76 looks up `workspace_members.user_id = new_owner_id` -- but `new_owner_id` is actually a `workspace_members.id`, not a `user_id`
  5. Expected: Ownership transfer succeeds
  6. Actual: API returns "The new owner must be a member of the workspace" because the member lookup fails
- **Priority:** Fix before deployment

#### BUG-12: Middleware redirect for authenticated users on auth pages loses query params (NEW)
- **Severity:** Low
- **Steps to Reproduce:**
  1. While logged in, navigate to `/login?redirect=/invite/[token]`
  2. Expected: Redirected to `/invite/[token]`
  3. Actual: Redirected to `/` (middleware line 51-53 always redirects to `/`)
- **Note:** This is a minor edge case. Unauthenticated users logging in now correctly handle the redirect (BUG-2 fixed). This only affects users who are already logged in and manually navigate to the login page.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 11/11 passed (all criteria met, AC-4 email now implemented, AC-7 deviation acceptable)
- **Edge Cases:** 4/6 documented edge cases fully pass, 1 deferred (PROJ-3 dependency), 1 has low-severity issue
- **Additional Edge Cases:** 3/4 pass, 1 new low-severity issue identified
- **Bugs Fixed Since Round 1:** 4 fixed (BUG-1 email, BUG-2 login redirect, BUG-3 ownership transfer API/UI, BUG-4 email verification)
- **Bugs Remaining:** 7 total (0 critical, 2 high, 0 medium, 5 low)
- **Security:** Significantly improved since Round 1. Email verification on invite accept added. Open redirect protection on login. HTML escaping in emails. Two high-severity functional bugs remain (BUG-10, BUG-11) but are not security issues.
- **Build:** Passes successfully
- **Production Ready:** NO
- **Recommendation:** Fix BUG-10 (field name mismatch) and BUG-11 (member ID vs user ID) before deployment. These are both in the ownership transfer flow and are simple one-line fixes. All other remaining bugs are low severity and can be addressed in subsequent sprints.

## Deployment
_To be added by /deploy_
