import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the services
vi.mock('../../../src/services/game.service.js', () => ({
  createGame: vi.fn(),
  getGame: vi.fn(),
  updateGame: vi.fn(),
  joinGame: vi.fn(),
  selectPersona: vi.fn(),
  updatePersona: vi.fn(),
  leaveGame: vi.fn(),
  deleteGame: vi.fn(),
  startGame: vi.fn(),
  getPlayers: vi.fn(),
  getGameHistory: vi.fn(),
  getRounds: vi.fn(),
  updateGameImage: vi.fn(),
  getGameTimeoutStatus: vi.fn(),
  extendTimeout: vi.fn(),
}));

vi.mock('../../../src/services/action.service.js', () => ({
  proposeAction: vi.fn(),
  skipToNextAction: vi.fn(),
}));

vi.mock('../../../src/services/export.service.js', () => ({
  exportGameState: vi.fn(),
  importGameFromYaml: vi.fn(),
}));

vi.mock('../../../src/config/uploads.js', () => ({
  getUploadsDir: vi.fn().mockReturnValue('/tmp/uploads'),
}));

vi.mock('fs/promises', () => ({
  default: { unlink: vi.fn() },
}));

import * as gameController from '../../../src/controllers/game.controller.js';
import * as gameService from '../../../src/services/game.service.js';
import * as actionService from '../../../src/services/action.service.js';
import * as exportService from '../../../src/services/export.service.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1', email: 'test@test.com', displayName: 'Test User' },
    params: {},
    body: {},
    file: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('Game Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('createGame', () => {
    it('should create a game and return 201', async () => {
      const mockGame = { id: 'game-1', name: 'Test Game' };
      vi.mocked(gameService.createGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({ body: { name: 'Test Game' } });
      const res = createMockRes();

      await gameController.createGame(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGame });
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      vi.mocked(gameService.createGame).mockRejectedValue(error);

      const req = createMockReq({ body: { name: 'Test Game' } });
      const res = createMockRes();

      await gameController.createGame(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should forward validation errors to next', async () => {
      const req = createMockReq({ body: { name: '' } });
      const res = createMockRes();

      await gameController.createGame(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getGame', () => {
    it('should return game data', async () => {
      const mockGame = { id: 'game-1', name: 'Test Game' };
      vi.mocked(gameService.getGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.getGame(req, res, next);

      expect(gameService.getGame).toHaveBeenCalledWith('game-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGame });
    });

    it('should forward errors to next', async () => {
      const error = new Error('Not found');
      vi.mocked(gameService.getGame).mockRejectedValue(error);

      const req = createMockReq({ params: { gameId: 'bad-id' } as any });
      const res = createMockRes();

      await gameController.getGame(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateGame', () => {
    it('should update and return game', async () => {
      const mockGame = { id: 'game-1', name: 'Updated' };
      vi.mocked(gameService.updateGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        body: { name: 'Updated' },
      });
      const res = createMockRes();

      await gameController.updateGame(req, res, next);

      expect(gameService.updateGame).toHaveBeenCalledWith('game-1', 'user-1', { name: 'Updated' });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGame });
    });
  });

  describe('joinGame', () => {
    it('should join a game with player name from body', async () => {
      const mockPlayer = { id: 'player-1', playerName: 'Custom Name' };
      vi.mocked(gameService.joinGame).mockResolvedValue(mockPlayer as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        body: { playerName: 'Custom Name' },
      });
      const res = createMockRes();

      await gameController.joinGame(req, res, next);

      expect(gameService.joinGame).toHaveBeenCalledWith(
        'game-1',
        'user-1',
        'Custom Name',
        undefined
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPlayer });
    });

    it('should fall back to displayName when playerName not provided', async () => {
      const mockPlayer = { id: 'player-1', playerName: 'Test User' };
      vi.mocked(gameService.joinGame).mockResolvedValue(mockPlayer as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        body: {},
      });
      const res = createMockRes();

      await gameController.joinGame(req, res, next);

      expect(gameService.joinGame).toHaveBeenCalledWith('game-1', 'user-1', 'Test User', undefined);
    });
  });

  describe('selectPersona', () => {
    it('should select persona and return player', async () => {
      const mockPlayer = { id: 'player-1' };
      vi.mocked(gameService.selectPersona).mockResolvedValue(mockPlayer as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        body: { personaId: '00000000-0000-0000-0000-000000000001' },
      });
      const res = createMockRes();

      await gameController.selectPersona(req, res, next);

      expect(gameService.selectPersona).toHaveBeenCalledWith(
        'game-1',
        'user-1',
        '00000000-0000-0000-0000-000000000001'
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPlayer });
    });
  });

  describe('updatePersona', () => {
    it('should update persona and return result', async () => {
      const mockPersona = { id: 'persona-1', name: 'Updated' };
      vi.mocked(gameService.updatePersona).mockResolvedValue(mockPersona as any);

      const req = createMockReq({
        params: { gameId: 'game-1', personaId: 'persona-1' } as any,
        body: { name: 'Updated' },
      });
      const res = createMockRes();

      await gameController.updatePersona(req, res, next);

      expect(gameService.updatePersona).toHaveBeenCalledWith('game-1', 'persona-1', 'user-1', {
        name: 'Updated',
      });
    });
  });

  describe('leaveGame', () => {
    it('should leave game and return success message', async () => {
      vi.mocked(gameService.leaveGame).mockResolvedValue(undefined as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.leaveGame(req, res, next);

      expect(gameService.leaveGame).toHaveBeenCalledWith('game-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Left game successfully' },
      });
    });
  });

  describe('deleteGame', () => {
    it('should delete game and return result', async () => {
      const mockResult = { message: 'Deleted' };
      vi.mocked(gameService.deleteGame).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.deleteGame(req, res, next);

      expect(gameService.deleteGame).toHaveBeenCalledWith('game-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('startGame', () => {
    it('should start game and return result', async () => {
      const mockGame = { id: 'game-1', status: 'ACTIVE' };
      vi.mocked(gameService.startGame).mockResolvedValue(mockGame as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.startGame(req, res, next);

      expect(gameService.startGame).toHaveBeenCalledWith('game-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGame });
    });
  });

  describe('getPlayers', () => {
    it('should return players list', async () => {
      const mockPlayers = [{ id: 'p1' }, { id: 'p2' }];
      vi.mocked(gameService.getPlayers).mockResolvedValue(mockPlayers as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.getPlayers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPlayers });
    });
  });

  describe('getGameHistory', () => {
    it('should return game history', async () => {
      const mockHistory = [{ round: 1 }];
      vi.mocked(gameService.getGameHistory).mockResolvedValue(mockHistory as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.getGameHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockHistory });
    });
  });

  describe('getRounds', () => {
    it('should return rounds', async () => {
      const mockRounds = [{ id: 'round-1', roundNumber: 1 }];
      vi.mocked(gameService.getRounds).mockResolvedValue(mockRounds as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.getRounds(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRounds });
    });
  });

  describe('proposeAction', () => {
    it('should propose action and return 201', async () => {
      const mockAction = { id: 'action-1' };
      vi.mocked(actionService.proposeAction).mockResolvedValue(mockAction as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        body: {
          actionDescription: 'Test action',
          desiredOutcome: 'Success',
          initialArguments: ['Because reasons'],
        },
      });
      const res = createMockRes();

      await gameController.proposeAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAction });
    });
  });

  describe('uploadGameImage', () => {
    it('should upload image and return URL', async () => {
      const mockGame = { id: 'game-1' };
      vi.mocked(gameService.updateGameImage).mockResolvedValue(mockGame as any);

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        file: { filename: 'test.jpg' } as any,
      });
      const res = createMockRes();

      await gameController.uploadGameImage(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          imageUrl: expect.stringContaining('test.jpg'),
          game: mockGame,
        },
      });
    });

    it('should return error when no file uploaded', async () => {
      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.uploadGameImage(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No file uploaded',
        })
      );
    });

    it('should clean up file on service error', async () => {
      const fs = await import('fs/promises');
      vi.mocked(gameService.updateGameImage).mockRejectedValue(new Error('Service error'));

      const req = createMockReq({
        params: { gameId: 'game-1' } as any,
        file: { filename: 'test.jpg' } as any,
      });
      const res = createMockRes();

      await gameController.uploadGameImage(req, res, next);

      expect(fs.default.unlink).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('skipProposals', () => {
    it('should skip proposals and return result', async () => {
      const mockResult = { message: 'Skipped' };
      vi.mocked(actionService.skipToNextAction).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.skipProposals(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('exportGame', () => {
    it('should export game as YAML', async () => {
      vi.mocked(exportService.exportGameState).mockResolvedValue({
        yaml: 'name: Test Game',
        filename: 'game-export.yaml',
      } as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.exportGame(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/yaml');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="game-export.yaml"'
      );
      expect(res.send).toHaveBeenCalledWith('name: Test Game');
    });
  });

  describe('getTimeoutStatus', () => {
    it('should return timeout status', async () => {
      vi.mocked(gameService.getGame).mockResolvedValue({} as any);
      const mockStatus = { phase: 'PROPOSAL', timeRemaining: 3600000 };
      vi.mocked(gameService.getGameTimeoutStatus).mockResolvedValue(mockStatus as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.getTimeoutStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockStatus });
    });
  });

  describe('extendTimeout', () => {
    it('should extend timeout and return result', async () => {
      const mockResult = { extended: true };
      vi.mocked(gameService.extendTimeout).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { gameId: 'game-1' } as any });
      const res = createMockRes();

      await gameController.extendTimeout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('importGame', () => {
    it('should import game from string body', async () => {
      const mockGame = { id: 'game-1' };
      vi.mocked(exportService.importGameFromYaml).mockResolvedValue(mockGame as any);

      const req = createMockReq({ body: 'name: Test Game' });
      const res = createMockRes();

      await gameController.importGame(req, res, next);

      expect(exportService.importGameFromYaml).toHaveBeenCalledWith('name: Test Game', 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should import game from yaml property', async () => {
      const mockGame = { id: 'game-1' };
      vi.mocked(exportService.importGameFromYaml).mockResolvedValue(mockGame as any);

      const req = createMockReq({ body: { yaml: 'name: Test Game' } });
      const res = createMockRes();

      await gameController.importGame(req, res, next);

      expect(exportService.importGameFromYaml).toHaveBeenCalledWith('name: Test Game', 'user-1');
    });

    it('should return error for invalid body', async () => {
      const req = createMockReq({ body: { foo: 'bar' } });
      const res = createMockRes();

      await gameController.importGame(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('YAML'),
        })
      );
    });
  });
});
