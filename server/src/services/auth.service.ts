import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';
import type { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../utils/validators.js';
import { sendEmail } from './email.service.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

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

  return jwt.sign(
    { userId, email },
    secret,
    { expiresIn: expirySeconds }
  );
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
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
}

/**
 * Request a password reset. Generates a reset token and sends an email.
 * Always returns success to prevent email enumeration attacks.
 */
export async function requestPasswordReset(data: ForgotPasswordInput): Promise<{ message: string }> {
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  
  // Find user by email
  const user = await db.user.findUnique({
    where: { email: data.email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  // Generate a secure random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Save token and expiry to database
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  // Send password reset email
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const subject = 'Password Reset Request';
  const text = `You requested a password reset. Click the link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Mosaic Matrix Game</h1>
  </div>
  <div class="content">
    <h2>Password Reset Request</h2>
    <p>You requested a password reset for your account.</p>
    <p>Click the button below to reset your password:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p style="font-size: 12px; color: #6b7280;">Or copy this link: ${resetUrl}</p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
  </div>
  <div class="footer">
    <p>This is an automated message from Mosaic Matrix Game.</p>
  </div>
</body>
</html>
`;

  await sendEmail({ to: user.email, subject, text, html });

  return { message: 'If that email exists, a password reset link has been sent.' };
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
  // Find user with valid reset token
  const user = await db.user.findFirst({
    where: {
      resetToken: data.token,
      resetTokenExpiry: {
        gte: new Date(), // Token hasn't expired
      },
    },
  });

  if (!user) {
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
