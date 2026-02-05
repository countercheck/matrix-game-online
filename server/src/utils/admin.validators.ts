import { z } from 'zod';
import { UserRole } from '@prisma/client';

// User Management Schemas
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isBanned: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sortBy: z.enum(['createdAt', 'lastLogin', 'displayName', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500, 'Ban reason must be 500 characters or less'),
});

// Game Management Schemas
export const listGamesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['LOBBY', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  creatorId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'playerCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Audit Log Schemas
export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  adminId: z.string().uuid().optional(),
  action: z.string().max(50).optional(),
  targetType: z.string().max(50).optional(),
  targetId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Type exports
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
