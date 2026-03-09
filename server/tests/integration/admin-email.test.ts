import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock the email service so no real emails are sent
vi.mock('../../src/services/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  initializeEmailService: vi.fn(),
}));

import * as adminController from '../../src/controllers/admin.controller.js';

// Mock user types matching the shape auth middleware attaches to req.user
type MockUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  isBanned: boolean;
};

function createTestApp(authenticatedUser: MockUser | null = null) {
  const app = express();
  app.use(express.json());

  // Mock authenticateToken: sets req.user from the fixture or rejects
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!authenticatedUser) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
      return;
    }
    (req as any).user = authenticatedUser;
    next();
  });

  // Mock requireAdmin: allow only ADMIN role
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }
    next();
  };

  app.post('/api/admin/email/test', requireAdmin, adminController.sendTestEmail);

  // Error handler matching the real one
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.statusCode) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    if (err?.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: err.errors },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}

const adminUser: MockUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'ADMIN',
  isBanned: false,
};

const regularUser: MockUser = {
  id: 'regular-user-id',
  email: 'user@example.com',
  displayName: 'Regular User',
  role: 'USER',
  isBanned: false,
};

describe('POST /api/admin/email/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without authentication', async () => {
    const app = createTestApp(null);

    const response = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'test@example.com' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 403 for a non-admin user', async () => {
    const app = createTestApp(regularUser);

    const response = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'test@example.com' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('should return 200 with success:true for an admin user with a valid email', async () => {
    const app = createTestApp(adminUser);

    const response = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'recipient@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toContain('recipient@example.com');
  });

  it('should return 500 with standard error shape when email sending fails', async () => {
    const { sendEmail } = await import('../../src/services/email.service.js');
    vi.mocked(sendEmail).mockResolvedValueOnce(false);

    const app = createTestApp(adminUser);

    const response = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'recipient@example.com' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EMAIL_SEND_FAILED');
  });

  it('should return 400 when the to field is not a valid email', async () => {
    const app = createTestApp(adminUser);

    const response = await request(app)
      .post('/api/admin/email/test')
      .send({ to: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when the to field is missing', async () => {
    const app = createTestApp(adminUser);

    const response = await request(app).post('/api/admin/email/test').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
