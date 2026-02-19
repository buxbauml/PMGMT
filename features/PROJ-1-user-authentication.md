# PROJ-1: User Authentication

## Status: Deployed
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

**Tested:** 2026-02-15
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** Compiles successfully (Next.js 16.1.1, Turbopack)

### Acceptance Criteria Status

#### AC-1: User can sign up with email and password (minimum 8 characters)
- [x] Signup page exists at `/signup` with email, password, and confirm password fields
- [x] Zod schema enforces minimum 8 characters for password (`signupSchema`)
- [x] Password confirmation field with mismatch validation
- [x] Form uses `react-hook-form` with `zodResolver` for client-side validation
- [x] Calls `supabase.auth.signUp()` on submit

#### AC-2: User receives email confirmation after signup
- [x] After successful signup, shows "Check your email" confirmation screen
- [x] Confirmation message tells user to click the link to verify account

#### AC-3: User can log in with correct credentials
- [x] Login page exists at `/login` with email and password fields
- [x] Uses `supabase.auth.signInWithPassword()` for authentication
- [x] Loading state shown during login (`Loader2` spinner + "Signing in...")

#### AC-4: User can request password reset via email
- [x] "Forgot password?" link on login page navigates to `/reset-password`
- [x] Reset password page accepts email and calls `supabase.auth.resetPasswordForEmail()`
- [x] Success screen shows "Check your email" with instructions

#### AC-5: User receives password reset link that expires after 1 hour
- [x] Success message states "The link will expire in 1 hour"
- [x] Reset link redirects to `/reset-password/update` (configured in `redirectTo`)
- [x] Update password page exists with new password + confirm password fields
- [x] Expired link detection: checks for "expired" or "invalid" in error message and shows "This reset link has expired" with "Request a new link" option

#### AC-6: User can log out and session is cleared
- [x] Home page (`/`) has "Sign out" button in header
- [x] `useAuth` hook provides `signOut` function that calls `supabase.auth.signOut()`
- [x] After sign out, redirects to `/login` via `window.location.href`

#### AC-7: Invalid login attempts show clear error messages
- [x] "Invalid login credentials" mapped to "Invalid email or password. Please try again."
- [x] Rate limit errors mapped to "Too many login attempts. Please try again later."
- [x] Network errors caught and display "A network error occurred. Please check your connection and try again."
- [x] Error displayed in `Alert` component with `destructive` variant

#### AC-8: Passwords are hashed and never stored in plain text
- [x] Supabase Auth handles password hashing with bcrypt (server-side)
- [x] No custom password storage in codebase

#### AC-9: User is redirected to workspace list after successful login
- [x] Login success redirects to `/` using `window.location.href = '/'` (per frontend best practice)
- [x] Home page serves as placeholder for future workspace list (PROJ-2)

#### AC-10: User is redirected to signup if not authenticated
- [ ] BUG: Middleware redirects unauthenticated users to `/login`, NOT `/signup` as stated in AC. The home page (`page.tsx`) also redirects to `/login`. The acceptance criterion says "redirected to signup" but implementation redirects to login.

### Edge Cases Status

#### EC-1: User tries to sign up with existing email
- [x] Error message checks for "already registered" and shows "An account with this email already exists."

#### EC-2: User enters wrong password 5+ times (rate limiting)
- [x] Login page checks for rate-limit-related error messages and shows cooldown message
- [x] Actual rate limiting enforcement depends on Supabase server configuration (cannot verify from code alone)

#### EC-3: Password reset link clicked after expiration
- [x] Update password page detects "expired" or "invalid" errors
- [x] Shows "This reset link has expired. Please request a new one." with link to `/reset-password`

#### EC-4: User closes browser during signup
- [x] Session handling via Supabase -- no local state persistence that would cause issues

#### EC-5: User has no internet during login
- [x] All forms have `try/catch` blocks that catch network errors
- [x] Shows "A network error occurred. Please check your connection and try again."
- [ ] BUG: No retry button is provided. The spec says "retry option" but the user must manually clear the form and resubmit.

#### EC-6: Email confirmation link never clicked
- [ ] BUG: No banner shown to prompt unverified users to verify their email. The spec says "show banner to verify email" but no such banner exists in the home page or anywhere in the codebase.

### Additional Edge Cases Identified

#### EC-7: Signup page -- password visibility toggle
- [ ] BUG: The tech design specifies "Password Input with visibility toggle" but no visibility toggle is implemented on any password field across signup, login, or password update pages.

#### EC-8: Authenticated user accessing auth pages
- [x] Middleware correctly redirects authenticated users from `/login`, `/signup`, and `/reset-password` to `/`

#### EC-9: Session refresh on page reload
- [x] Middleware refreshes session via `supabase.auth.getUser()` on every request
- [x] `useAuth` hook listens for auth state changes via `onAuthStateChange`

#### EC-10: Home page sign out button is not a shadcn/ui Button
- [ ] BUG: The sign out button on the home page is a plain `<button>` element styled with Tailwind classes, not a shadcn/ui `<Button>` component. This violates the "shadcn/ui first" convention.

### Cross-Browser / Responsive Assessment (Code Review)

#### Layout Responsiveness
- [x] All auth pages use `px-4` padding and `max-w-md` card width -- responsive by default
- [x] `min-h-screen` with `items-center justify-center` centers content on all viewports
- [x] Card width `max-w-md` (448px) fits within 375px mobile with horizontal padding

#### Cross-Browser Compatibility
- [x] No browser-specific CSS or APIs used
- [x] Standard form elements via shadcn/ui (Radix UI primitives)
- [x] `autoComplete` attributes set correctly for password managers

### Security Audit Results

#### Authentication
- [x] Supabase Auth handles all credential validation server-side
- [x] Middleware checks authentication on every protected route
- [x] Auth pages are properly gated (authenticated users redirected away)

#### Authorization
- [x] No user-to-user data access in this feature (single-user context)
- [x] Supabase RLS would apply to future data queries

#### Input Validation
- [x] Zod schemas validate email format and password length on client
- [x] Supabase Auth performs server-side validation independently
- [ ] BUG: Login password field only requires `min(1)` -- any single character passes client validation. While Supabase will reject invalid credentials server-side, the client-side schema should enforce `min(8)` consistently with signup to prevent unnecessary API calls.

#### XSS Prevention
- [x] React JSX auto-escapes all rendered content
- [x] No `dangerouslySetInnerHTML` usage
- [x] No raw HTML insertion anywhere in auth pages

#### Secrets Exposure
- [x] `.env.local` is gitignored (verified via `.env.local.example` existing separately)
- [x] Only `NEXT_PUBLIC_` prefixed variables used in client code (Supabase URL and anon key -- these are designed to be public)
- [x] No secrets or API keys hardcoded in source files

#### Rate Limiting
- [x] Login error handler detects rate limit messages from Supabase
- [x] Actual rate limiting enforced by Supabase server (5 attempts per 15 min per spec)
- [ ] BUG: No client-side rate limiting or request throttling. Rapid form submissions could hit the API repeatedly before Supabase rate limiting kicks in. Consider disabling the submit button after consecutive failures or implementing client-side throttling.

#### Password Reset Security
- [x] Reset password success message uses generic language: "If an account exists with that email" -- does not reveal whether email is registered
- [x] Reset link includes `redirectTo` pointing to the app's own domain

#### Session Security
- [x] Uses `@supabase/ssr` with cookie-based session management
- [x] Server client properly handles cookie get/set operations
- [x] Middleware refreshes session tokens automatically

#### Security Headers
- [ ] BUG: No custom security headers configured. The spec requires X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Strict-Transport-Security. No `next.config` headers or middleware headers are set. (Vercel provides some by default, but they should be explicitly configured.)

### Bugs Found

#### BUG-1: Redirect target mismatch -- unauthenticated users go to /login not /signup
- **Severity:** Low
- **Steps to Reproduce:**
  1. Visit `/` without being logged in
  2. Expected: Redirected to `/signup` (per AC-10)
  3. Actual: Redirected to `/login`
- **Note:** Redirecting to `/login` is arguably the better UX for returning users. The AC may need updating rather than the code.
- **Priority:** Fix in next sprint (clarify AC wording)

#### BUG-2: No retry button on network error
- **Severity:** Low
- **Steps to Reproduce:**
  1. Disconnect network
  2. Try to log in
  3. Expected: Error message with retry button/option
  4. Actual: Error message only, user must manually resubmit
- **Priority:** Nice to have

#### BUG-3: No email verification banner for unverified users
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Sign up with email and password
  2. Do NOT click email confirmation link
  3. Log in and visit home page
  4. Expected: Banner prompting user to verify email
  5. Actual: No banner, no indication that email is unverified
- **Priority:** Fix before deployment

#### BUG-4: Missing password visibility toggle
- **Severity:** Low
- **Steps to Reproduce:**
  1. Visit `/signup` page
  2. Look at password field
  3. Expected: Eye icon to toggle password visibility (per tech design)
  4. Actual: No visibility toggle on any password field
- **Priority:** Fix in next sprint

#### BUG-5: Sign out button not using shadcn/ui Button component
- **Severity:** Low
- **Steps to Reproduce:**
  1. Log in and view home page header
  2. Inspect the "Sign out" element
  3. Expected: shadcn/ui `<Button>` component
  4. Actual: Plain `<button>` with inline Tailwind classes
- **Priority:** Nice to have

#### BUG-6: Login schema allows 1-character passwords on client side
- **Severity:** Low
- **Steps to Reproduce:**
  1. Visit `/login`
  2. Enter email and a 1-character password
  3. Submit form
  4. Expected: Client-side validation error for password length
  5. Actual: Form submits to Supabase (which rejects it server-side)
- **Note:** Not a security risk since Supabase validates server-side, but creates unnecessary API calls.
- **Priority:** Nice to have

#### BUG-7: No client-side rate limiting / throttling on form submissions
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Visit `/login`
  2. Rapidly click "Sign in" button multiple times
  3. Expected: Client prevents excessive requests
  4. Actual: Each click triggers an API call to Supabase
- **Note:** The button is disabled during `isLoading`, but between rapid clicks before state updates, multiple requests could fire.
- **Priority:** Fix before deployment

#### BUG-8: No custom security headers configured
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Inspect response headers from the application
  2. Expected: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS headers
  3. Actual: Only default headers from Next.js/Vercel
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 9/10 passed (AC-10 redirect target is /login instead of /signup)
- **Bugs Found:** 8 total (0 critical, 0 high, 3 medium, 5 low)
- **Security:** 1 medium issue (missing security headers), 1 medium issue (no client-side throttling)
- **Production Ready:** NO
- **Recommendation:** Fix the 3 medium bugs (email verification banner, client-side throttling, security headers) before deployment. The 5 low-severity bugs can be addressed in the next sprint.

## Deployment

- **Production URL:** https://pmgmt-eight.vercel.app
- **Deployed:** 2026-02-19
- **Vercel Project:** pmgmt
- **Auto-deployed via:** GitHub push to `main` (commit `28fec55`)
- **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` configured in Vercel Dashboard
- **Security Headers:** X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy configured in `next.config.ts`
