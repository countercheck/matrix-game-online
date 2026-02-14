import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app.js';
import { testDb, cleanDatabase } from './setup.js';

const app = createTestApp();

describe('Auth E2E Tests', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        displayName: 'New User',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: 'newuser@example.com',
        displayName: 'New User',
      });
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.token).toBeDefined();

      // Verify user was created in database
      const dbUser = await testDb.user.findUnique({
        where: { email: 'newuser@example.com' },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.displayName).toBe('New User');
    });

    it('should reject registration with existing email', async () => {
      // First registration
      await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        displayName: 'First User',
      });

      // Second registration with same email
      const response = await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: 'AnotherPass123!',
        displayName: 'Second User',
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'SecurePass123!',
        displayName: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
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
        password: 'SecurePass123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with empty display name', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        displayName: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Login', () => {
    const testUser = {
      email: 'testuser@example.com',
      password: 'TestPassword123!',
      displayName: 'Test User',
    };

    beforeEach(async () => {
      // Create a test user
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: testUser.email,
        displayName: testUser.displayName,
      });
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login without email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject login without password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should update lastLogin on successful login', async () => {
      await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const dbUser = await testDb.user.findUnique({
        where: { email: testUser.email },
      });

      expect(dbUser?.lastLogin).not.toBeNull();
    });
  });

  describe('Token Verification', () => {
    it('should access protected route with valid token', async () => {
      // Register and get token
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: 'protected@example.com',
        password: 'SecurePass123!',
        displayName: 'Protected User',
      });

      const token = registerResponse.body.data.token;

      // Access protected route (user profile)
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.email).toBe('protected@example.com');
    });

    it('should reject protected route without token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
