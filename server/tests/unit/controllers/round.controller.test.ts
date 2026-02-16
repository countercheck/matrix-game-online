import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/round.service.js', () => ({
  getRound: vi.fn(),
  submitRoundSummary: vi.fn(),
  getRoundSummary: vi.fn(),
  updateRoundSummary: vi.fn(),
}));

import * as roundController from '../../../src/controllers/round.controller.js';
import * as roundService from '../../../src/services/round.service.js';

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

describe('Round Controller', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('getRound', () => {
    it('should return round data', async () => {
      const mockRound = { id: 'round-1', roundNumber: 1 };
      vi.mocked(roundService.getRound).mockResolvedValue(mockRound as any);

      const req = createMockReq({ params: { roundId: 'round-1' } as any });
      const res = createMockRes();

      await roundController.getRound(req, res, next);

      expect(roundService.getRound).toHaveBeenCalledWith('round-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRound });
    });

    it('should forward errors', async () => {
      vi.mocked(roundService.getRound).mockRejectedValue(new Error('Not found'));

      const req = createMockReq({ params: { roundId: 'bad-id' } as any });
      const res = createMockRes();

      await roundController.getRound(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('submitRoundSummary', () => {
    it('should submit round summary and return 201', async () => {
      const mockResult = { id: 'summary-1', content: 'Round ended...' };
      vi.mocked(roundService.submitRoundSummary).mockResolvedValue(mockResult as any);

      const req = createMockReq({
        params: { roundId: 'round-1' } as any,
        body: { content: 'Round ended...' },
      });
      const res = createMockRes();

      await roundController.submitRoundSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });
  });

  describe('getRoundSummary', () => {
    it('should return round summary', async () => {
      const mockSummary = { id: 'summary-1', content: 'Round ended...' };
      vi.mocked(roundService.getRoundSummary).mockResolvedValue(mockSummary as any);

      const req = createMockReq({ params: { roundId: 'round-1' } as any });
      const res = createMockRes();

      await roundController.getRoundSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSummary });
    });
  });

  describe('updateRoundSummary', () => {
    it('should update round summary', async () => {
      const mockSummary = { id: 'summary-1', content: 'Updated summary' };
      vi.mocked(roundService.updateRoundSummary).mockResolvedValue(mockSummary as any);

      const req = createMockReq({
        params: { roundId: 'round-1' } as any,
        body: { content: 'Updated summary' },
      });
      const res = createMockRes();

      await roundController.updateRoundSummary(req, res, next);

      expect(roundService.updateRoundSummary).toHaveBeenCalledWith(
        'round-1',
        'user-1',
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSummary });
    });
  });
});
