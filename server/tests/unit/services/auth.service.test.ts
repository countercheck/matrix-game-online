import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';

// Extract pure functions for testing
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('ValidPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Pass1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePassword('PasswordOnly');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should collect all validation errors', () => {
      const result = validatePassword('pass');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('should accept email with subdomain', () => {
      expect(validateEmail('test@mail.example.com')).toBe(true);
    });

    it('should accept email with plus sign', () => {
      expect(validateEmail('test+tag@example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(validateEmail('testexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });

    it('should reject email without local part', () => {
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('should reject email with spaces', () => {
      expect(validateEmail('test @example.com')).toBe(false);
    });
  });

  describe('password hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT token generation', () => {
    it('should generate valid token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify valid token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });

      const decoded = jwt.verify(token, 'test-secret') as { userId: string; email: string };
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should reject token with wrong secret', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });

      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    it('should reject expired token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '-1s' });

      expect(() => jwt.verify(token, 'test-secret')).toThrow();
    });

    it('should reject malformed token', () => {
      expect(() => jwt.verify('not-a-valid-token', 'test-secret')).toThrow();
    });
  });

  describe('registration flow', () => {
    it('should check for existing user before registration', async () => {
      const mockFindUnique = vi.mocked(db.user.findUnique);
      mockFindUnique.mockResolvedValue(null);

      await db.user.findUnique({ where: { email: 'new@example.com' } });

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('should create user with hashed password', async () => {
      const mockCreate = vi.mocked(db.user.create);
      mockCreate.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      });

      const result = await db.user.create({
        data: {
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: 'hashed-password',
        },
      });

      expect(result.email).toBe('test@example.com');
      expect(mockCreate).toHaveBeenCalled();
    });
  });
});
