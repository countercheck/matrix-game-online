# Admin Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/admin` page (admin-only) with a test email sender backed by a new `POST /api/admin/email/test` endpoint.

**Architecture:** New backend endpoint wired into the existing admin router + `requireAdmin` middleware. Frontend adds `AdminRoute` guard, `Admin.tsx` page, and a nav link visible only to admins. The `User` type in `useAuth.tsx` gains a `role` field so the frontend can check permissions.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, TanStack Query, Express, Zod, nodemailer (already wired up in `email.service.ts`)

---

### Task 1: Add `role` to the User type in `useAuth.tsx`

The login API already returns `role` in the user payload, but the frontend `User` interface doesn't include it. Fix this so the admin guard can read it.

**Files:**
- Modify: `client/src/hooks/useAuth.tsx:4-8`

**Step 1: Update the `User` interface**

```ts
interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add client/src/hooks/useAuth.tsx
git commit -m "feat: add role to User type in useAuth"
```

---

### Task 2: Add backend validator for test email

**Files:**
- Modify: `server/src/utils/admin.validators.ts`

**Step 1: Write the failing test**

In `server/tests/unit/admin-email-validator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sendTestEmailSchema } from '../../src/utils/admin.validators.js';

describe('sendTestEmailSchema', () => {
  it('accepts a valid email', () => {
    const result = sendTestEmailSchema.safeParse({ to: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = sendTestEmailSchema.safeParse({ to: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = sendTestEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && pnpm test tests/unit/admin-email-validator.test.ts
```
Expected: FAIL — `sendTestEmailSchema` not found

**Step 3: Add schema to `admin.validators.ts`**

Append to the end of `server/src/utils/admin.validators.ts`:

```ts
// Email Test Schema
export const sendTestEmailSchema = z.object({
  to: z.string().email('Must be a valid email address'),
});

export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;
```

**Step 4: Run test to verify it passes**

```bash
cd server && pnpm test tests/unit/admin-email-validator.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/utils/admin.validators.ts server/tests/unit/admin-email-validator.test.ts
git commit -m "feat: add sendTestEmailSchema validator"
```

---

### Task 3: Add backend controller + route for test email

**Files:**
- Modify: `server/src/controllers/admin.controller.ts`
- Modify: `server/src/routes/admin.routes.ts`

**Step 1: Write the failing integration test**

In `server/tests/integration/admin-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import * as emailService from '../../src/services/email.service.js';

// Mock email service so no real emails are sent
vi.mock('../../src/services/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// Helper: get an admin JWT — adjust to match your test setup pattern
// Look at existing integration tests for the pattern used in this project
describe('POST /api/admin/email/test', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'test@example.com' });
    expect(res.status).toBe(401);
  });
});
```

> **Note:** Check existing integration tests (e.g. `server/tests/integration/`) to see how they create authenticated requests and seed admin users. Follow the same pattern.

**Step 2: Run test to verify it fails**

```bash
cd server && pnpm test tests/integration/admin-email.test.ts
```
Expected: FAIL — route not found (404, not 401)

**Step 3: Add `sendTestEmail` to `admin.controller.ts`**

Append at the bottom of `server/src/controllers/admin.controller.ts`:

```ts
// ============================================================================
// Email Testing
// ============================================================================

export async function sendTestEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to } = sendTestEmailSchema.parse(req.body);
    const success = await sendEmail({
      to,
      subject: 'Test Email from Mosaic Matrix Game',
      text: 'This is a test email sent from the admin panel.',
      html: '<p>This is a test email sent from the admin panel.</p>',
    });

    if (success) {
      res.json({ success: true, message: `Test email sent to ${to}` });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email — check server logs' });
    }
  } catch (error) {
    next(error);
  }
}
```

Also add the imports at the top of the controller (alongside existing imports):

```ts
import { sendTestEmailSchema } from '../utils/admin.validators.js';
import { sendEmail } from '../services/email.service.js';
```

**Step 4: Add route to `admin.routes.ts`**

Add after the audit logs section:

```ts
// ============================================================================
// Email Testing - Admin only
// ============================================================================
router.post('/email/test', requireAdmin, adminController.sendTestEmail);
```

**Step 5: Run test to verify it passes**

```bash
cd server && pnpm test tests/integration/admin-email.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add server/src/controllers/admin.controller.ts server/src/routes/admin.routes.ts server/tests/integration/admin-email.test.ts
git commit -m "feat: add POST /api/admin/email/test endpoint"
```

---

### Task 4: Create `AdminRoute` component

**Files:**
- Create: `client/src/components/auth/AdminRoute.tsx`

**Step 1: Write the failing test**

In `client/src/components/auth/AdminRoute.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminRoute from './AdminRoute';

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';

describe('AdminRoute', () => {
  it('renders children for ADMIN users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', email: 'a@b.com', displayName: 'Admin', role: 'ADMIN' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminRoute><div>Admin content</div></AdminRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects non-admins to /dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '2', email: 'u@b.com', displayName: 'User', role: 'USER' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute><div>Admin content</div></AdminRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd client && pnpm test src/components/auth/AdminRoute.test.tsx
```
Expected: FAIL — `AdminRoute` not found

**Step 3: Create `AdminRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

**Step 4: Run test to verify it passes**

```bash
cd client && pnpm test src/components/auth/AdminRoute.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/auth/AdminRoute.tsx client/src/components/auth/AdminRoute.test.tsx
git commit -m "feat: add AdminRoute guard component"
```

---

### Task 5: Create `Admin.tsx` page

**Files:**
- Create: `client/src/pages/Admin.tsx`

**Step 1: Write the failing test**

In `client/src/pages/Admin.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Admin from './Admin';

// Mock the api service
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '../services/api';

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin />
    </QueryClientProvider>
  );
}

describe('Admin page', () => {
  it('renders the test email form', () => {
    renderAdmin();
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send test email/i })).toBeInTheDocument();
  });

  it('shows success message on successful send', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Test email sent to test@example.com' },
    });

    renderAdmin();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getByText(/test email sent/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failed send', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    renderAdmin();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd client && pnpm test src/pages/Admin.test.tsx
```
Expected: FAIL — `Admin` module not found

**Step 3: Create `Admin.tsx`**

```tsx
import { useState } from 'react';
import { api } from '../services/api';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setMessage('');

    try {
      const res = await api.post<{ success: boolean; message: string }>(
        '/admin/email/test',
        { to: email }
      );
      setStatus('success');
      setMessage(res.data.message);
    } catch {
      setStatus('error');
      setMessage('Failed to send test email. Check server logs.');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Email Testing</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Send a test email to verify the email service is configured correctly.
        </p>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="test-email" className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="recipient@example.com"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send Test Email'}
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-3 text-sm text-green-600">{message}</p>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm text-destructive">{message}</p>
        )}
      </section>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd client && pnpm test src/pages/Admin.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/pages/Admin.tsx client/src/pages/Admin.test.tsx
git commit -m "feat: add Admin page with test email sender"
```

---

### Task 6: Wire up route in `App.tsx` and nav link in `Layout.tsx`

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout/Layout.tsx`

**Step 1: Add admin route to `App.tsx`**

Add the import near the top alongside other page imports:

```ts
import Admin from './pages/Admin';
import AdminRoute from './components/auth/AdminRoute';
```

Add the route inside the `<Route path="/">` children, after the `help` route:

```tsx
<Route
  path="admin"
  element={
    <AdminRoute>
      <Admin />
    </AdminRoute>
  }
/>
```

**Step 2: Add Admin nav link to `Layout.tsx`**

In the desktop `<nav>` block, add after the Help link:

```tsx
{user?.role === 'ADMIN' && (
  <Link
    to="/admin"
    className="text-sm hover:underline px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
  >
    Admin
  </Link>
)}
```

Add the same in the mobile nav block, after the Help link:

```tsx
{user?.role === 'ADMIN' && (
  <Link
    to="/admin"
    className="block text-sm hover:underline py-2"
    onClick={() => setMobileMenuOpen(false)}
  >
    Admin
  </Link>
)}
```

**Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors

**Step 4: Run all client tests**

```bash
cd client && pnpm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/layout/Layout.tsx
git commit -m "feat: wire up /admin route and nav link for admins"
```

---

### Task 7: Run full test suite and verify

**Step 1: Run all tests**

```bash
cd /path/to/project && pnpm test
```
Expected: all pass, no regressions

**Step 2: Manual smoke test (optional but recommended)**

1. Start the dev server: `pnpm dev`
2. Log in as an admin user
3. Confirm "Admin" link appears in the nav
4. Navigate to `/admin`
5. Enter your email address and click "Send Test Email"
6. Check your inbox (or Mailgun logs) for the test email
7. Log in as a non-admin — confirm no Admin nav link, and `/admin` redirects to `/`

**Step 3: Commit docs update**

```bash
git add docs/API.md  # add the new endpoint: POST /api/admin/email/test
git commit -m "docs: document POST /api/admin/email/test endpoint"
```
