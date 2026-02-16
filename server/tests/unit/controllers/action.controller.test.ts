import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/action.service.js', () => ({
  getAction: vi.fn(),
  addArgument: vi.fn(),
  getArguments: vi.fn(),
  completeArgumentation: vi.fn(),
  submitVote: vi.fn(),
  getVotes: vi.fn(),
  drawTokens: vi.fn(),
  getDrawResult: vi.fn(),
  submitNarration: vi.fn(),
  getNarration: vi.fn(),
  skipArgumentation: vi.fn(),
  skipVoting: vi.fn(),
  updateAction: vi.fn(),
  updateArgument: vi.fn(),
  updateNarration: vi.fn(),
}));

import * as actionController from '../../../src/controllers/action.controller.js';
import * as actionService from '../../../src/services/action.service.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1', email: 'test@test.com', displayName: 'Test User' },
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('Action Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('getAction', () => {
    it('should return action data', async () => {
      const mockAction = { id: 'action-1', description: 'Test' };
      vi.mocked(actionService.getAction).mockResolvedValue(mockAction as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.getAction(req, res, next);

      expect(actionService.getAction).toHaveBeenCalledWith('action-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAction });
    });

    it('should forward errors', async () => {
      vi.mocked(actionService.getAction).mockRejectedValue(new Error('Not found'));

      const req = createMockReq({ params: { actionId: 'bad-id' } as any });
      const res = createMockRes();

      await actionController.getAction(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('addArgument', () => {
    it('should add argument and return 201', async () => {
      const mockArg = { id: 'arg-1', content: 'Test argument' };
      vi.mocked(actionService.addArgument).mockResolvedValue(mockArg as any);

      const req = createMockReq({
        params: { actionId: 'action-1' } as any,
        body: { content: 'Test argument', argumentType: 'FOR' },
      });
      const res = createMockRes();

      await actionController.addArgument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockArg });
    });
  });

  describe('getArguments', () => {
    it('should return arguments', async () => {
      const mockArgs = [{ id: 'arg-1' }];
      vi.mocked(actionService.getArguments).mockResolvedValue(mockArgs as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.getArguments(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockArgs });
    });
  });

  describe('completeArgumentation', () => {
    it('should complete argumentation', async () => {
      const mockResult = { completed: true };
      vi.mocked(actionService.completeArgumentation).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.completeArgumentation(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('submitVote', () => {
    it('should submit vote and return 201', async () => {
      const mockVote = { id: 'vote-1', voteType: 'LIKELY_SUCCESS' };
      vi.mocked(actionService.submitVote).mockResolvedValue(mockVote as any);

      const req = createMockReq({
        params: { actionId: 'action-1' } as any,
        body: { voteType: 'LIKELY_SUCCESS' },
      });
      const res = createMockRes();

      await actionController.submitVote(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockVote });
    });
  });

  describe('getVotes', () => {
    it('should return votes', async () => {
      const mockVotes = [{ id: 'vote-1' }];
      vi.mocked(actionService.getVotes).mockResolvedValue(mockVotes as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.getVotes(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockVotes });
    });
  });

  describe('drawTokens', () => {
    it('should draw tokens and return result', async () => {
      const mockResult = { tokens: ['SUCCESS', 'FAILURE', 'SUCCESS'] };
      vi.mocked(actionService.drawTokens).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.drawTokens(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('getDrawResult', () => {
    it('should return draw result', async () => {
      const mockResult = { outcome: 'SUCCESS' };
      vi.mocked(actionService.getDrawResult).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.getDrawResult(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('submitNarration', () => {
    it('should submit narration and return 201', async () => {
      const mockNarration = { id: 'narr-1', content: 'The hero...' };
      vi.mocked(actionService.submitNarration).mockResolvedValue(mockNarration as any);

      const req = createMockReq({
        params: { actionId: 'action-1' } as any,
        body: { content: 'The hero...' },
      });
      const res = createMockRes();

      await actionController.submitNarration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockNarration });
    });
  });

  describe('getNarration', () => {
    it('should return narration', async () => {
      const mockNarration = { id: 'narr-1', content: 'The hero...' };
      vi.mocked(actionService.getNarration).mockResolvedValue(mockNarration as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.getNarration(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockNarration });
    });
  });

  describe('skipArgumentation', () => {
    it('should skip argumentation', async () => {
      const mockResult = { skipped: true };
      vi.mocked(actionService.skipArgumentation).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.skipArgumentation(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('skipVoting', () => {
    it('should skip voting', async () => {
      const mockResult = { skipped: true };
      vi.mocked(actionService.skipVoting).mockResolvedValue(mockResult as any);

      const req = createMockReq({ params: { actionId: 'action-1' } as any });
      const res = createMockRes();

      await actionController.skipVoting(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('updateAction', () => {
    it('should update action', async () => {
      const mockAction = { id: 'action-1', description: 'Updated' };
      vi.mocked(actionService.updateAction).mockResolvedValue(mockAction as any);

      const req = createMockReq({
        params: { actionId: 'action-1' } as any,
        body: { actionDescription: 'Updated' },
      });
      const res = createMockRes();

      await actionController.updateAction(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAction });
    });
  });

  describe('updateArgument', () => {
    it('should update argument', async () => {
      const mockArg = { id: 'arg-1', content: 'Updated' };
      vi.mocked(actionService.updateArgument).mockResolvedValue(mockArg as any);

      const req = createMockReq({
        params: { argumentId: 'arg-1' } as any,
        body: { content: 'Updated' },
      });
      const res = createMockRes();

      await actionController.updateArgument(req, res, next);

      expect(actionService.updateArgument).toHaveBeenCalledWith(
        'arg-1',
        'user-1',
        expect.any(Object)
      );
    });
  });

  describe('updateNarration', () => {
    it('should update narration', async () => {
      const mockNarration = { id: 'narr-1', content: 'Updated' };
      vi.mocked(actionService.updateNarration).mockResolvedValue(mockNarration as any);

      const req = createMockReq({
        params: { actionId: 'action-1' } as any,
        body: { content: 'Updated' },
      });
      const res = createMockRes();

      await actionController.updateNarration(req, res, next);

      expect(actionService.updateNarration).toHaveBeenCalledWith(
        'action-1',
        'user-1',
        expect.any(Object)
      );
    });
  });
});
