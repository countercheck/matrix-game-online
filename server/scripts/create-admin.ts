#!/usr/bin/env node
/**
 * CLI script to create or promote a user to admin role.
 *
 * Usage:
 *   pnpm tsx server/scripts/create-admin.ts <email> [displayName] [password]
 *
 * Examples:
 *   # Create a new admin user
 *   pnpm tsx server/scripts/create-admin.ts admin@example.com "Admin User" SecurePass123
 *
 *   # Promote an existing user to admin
 *   pnpm tsx server/scripts/create-admin.ts existing@example.com
 */

import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function main() {
  const [email, displayName, password] = process.argv.slice(2);

  if (!email) {
    console.error(
      'Usage: pnpm tsx server/scripts/create-admin.ts <email> [displayName] [password]'
    );
    console.error('');
    console.error('Examples:');
    console.error('  # Create a new admin user');
    console.error(
      '  pnpm tsx server/scripts/create-admin.ts admin@example.com "Admin User" SecurePass123'
    );
    console.error('');
    console.error('  # Promote an existing user to admin');
    console.error('  pnpm tsx server/scripts/create-admin.ts existing@example.com');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Promote existing user to admin
      if (existingUser.role === UserRole.ADMIN) {
        console.log(`User ${email} is already an admin.`);
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: UserRole.ADMIN },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      });

      console.log('Successfully promoted user to admin:');
      console.log(`  ID: ${updatedUser.id}`);
      console.log(`  Email: ${updatedUser.email}`);
      console.log(`  Display Name: ${updatedUser.displayName}`);
      console.log(`  Role: ${updatedUser.role}`);
    } else {
      // Create new admin user
      if (!displayName || !password) {
        console.error(
          'Error: displayName and password are required when creating a new admin user.'
        );
        console.error('');
        console.error(
          'Usage: pnpm tsx server/scripts/create-admin.ts <email> <displayName> <password>'
        );
        process.exit(1);
      }

      // Validate password
      if (password.length < 8) {
        console.error('Error: Password must be at least 8 characters.');
        process.exit(1);
      }
      if (!/[a-z]/.test(password)) {
        console.error('Error: Password must contain at least one lowercase letter.');
        process.exit(1);
      }
      if (!/[A-Z]/.test(password)) {
        console.error('Error: Password must contain at least one uppercase letter.');
        process.exit(1);
      }
      if (!/[0-9]/.test(password)) {
        console.error('Error: Password must contain at least one number.');
        process.exit(1);
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName,
          role: UserRole.ADMIN,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
        },
      });

      console.log('Successfully created admin user:');
      console.log(`  ID: ${newUser.id}`);
      console.log(`  Email: ${newUser.email}`);
      console.log(`  Display Name: ${newUser.displayName}`);
      console.log(`  Role: ${newUser.role}`);
      console.log(`  Created: ${newUser.createdAt.toISOString()}`);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
