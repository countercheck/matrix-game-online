import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import { updateProfileSchema, notificationPreferencesSchema } from '../utils/validators.js';

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const profile = await userService.getProfile(userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = updateProfileSchema.parse(req.body);
    const profile = await userService.updateProfile(userId, data);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

export async function getUserGames(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const games = await userService.getUserGames(userId);
    res.json({ success: true, data: games });
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = notificationPreferencesSchema.parse(req.body);
    const preferences = await userService.updateNotificationPreferences(userId, data);
    res.json({ success: true, data: preferences });
  } catch (error) {
    next(error);
  }
}
