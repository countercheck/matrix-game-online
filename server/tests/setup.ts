import { beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // Faster hashing for tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/mosaic_game_test?schema=public';
process.env.ENABLE_TIMEOUT_WORKER = 'false'; // Disable timeout worker in tests

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
