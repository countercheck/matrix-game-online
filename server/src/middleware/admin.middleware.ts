import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

/**
 * Role hierarchy for permission checks.
 * Higher index = more permissions.
 */
const ROLE_HIERARCHY: UserRole[] = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN];

/**
 * Get the hierarchical level of a role.
 */
function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Middleware factory to require a minimum role level.
 * User must have the specified role OR a higher role.
 *
 * @param minimumRole - The minimum role required to access the route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userRole = req.user.role;

      // Check if user has one of the allowed roles or a higher role
      const hasPermission = allowedRoles.some((allowedRole) => {
        const userLevel = getRoleLevel(userRole);
        const requiredLevel = getRoleLevel(allowedRole);
        return userLevel >= requiredLevel;
      });

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Convenience middleware: Requires MODERATOR or higher role.
 */
export const requireModerator = requireRole(UserRole.MODERATOR);

/**
 * Convenience middleware: Requires ADMIN role.
 */
export const requireAdmin = requireRole(UserRole.ADMIN);
