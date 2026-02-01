import { beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // Faster hashing for tests

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
