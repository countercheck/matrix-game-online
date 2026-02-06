import { Request, Response, NextFunction } from 'express';
import * as actionService from '../services/action.service.js';
import { argumentSchema, voteSchema, narrationSchema } from '../utils/validators.js';

export async function getAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const action = await actionService.getAction(actionId, userId);
    res.json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
}

export async function addArgument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const data = argumentSchema.parse(req.body);
    const argument = await actionService.addArgument(actionId, userId, data);
    res.status(201).json({ success: true, data: argument });
  } catch (error) {
    next(error);
  }
}

export async function getArguments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const args = await actionService.getArguments(actionId, userId);
    res.json({ success: true, data: args });
  } catch (error) {
    next(error);
  }
}

export async function completeArgumentation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const result = await actionService.completeArgumentation(actionId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function submitVote(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const data = voteSchema.parse(req.body);
    const vote = await actionService.submitVote(actionId, userId, data);
    res.status(201).json({ success: true, data: vote });
  } catch (error) {
    next(error);
  }
}

export async function getVotes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const votes = await actionService.getVotes(actionId, userId);
    res.json({ success: true, data: votes });
  } catch (error) {
    next(error);
  }
}

export async function drawTokens(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const result = await actionService.drawTokens(actionId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDrawResult(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const result = await actionService.getDrawResult(actionId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function submitNarration(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const data = narrationSchema.parse(req.body);
    const narration = await actionService.submitNarration(actionId, userId, data);
    res.status(201).json({ success: true, data: narration });
  } catch (error) {
    next(error);
  }
}

export async function getNarration(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const narration = await actionService.getNarration(actionId, userId);
    res.json({ success: true, data: narration });
  } catch (error) {
    next(error);
  }
}

export async function skipArgumentation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const result = await actionService.skipArgumentation(actionId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function skipVoting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const result = await actionService.skipVoting(actionId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
