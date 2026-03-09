# Admin Page Design

**Date:** 2026-03-08
**Status:** Approved

## Overview

Add a minimal admin page at `/admin` with a test email sender. Admin-only access. Expandable with additional sections later.

## Backend

**New endpoint:** `POST /api/admin/email/test`

- Middleware: `authenticateToken`, `requireAdmin`
- Body: `{ to: string }` — validated as a valid email address
- Calls existing `sendEmail` from `email.service.ts` with a simple test message
- Response: `{ success: boolean, message: string }`

## Frontend

**New files:**
- `client/src/pages/Admin.tsx` — admin page with email input + send button + feedback
- `client/src/components/auth/AdminRoute.tsx` — route guard, redirects non-admins to `/` (the dashboard)

**Changes to existing files:**
- `client/src/App.tsx` — add `/admin` route wrapped in `AdminRoute`
- `client/src/components/layout/Layout.tsx` — add Admin nav link visible to admin users only

## Auth Flow

- Frontend checks `user.role === 'ADMIN'` from auth context
- Backend validates with existing `requireAdmin` middleware
- Non-admins hitting `/admin` are redirected to `/` (the dashboard)

## Scope

Out of scope for this iteration: user management UI, game management UI, audit log UI (backend routes exist, UI deferred).
