import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock data store
let rounds: Map<string, any>;
let roundSummaries: Map<string, any>;
let games: Map<string, any>;
let players: Map<string, any[]>;
let currentUser: { id: string; email: string; displayName: string } | null;

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });

  // GET /api/rounds/:roundId
  app.get('/api/rounds/:roundId', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const round = rounds.get(req.params.roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Round not found' },
      });
    }

    const gamePlayers = players.get(round.gameId) || [];
    const isMember = gamePlayers.some((p) => p.userId === req.user.id && p.isActive);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this game' },
      });
    }

    // Calculate progress
    const progress = {
      actionsCompleted: round.actionsCompleted,
      totalRequired: round.totalActionsRequired,
      remaining: round.totalActionsRequired - round.actionsCompleted,
      isComplete: round.actionsCompleted >= round.totalActionsRequired,
      percentage: Math.round((round.actionsCompleted / round.totalActionsRequired) * 100),
    };

    // Mock players who have/haven't proposed
    const playersWhoProposed = gamePlayers
      .filter((p) => round.proposedPlayerIds?.includes(p.userId))
      .map((p) => ({ id: p.id, userId: p.userId, playerName: p.playerName }));

    const playersWhoHaventProposed = gamePlayers
      .filter((p) => !round.proposedPlayerIds?.includes(p.userId) && p.isActive)
      .map((p) => ({ id: p.id, userId: p.userId, playerName: p.playerName }));

    res.json({
      success: true,
      data: {
        ...round,
        progress,
        playersWhoProposed,
        playersWhoHaventProposed,
        summary: roundSummaries.get(round.id) || null,
      },
    });
  });

  // POST /api/rounds/:roundId/summary
  app.post('/api/rounds/:roundId/summary', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const round = rounds.get(req.params.roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Round not found' },
      });
    }

    const game = games.get(round.gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    }

    const gamePlayers = players.get(round.gameId) || [];
    const isMember = gamePlayers.some((p) => p.userId === req.user.id && p.isActive);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this game' },
      });
    }

    // Validate round is complete
    if (round.actionsCompleted < round.totalActionsRequired) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Round is not complete. ${round.totalActionsRequired - round.actionsCompleted} actions remaining.`,
        },
      });
    }

    // Validate game is in ROUND_SUMMARY phase
    if (game.currentPhase !== 'ROUND_SUMMARY') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Game is not in round summary phase' },
      });
    }

    // Check if summary already exists
    if (roundSummaries.has(round.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Round summary already submitted' },
      });
    }

    const { content, outcomes } = req.body;

    if (!content || content.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Summary content required' },
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Summary must be 2000 characters or less' },
      });
    }

    const summary = {
      id: `summary-${Date.now()}`,
      roundId: round.id,
      authorId: req.user.id,
      content,
      outcomes: outcomes || {},
      createdAt: new Date(),
    };

    roundSummaries.set(round.id, summary);

    // Update round status
    round.status = 'COMPLETED';
    round.completedAt = new Date();

    // Create next round
    const nextRoundId = `round-${Date.now()}`;
    const nextRound = {
      id: nextRoundId,
      gameId: round.gameId,
      roundNumber: round.roundNumber + 1,
      status: 'IN_PROGRESS',
      actionsCompleted: 0,
      totalActionsRequired: gamePlayers.filter((p) => p.isActive).length,
      proposedPlayerIds: [],
    };
    rounds.set(nextRoundId, nextRound);

    // Update game
    game.currentRoundId = nextRoundId;
    game.currentPhase = 'PROPOSAL';

    res.status(201).json({
      success: true,
      data: {
        summary,
        nextRound,
      },
    });
  });

  // GET /api/rounds/:roundId/summary
  app.get('/api/rounds/:roundId/summary', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const round = rounds.get(req.params.roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Round not found' },
      });
    }

    const gamePlayers = players.get(round.gameId) || [];
    const isMember = gamePlayers.some((p) => p.userId === req.user.id && p.isActive);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this game' },
      });
    }

    const summary = roundSummaries.get(round.id);
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Round summary not found' },
      });
    }

    res.json({ success: true, data: summary });
  });

  return app;
}

describe('Round Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();

    // Reset mock stores
    rounds = new Map();
    roundSummaries = new Map();
    games = new Map();
    players = new Map();

    // Set up default user
    currentUser = {
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    // Set up default game
    games.set('game-1', {
      id: 'game-1',
      name: 'Test Game',
      status: 'ACTIVE',
      currentPhase: 'PROPOSAL',
      currentRoundId: 'round-1',
    });

    // Set up default players
    players.set('game-1', [
      { id: 'player-1', userId: 'user-123', playerName: 'Test User', isHost: true, isActive: true },
      { id: 'player-2', userId: 'user-456', playerName: 'Player 2', isHost: false, isActive: true },
      { id: 'player-3', userId: 'user-789', playerName: 'Player 3', isHost: false, isActive: true },
    ]);

    // Set up default round
    rounds.set('round-1', {
      id: 'round-1',
      gameId: 'game-1',
      roundNumber: 1,
      status: 'IN_PROGRESS',
      actionsCompleted: 1,
      totalActionsRequired: 3,
      proposedPlayerIds: ['user-123'],
    });
  });

  describe('GET /api/rounds/:roundId', () => {
    it('should return round with progress info', async () => {
      const response = await request(app).get('/api/rounds/round-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('round-1');
      expect(response.body.data.roundNumber).toBe(1);
      expect(response.body.data.progress).toBeDefined();
      expect(response.body.data.progress.actionsCompleted).toBe(1);
      expect(response.body.data.progress.totalRequired).toBe(3);
      expect(response.body.data.progress.remaining).toBe(2);
      expect(response.body.data.progress.isComplete).toBe(false);
    });

    it('should return players who have and havent proposed', async () => {
      const response = await request(app).get('/api/rounds/round-1');

      expect(response.status).toBe(200);
      expect(response.body.data.playersWhoProposed).toHaveLength(1);
      expect(response.body.data.playersWhoProposed[0].userId).toBe('user-123');
      expect(response.body.data.playersWhoHaventProposed).toHaveLength(2);
    });

    it('should return 404 for non-existent round', async () => {
      const response = await request(app).get('/api/rounds/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if not a game member', async () => {
      currentUser = { id: 'other-user', email: 'other@example.com', displayName: 'Other' };

      const response = await request(app).get('/api/rounds/round-1');

      expect(response.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      currentUser = null;

      const response = await request(app).get('/api/rounds/round-1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/rounds/:roundId/summary', () => {
    beforeEach(() => {
      // Set round as complete
      rounds.set('round-1', {
        id: 'round-1',
        gameId: 'game-1',
        roundNumber: 1,
        status: 'IN_PROGRESS',
        actionsCompleted: 3,
        totalActionsRequired: 3,
        proposedPlayerIds: ['user-123', 'user-456', 'user-789'],
      });

      // Set game to ROUND_SUMMARY phase
      games.set('game-1', {
        id: 'game-1',
        name: 'Test Game',
        status: 'ACTIVE',
        currentPhase: 'ROUND_SUMMARY',
        currentRoundId: 'round-1',
      });
    });

    it('should submit round summary successfully', async () => {
      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({
          content: 'This round was intense! The heroes faced many challenges.',
          outcomes: {
            totalTriumphs: 1,
            totalDisasters: 0,
            netMomentum: 3,
            keyEvents: ['Victory at the bridge'],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.content).toContain('intense');
      expect(response.body.data.nextRound).toBeDefined();
      expect(response.body.data.nextRound.roundNumber).toBe(2);
    });

    it('should create next round after summary', async () => {
      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'Round 1 complete.' });

      expect(response.status).toBe(201);
      expect(response.body.data.nextRound.status).toBe('IN_PROGRESS');
      expect(response.body.data.nextRound.actionsCompleted).toBe(0);
    });

    it('should reject summary if round not complete', async () => {
      rounds.set('round-1', {
        id: 'round-1',
        gameId: 'game-1',
        roundNumber: 1,
        status: 'IN_PROGRESS',
        actionsCompleted: 2,
        totalActionsRequired: 3,
      });

      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'Summary' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('not complete');
    });

    it('should reject summary if not in ROUND_SUMMARY phase', async () => {
      games.set('game-1', {
        id: 'game-1',
        name: 'Test Game',
        status: 'ACTIVE',
        currentPhase: 'NARRATION',
        currentRoundId: 'round-1',
      });

      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'Summary' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('round summary phase');
    });

    it('should reject duplicate summary', async () => {
      // First submission
      await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'First summary' });

      // Reset game phase back to ROUND_SUMMARY to test duplicate check
      // (In real app, this wouldn't happen, but we need to test the duplicate check)
      games.set('game-1', {
        id: 'game-1',
        name: 'Test Game',
        status: 'ACTIVE',
        currentPhase: 'ROUND_SUMMARY',
        currentRoundId: 'round-1',
      });

      // Second submission should fail
      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'Second summary' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('already submitted');
    });

    it('should reject empty summary content', async () => {
      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: '' });

      expect(response.status).toBe(400);
    });

    it('should reject summary over 2000 characters', async () => {
      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'x'.repeat(2001) });

      expect(response.status).toBe(400);
    });

    it('should return 403 if not a game member', async () => {
      currentUser = { id: 'other-user', email: 'other@example.com', displayName: 'Other' };

      const response = await request(app)
        .post('/api/rounds/round-1/summary')
        .send({ content: 'Summary' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/rounds/:roundId/summary', () => {
    beforeEach(() => {
      roundSummaries.set('round-1', {
        id: 'summary-1',
        roundId: 'round-1',
        authorId: 'user-123',
        content: 'The round was exciting!',
        outcomes: { netMomentum: 2 },
        createdAt: new Date(),
      });
    });

    it('should return round summary', async () => {
      const response = await request(app).get('/api/rounds/round-1/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('The round was exciting!');
      expect(response.body.data.outcomes.netMomentum).toBe(2);
    });

    it('should return 404 if summary not found', async () => {
      roundSummaries.clear();

      const response = await request(app).get('/api/rounds/round-1/summary');

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent round', async () => {
      const response = await request(app).get('/api/rounds/non-existent/summary');

      expect(response.status).toBe(404);
    });

    it('should return 403 if not a game member', async () => {
      currentUser = { id: 'other-user', email: 'other@example.com', displayName: 'Other' };

      const response = await request(app).get('/api/rounds/round-1/summary');

      expect(response.status).toBe(403);
    });
  });
});
