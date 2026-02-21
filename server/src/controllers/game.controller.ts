import { Request, Response, NextFunction } from 'express';
import * as gameService from '../services/game.service.js';
import * as actionService from '../services/action.service.js';
import * as exportService from '../services/export.service.js';
import {
  createGameSchema,
  actionProposalSchema,
  joinGameSchema,
  selectPersonaSchema,
  setPersonaLeadSchema,
  updatePersonaSchema,
} from '../utils/validators.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import { getAllStrategies } from '../services/resolution/index.js';
import fs from 'fs/promises';
import path from 'path';
import { getUploadsDir } from '../config/uploads.js';

export async function getResolutionMethods(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const strategies = getAllStrategies();
    const methods = strategies.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      description: s.description,
    }));
    res.json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
}

export async function createGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = createGameSchema.parse(req.body);
    const game = await gameService.createGame(userId, data);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function getGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const game = await gameService.getGame(gameId, userId);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function updateGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const game = await gameService.updateGame(gameId, userId, req.body);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function joinGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
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
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const { personaId } = selectPersonaSchema.parse(req.body);
    const player = await gameService.selectPersona(gameId, userId, personaId);
    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
}

export async function setPersonaLead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const personaId = req.params.personaId as string;
    const userId = req.user!.id;
    const { playerId } = setPersonaLeadSchema.parse(req.body);
    const result = await gameService.setPersonaLead(gameId, personaId, playerId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updatePersona(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const personaId = req.params.personaId as string;
    const userId = req.user!.id;
    const data = updatePersonaSchema.parse(req.body);
    const persona = await gameService.updatePersona(gameId, personaId, userId, data);
    res.json({ success: true, data: persona });
  } catch (error) {
    next(error);
  }
}

export async function leaveGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    await gameService.leaveGame(gameId, userId);
    res.json({ success: true, data: { message: 'Left game successfully' } });
  } catch (error) {
    next(error);
  }
}

export async function deleteGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const result = await gameService.deleteGame(gameId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function startGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const game = await gameService.startGame(gameId, userId);
    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function getPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
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
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const history = await gameService.getGameHistory(gameId, userId);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getRounds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
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
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const data = actionProposalSchema.parse(req.body);
    const action = await actionService.proposeAction(gameId, userId, data);
    res.status(201).json({ success: true, data: action });
  } catch (error) {
    next(error);
  }
}

export async function uploadGameImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;

    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    // Build the public URL for the image
    const storageUrl =
      process.env.STORAGE_URL || `http://localhost:${process.env.PORT || 3000}/uploads`;
    const normalizedStorageUrl = storageUrl.replace(/\/+$/, '');
    const imageUrl = `${normalizedStorageUrl}/${req.file.filename}`;

    // Update the game with the image URL
    const game = await gameService.updateGameImage(gameId, userId, imageUrl);

    res.json({ success: true, data: { imageUrl, game } });
  } catch (error) {
    // Clean up uploaded file if there's an error
    if (req.file) {
      const filePath = path.join(getUploadsDir(), req.file.filename);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore errors during cleanup
      }
    }
    next(error);
  }
}

export async function skipProposals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const result = await actionService.skipToNextAction(gameId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function exportGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const { yaml, filename } = await exportService.exportGameState(gameId, userId);
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(yaml);
  } catch (error) {
    next(error);
  }
}

export async function getTimeoutStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    // Verify membership by fetching game (throws if not a member)
    await gameService.getGame(gameId, userId);
    const status = await gameService.getGameTimeoutStatus(gameId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function extendTimeout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const userId = req.user!.id;
    const result = await gameService.extendTimeout(gameId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function importGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    let yamlString: string;
    if (typeof req.body === 'string') {
      yamlString = req.body;
    } else if (req.body?.yaml) {
      yamlString = req.body.yaml;
    } else {
      throw new BadRequestError(
        'Request body must contain YAML content (as raw text or { yaml: "..." })'
      );
    }

    const game = await exportService.importGameFromYaml(yamlString, userId);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
}

export async function setPlayerRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameId = req.params.gameId as string;
    const targetPlayerId = req.params.playerId as string;
    const userId = req.user!.id;
    const { role } = req.body as { role: 'PLAYER' | 'ARBITER' };

    if (role !== 'PLAYER' && role !== 'ARBITER') {
      throw new BadRequestError('role must be PLAYER or ARBITER');
    }

    const player = await gameService.setPlayerRole(gameId, targetPlayerId, role, userId);
    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
}
