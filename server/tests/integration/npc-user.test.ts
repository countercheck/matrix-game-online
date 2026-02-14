import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { db as prisma } from '../../src/config/database.js';
import bcrypt from 'bcryptjs';

const NPC_USER_EMAIL = process.env.NPC_USER_EMAIL || 'npc@system.local';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);

describe('NPC System User', () => {
  beforeEach(async () => {
    // Seed the NPC user before each test
    const npcPasswordHash = await bcrypt.hash('npc-system-user-no-login', BCRYPT_ROUNDS);
    await prisma.user.upsert({
      where: { email: NPC_USER_EMAIL },
      update: {
        displayName: 'NPC System',
        passwordHash: npcPasswordHash,
      },
      create: {
        email: NPC_USER_EMAIL,
        displayName: 'NPC System',
        passwordHash: npcPasswordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should exist in the database after seeding', async () => {
    const npcUser = await prisma.user.findUnique({
      where: { email: NPC_USER_EMAIL },
    });

    expect(npcUser).toBeDefined();
    expect(npcUser?.email).toBe(NPC_USER_EMAIL);
    expect(npcUser?.displayName).toBe('NPC System');
  });

  it('should have a valid password hash', async () => {
    const npcUser = await prisma.user.findUnique({
      where: { email: NPC_USER_EMAIL },
    });

    expect(npcUser?.passwordHash).toBeDefined();
    expect(npcUser?.passwordHash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
  });

  it('should be used for NPC GamePlayer records', async () => {
    // This test verifies the concept - in practice, games will create NPC players
    const npcUser = await prisma.user.findUnique({
      where: { email: NPC_USER_EMAIL },
    });

    expect(npcUser).toBeDefined();
    expect(npcUser?.id).toBeDefined();

    // The NPC user should be available for creating GamePlayer records
    // We don't create a test game here, just verify the user exists
  });

  it('should not conflict with regular users', async () => {
    const npcUser = await prisma.user.findUnique({
      where: { email: NPC_USER_EMAIL },
    });

    expect(npcUser).toBeDefined();
    // NPC user should have a unique email that won't conflict with real users
    expect(npcUser?.email).toContain('@system.local');
  });
});
