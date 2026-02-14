import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
    },
    action: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
    TokenExpiredError: class TokenExpiredError extends Error {},
  },
}));

import jwt from 'jsonwebtoken';
import { db } from '../../../src/config/database.js';
import {
  authenticateToken,
  requireGameMember,
  requireGameHost,
  requireActionInitiator,
} from '../../../src/middleware/auth.middleware.js';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token provided', async () => {
      const req = {
        headers: {},
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No token provided' }));
    });

    it('should return 401 if token is invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      const req = {
        headers: { authorization: 'Bearer invalid-token' },
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });

    it('should set req.user on valid token', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 'user-1',
        email: 'test@example.com',
      } as any);

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      } as any);

      const req = {
        headers: { authorization: 'Bearer valid-token' },
      } as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await authenticateToken(req, res, next);

      expect(req.user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireGameMember', () => {
    it('should return 401 if not authenticated', async () => {
      const middleware = requireGameMember();
      const req = {
        params: { gameId: 'game-1' },
        user: undefined,
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authentication required' })
      );
    });

    it('should return 403 if not a game member', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null);

      const middleware = requireGameMember();
      const req = {
        params: { gameId: 'game-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not a member of this game' })
      );
    });

    it('should attach gamePlayer and call next if member', async () => {
      const mockPlayer = {
        id: 'player-1',
        userId: 'user-1',
        gameId: 'game-1',
        isHost: false,
      };
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);

      const middleware = requireGameMember();
      const req = {
        params: { gameId: 'game-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect((req as any).gamePlayer).toEqual(mockPlayer);
      expect(next).toHaveBeenCalledWith();
    });

    it('should use custom gameId param name', async () => {
      const mockPlayer = { id: 'player-1' };
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(mockPlayer as any);

      const middleware = requireGameMember('id');
      const req = {
        params: { id: 'game-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(db.gamePlayer.findFirst).toHaveBeenCalledWith({
        where: { gameId: 'game-1', userId: 'user-1', isActive: true },
      });
    });
  });

  describe('requireGameHost', () => {
    it('should return 403 if not host', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        isHost: false,
      } as any);

      const middleware = requireGameHost();
      const req = {
        params: { gameId: 'game-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Only the host can perform this action',
        })
      );
    });

    it('should call next if user is host', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        isHost: true,
      } as any);

      const middleware = requireGameHost();
      const req = {
        params: { gameId: 'game-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireActionInitiator', () => {
    it('should return 403 if not initiator', async () => {
      vi.mocked(db.action.findUnique).mockResolvedValue({
        id: 'action-1',
        initiator: { userId: 'other-user' },
      } as any);

      const middleware = requireActionInitiator();
      const req = {
        params: { actionId: 'action-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Only the initiator can perform this action',
        })
      );
    });

    it('should return 403 if action not found', async () => {
      vi.mocked(db.action.findUnique).mockResolvedValue(null);

      const middleware = requireActionInitiator();
      const req = {
        params: { actionId: 'non-existent' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Action not found' }));
    });

    it('should call next if user is initiator', async () => {
      const mockAction = {
        id: 'action-1',
        initiator: { userId: 'user-1' },
      };
      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);

      const middleware = requireActionInitiator();
      const req = {
        params: { actionId: 'action-1' },
        user: { id: 'user-1' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect((req as any).action).toEqual(mockAction);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
