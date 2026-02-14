import { Request, Response, NextFunction } from 'express';
import * as roundService from '../services/round.service.js';
import { roundSummarySchema, updateRoundSummarySchema } from '../utils/validators.js';

export async function getRound(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roundId = req.params.roundId as string;
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
    const roundId = req.params.roundId as string;
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
    const roundId = req.params.roundId as string;
    const userId = req.user!.id;
    const summary = await roundService.getRoundSummary(roundId, userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

export async function updateRoundSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const roundId = req.params.roundId as string;
    const userId = req.user!.id;
    const data = updateRoundSummarySchema.parse(req.body);
    const summary = await roundService.updateRoundSummary(roundId, userId, data);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}
