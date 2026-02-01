import { Request, Response, NextFunction } from 'express';
import * as roundService from '../services/round.service.js';
import { roundSummarySchema } from '../utils/validators.js';

export async function getRound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roundId } = req.params;
    const userId = req.user!.id;
    const round = await roundService.getRound(roundId, userId);
    res.json({ success: true, data: round });
  } catch (error) {
    next(error);
  }
}

export async function submitRoundSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roundId } = req.params;
    const userId = req.user!.id;
    const data = roundSummarySchema.parse(req.body);
    const result = await roundService.submitRoundSummary(roundId, userId, data);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getRoundSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roundId } = req.params;
    const userId = req.user!.id;
    const summary = await roundService.getRoundSummary(roundId, userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}
