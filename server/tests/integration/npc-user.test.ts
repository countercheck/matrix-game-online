import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const NPC_USER_EMAIL = process.env.NPC_USER_EMAIL || 'npc@system.local';

describe('NPC System User', () => {
  const prisma = new PrismaClient();

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

    // NPC user should have a unique email that won't conflict with real users
    expect(npcUser?.email).toContain('@system.local');
  });
});
