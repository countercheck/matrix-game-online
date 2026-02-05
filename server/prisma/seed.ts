import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const NPC_USER_EMAIL = process.env.NPC_USER_EMAIL || 'npc@system.local';
const NPC_USER_DISPLAY_NAME = 'NPC System';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function main() {
  console.log('Starting database seed...');

  // Create or update NPC system user
  const npcPasswordHash = await bcrypt.hash('npc-system-user-no-login', BCRYPT_ROUNDS);

  const npcUser = await prisma.user.upsert({
    where: { email: NPC_USER_EMAIL },
    update: {
      displayName: NPC_USER_DISPLAY_NAME,
      passwordHash: npcPasswordHash,
    },
    create: {
      email: NPC_USER_EMAIL,
      displayName: NPC_USER_DISPLAY_NAME,
      passwordHash: npcPasswordHash,
    },
  });

  console.log(`✓ NPC system user created/updated: ${npcUser.email} (${npcUser.id})`);
  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
