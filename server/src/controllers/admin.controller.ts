import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service.js';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  banUserSchema,
  listGamesQuerySchema,
  listAuditLogsQuerySchema,
} from '../utils/admin.validators.js';

// Helper to get client IP
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  return req.socket.remoteAddress;
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// User Management
// ============================================================================

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listUsersQuerySchema.parse(req.query);
    const result = await adminService.listUsers(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await adminService.getUserDetails(userId!);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const data = updateUserRoleSchema.parse(req.body);
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const user = await adminService.updateUserRole(adminId, userId!, data, ipAddress);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function banUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const data = banUserSchema.parse(req.body);
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const user = await adminService.banUser(adminId, userId!, data, ipAddress);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function unbanUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const user = await adminService.unbanUser(adminId, userId!, ipAddress);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Game Management
// ============================================================================

export async function listGames(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listGamesQuerySchema.parse(req.query);
    const result = await adminService.listGames(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getGameDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const game = await adminService.getGameDetails(gameId!);
    res.json(game);
  } catch (error) {
    next(error);
  }
}

export async function deleteGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const result = await adminService.deleteGame(adminId, gameId!, ipAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function pauseGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const game = await adminService.pauseGame(adminId, gameId!, ipAddress);
    res.json(game);
  } catch (error) {
    next(error);
  }
}

export async function resumeGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId } = req.params;
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const game = await adminService.resumeGame(adminId, gameId!, ipAddress);
    res.json(game);
  } catch (error) {
    next(error);
  }
}

export async function removePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameId, playerId } = req.params;
    const adminId = req.user!.id;
    const ipAddress = getClientIp(req);

    const result = await adminService.removePlayerFromGame(adminId, gameId!, playerId!, ipAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Audit Logs
// ============================================================================

export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = listAuditLogsQuerySchema.parse(req.query);
    const result = await adminService.listAuditLogs(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
