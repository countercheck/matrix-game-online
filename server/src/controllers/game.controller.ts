import { Request, Response, NextFunction } from 'express';
import * as gameService from '../services/game.service.js';
import * as actionService from '../services/action.service.js';
import {
  createGameSchema,
  actionProposalSchema,
  joinGameSchema,
  selectPersonaSchema,
} from '../utils/validators.js';

export async function createGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = createGameSchema.parse(req.body);
    const game = await gameService.createGame(userId, data);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function getGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const game = await gameService.getGame(gameId, userId);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function updateGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const game = await gameService.updateGame(gameId, userId, req.body);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function joinGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const data = joinGameSchema.parse(req.body);
    // Use provided playerName or fall back to user's displayName
    const playerName = data.playerName || req.user!.displayName;
    const player = await gameService.joinGame(gameId, userId, playerName, data.personaId);
    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
}

export async function selectPersona(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const { personaId } = selectPersonaSchema.parse(req.body);
    const player = await gameService.selectPersona(gameId, userId, personaId);
    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
}

export async function leaveGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    await gameService.leaveGame(gameId, userId);
    res.json({ success: true, data: { message: 'Left game successfully' } });
  } catch (error) {
    next(error);
  }
}

export async function startGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const game = await gameService.startGame(gameId, userId);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function getPlayers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const players = await gameService.getPlayers(gameId, userId);
    res.json({ success: true, data: players });
  } catch (error) {
    next(error);
  }
}

export async function getGameHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const history = await gameService.getGameHistory(gameId, userId);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getRounds(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const rounds = await gameService.getRounds(gameId, userId);
    res.json({ success: true, data: rounds });
  } catch (error) {
    next(error);
  }
}

export async function proposeAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const data = actionProposalSchema.parse(req.body);
    const action = await actionService.proposeAction(gameId, userId, data);
    res.status(201).json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
}
