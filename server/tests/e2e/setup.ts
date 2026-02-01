// SET ENVIRONMENT VARIABLES FIRST - before any imports!
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/mosaic_game_test';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests';
process.env.BCRYPT_ROUNDS = '4'; // Faster for tests
process.env.NODE_ENV = 'test';
process.env.ENABLE_TIMEOUT_WORKER = 'false'; // Disable timeout worker during tests

import { beforeAll, afterAll, beforeEach } from 'vitest';
// Use the same db instance as the app to ensure we're cleaning the right database
import { db as prisma } from '../../src/config/database.js';

// Clean up database before each test with retry logic for deadlocks
export async function cleanDatabase(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Delete in order respecting foreign key constraints
      await prisma.$transaction([
        prisma.drawnToken.deleteMany(),
        prisma.tokenDraw.deleteMany(),
        prisma.narration.deleteMany(),
        prisma.vote.deleteMany(),
        prisma.argument.deleteMany(),
        prisma.action.deleteMany(),
        prisma.roundSummary.deleteMany(),
        prisma.round.deleteMany(),
        prisma.gameEvent.deleteMany(),
        prisma.gamePlayer.deleteMany(),
        prisma.game.deleteMany(),
        prisma.user.deleteMany(),
      ]);
      return;
    } catch (error: any) {
      if (attempt === retries) {
        console.error('Error cleaning database after retries:', error);
        throw error;
      }
      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}

// Setup hooks for vitest
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase();
});

export { prisma as testDb };
