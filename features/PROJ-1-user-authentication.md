# PROJ-1: User Authentication

## Status: In Progress
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

## Dependencies
- None (Foundation feature)

## User Stories
- As a new user, I want to sign up with my email and password so that I can create a personal account
- As a returning user, I want to log in with my credentials so that I can access my workspaces
- As a user who forgot my password, I want to reset it via email so that I can regain access to my account
- As a logged-in user, I want to log out so that I can secure my account on shared devices
- As a user, I want to see clear error messages if my login fails so that I know what went wrong

## Acceptance Criteria
- [ ] User can sign up with email and password (minimum 8 characters)
- [ ] User receives email confirmation after signup
- [ ] User can log in with correct credentials
- [ ] User can request password reset via email
- [ ] User receives password reset link that expires after 1 hour
- [ ] User can log out and session is cleared
- [ ] Invalid login attempts show clear error messages
- [ ] Passwords are hashed and never stored in plain text
- [ ] User is redirected to workspace list after successful login
- [ ] User is redirected to signup if not authenticated

## Edge Cases
- What happens if user tries to sign up with an existing email? → Show error "Email already registered"
- What happens if user enters wrong password 5+ times? → Rate limit login attempts, show cooldown message
- What happens if password reset link is clicked after expiration? → Show error and offer to resend
- What happens if user closes browser during signup? → Session expires, must complete signup again
- What happens if user has no internet during login? → Show network error, retry option
- What happens if email confirmation link is never clicked? → User can still log in, show banner to verify email

## Technical Requirements
- **Authentication:** Use Supabase Auth for email/password authentication
- **Security:** Implement rate limiting on login endpoint (5 attempts per 15 minutes)
- **Performance:** Login response < 500ms
- **Browser Support:** Chrome, Firefox, Safari (latest 2 versions)
- **Email Service:** Use Supabase email templates for confirmation and password reset

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
User authentication is handled entirely by **Supabase Auth**, which provides secure email/password authentication out of the box. Users will authenticate through dedicated pages (signup, login, password reset), and once authenticated, they can access the rest of the application.

### Component Structure

```
Authentication Flow
│
├── /signup (Public Page)
│   ├── Signup Form
│   │   ├── Email Input (shadcn/ui Input)
│   │   ├── Password Input (shadcn/ui Input, with visibility toggle)
│   │   ├── Confirm Password Input
│   │   ├── Submit Button (shadcn/ui Button)
│   │   └── Error Alert (shadcn/ui Alert)
│   └── Link to Login Page
│
├── /login (Public Page)
│   ├── Login Form
│   │   ├── Email Input (shadcn/ui Input)
│   │   ├── Password Input (shadcn/ui Input)
│   │   ├── Submit Button (shadcn/ui Button)
│   │   ├── "Forgot Password?" Link
│   │   └── Error Alert (shadcn/ui Alert)
│   └── Link to Signup Page
│
├── /reset-password (Public Page)
│   ├── Password Reset Form
│   │   ├── Email Input (shadcn/ui Input)
│   │   ├── Submit Button (shadcn/ui Button)
│   │   └── Success/Error Alert (shadcn/ui Alert)
│   └── Link back to Login
│
└── Protected Pages (requires authentication)
    ├── Auth Check (runs on every protected route)
    │   ├── If logged in → Show page content
    │   └── If not logged in → Redirect to /login
    └── Logout Button (in navigation)
```

### Data Model

**User Account Information (managed by Supabase):**
- Email address (unique identifier)
- Hashed password (never stored in plain text)
- Email confirmation status (verified or unverified)
- Account creation timestamp
- Last login timestamp

**Session Information:**
- User ID (unique identifier)
- Access token (JWT, stored in browser)
- Refresh token (for extending session)
- Session expiry time

**Storage Location:**
- User accounts: Stored in Supabase Auth system (PostgreSQL backend)
- Session tokens: Stored in browser cookies (secure, httpOnly)
- No local storage needed for authentication

### User Journey

**1. New User Signup:**
- User visits `/signup`
- Enters email and password (min 8 characters)
- Clicks "Sign Up" button
- Supabase creates account and sends confirmation email
- User is redirected to `/login` with success message
- User clicks email confirmation link (optional but recommended)

**2. Returning User Login:**
- User visits `/login`
- Enters email and password
- Clicks "Log In" button
- Supabase validates credentials and creates session
- User is redirected to workspace list (home page)

**3. Password Reset:**
- User visits `/login` and clicks "Forgot Password?"
- Redirected to `/reset-password`
- Enters email address
- Supabase sends password reset link (expires in 1 hour)
- User clicks link in email
- Redirected to password update page
- Enters new password
- Redirected to `/login` with success message

**4. Logout:**
- User clicks "Logout" button in navigation
- Supabase clears session
- User is redirected to `/login`

### Tech Decisions (Why These Choices?)

**Why Supabase Auth instead of custom authentication?**
- **Security:** Supabase handles password hashing, session management, and security best practices automatically
- **Time Savings:** No need to build login endpoints, password reset logic, or email sending infrastructure
- **Built-in Features:** Email confirmation, password reset, rate limiting, and session refresh work out of the box
- **Compliance:** Supabase follows industry standards for auth (OWASP, JWT best practices)

**Why email/password instead of social login (Google, GitHub)?**
- **Simplicity:** MVP focuses on core functionality first
- **Control:** Email/password gives full control over user data
- **Later Addition:** Social login can be added post-MVP if needed

**Why separate pages (/login, /signup) instead of a modal?**
- **Focus:** Dedicated pages reduce distractions during critical auth flows
- **Mobile-Friendly:** Full-page forms work better on mobile devices
- **SEO:** Separate pages can be indexed and bookmarked

**Why redirect to workspace list after login?**
- **User Expectation:** After logging in, users expect to see their main content (workspaces)
- **PROJ-2 Dependency:** Workspace Management feature will create this landing page

### Security Features

**Built-in Protections:**
- Passwords hashed with bcrypt (handled by Supabase)
- Rate limiting on login attempts (5 attempts per 15 minutes)
- Email confirmation prevents fake accounts
- Password reset links expire after 1 hour
- Secure session tokens (JWT) stored in httpOnly cookies
- HTTPS enforced in production (via Vercel)

**Error Handling:**
- Generic errors for security (don't reveal if email exists)
- Clear validation messages for user input
- Network error detection with retry options
- Expired link detection with resend options

### Dependencies (Packages to Install)

**Already Available:**
- `@supabase/supabase-js` - Supabase client library
- `react-hook-form` - Form handling and validation
- `zod` - Schema validation for forms
- `shadcn/ui` components - Button, Input, Label, Form, Alert

**May Need to Add:**
- None - all dependencies are already in the starter kit

### Integration Points

**Frontend:**
- Login page calls Supabase Auth signin
- Signup page calls Supabase Auth signup
- Protected routes check session status
- Navigation shows logout button when authenticated

**Backend:**
- No custom backend needed for basic auth
- Supabase Auth handles all server-side logic
- Future features (PROJ-2+) will read user ID from session

**Email Service:**
- Supabase sends confirmation emails automatically
- Supabase sends password reset emails automatically
- Email templates can be customized in Supabase dashboard

### What Gets Built

**Pages to Create:**
1. `/app/signup/page.tsx` - Signup page with form
2. `/app/login/page.tsx` - Login page with form
3. `/app/reset-password/page.tsx` - Password reset request page

**Utility Files to Create:**
1. `src/lib/auth.ts` - Helper functions for auth checks
2. `src/hooks/useAuth.ts` - React hook for accessing current user

**No Database Changes Needed:**
- Supabase Auth uses its own tables (automatically managed)

### Post-Authentication Flow

After PROJ-1 is complete:
- Users can sign up and log in
- Sessions are maintained across page refreshes
- Users are redirected to `/` (home) after login
- **PROJ-2** will create the workspace list page to replace the home placeholder

---

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
