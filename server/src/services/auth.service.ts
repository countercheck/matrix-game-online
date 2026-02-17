import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../utils/validators.js';
import { sendPasswordResetEmail } from './email.service.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function register(data: RegisterInput) {
  const existingUser = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash,
      displayName: data.displayName,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id, user.email);

  return {
    user,
    token,
  };
}

export async function login(data: LoginInput) {
  const user = await db.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
    token,
  };
}

export async function refreshToken(token: string) {
  if (!token) {
    throw new BadRequestError('Refresh token required');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: string; email: string };

    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const newToken = generateToken(user.id, user.email);

    return { token: newToken };
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
}

function generateToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  // Default to 7 days expiry
  const expirySeconds = parseExpiry(process.env.JWT_EXPIRY || '7d');

  return jwt.sign({ userId, email }, secret, { expiresIn: expirySeconds });
}

// Parse expiry string like '7d', '24h', '60m' to seconds
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    // Default to 7 days if invalid format
    return 7 * 24 * 60 * 60;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}

/**
 * Request a password reset. Generates a reset token and sends an email.
 * Always returns success to prevent email enumeration attacks.
 */
export async function requestPasswordReset(
  data: ForgotPasswordInput
): Promise<{ message: string }> {
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';

  // Find user by email (only select needed fields)
  const user = await db.user.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      email: true,
    },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  // Generate a secure random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  // Hash the token before storing (security best practice)
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Save hashed token and expiry to database
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken: resetTokenHash,
      resetTokenExpiry,
    },
  });

  // Send password reset email with the raw token (not the hash)
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return { message: 'If that email exists, a password reset link has been sent.' };
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
  // Hash the provided token to match against stored hash
  const resetTokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

  // Find user by unique reset token hash
  const user = await db.user.findUnique({
    where: {
      resetToken: resetTokenHash,
    },
  });

  const now = new Date();

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < now) {
    throw new BadRequestError('Invalid or expired reset token');
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);

  // Update password and clear reset token
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return { message: 'Password has been reset successfully' };
}
