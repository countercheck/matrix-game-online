import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Create a minimal test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock auth routes for testing
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, displayName } = req.body;

    // Validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email' },
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password too short' },
      });
    }

    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Display name required' },
      });
    }

    // Mock successful registration
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: 'user-123',
          email,
          displayName,
        },
        token: 'mock-jwt-token',
      },
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Mock user check
    if (email === 'notfound@example.com') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
    }

    if (password === 'wrongpassword') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: 'user-123',
          email,
          displayName: 'Test User',
        },
        token: 'mock-jwt-token',
      },
    });
  });

  return app;
}

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'ValidPass123',
        displayName: 'Test User',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'ValidPass123',
        displayName: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'short',
        displayName: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration without display name', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'ValidPass123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'ValidPass123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject login with unknown email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'notfound@example.com',
        password: 'SomePassword123',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login without email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        password: 'SomePassword123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject login without password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
