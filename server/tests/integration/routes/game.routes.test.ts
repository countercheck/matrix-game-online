import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock data store
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

  // Create game
  app.post('/api/games', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const { name, description } = req.body;

    if (!name || name.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Game name required' },
      });
    }

    const gameId = `game-${Date.now()}`;
    const game = {
      id: gameId,
      name,
      description,
      creatorId: req.user.id,
      status: 'LOBBY',
      currentPhase: 'WAITING',
      playerCount: 1,
    };

    games.set(gameId, game);
    players.set(gameId, [{
      id: `player-${Date.now()}`,
      userId: req.user.id,
      playerName: req.user.displayName,
      isHost: true,
      isActive: true,
    }]);

    res.status(201).json({ success: true, data: { ...game, players: players.get(gameId) } });
  });

  // Get game
  app.get('/api/games/:gameId', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const isMember = gamePlayers.some((p: any) => p.userId === req.user.id && p.isActive);

    if (!isMember && game.status !== 'LOBBY') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    res.json({ success: true, data: { ...game, players: gamePlayers } });
  });

  // Join game
  app.post('/api/games/:gameId/join', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    if (game.status !== 'LOBBY') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Game has already started' },
      });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const existing = gamePlayers.find((p: any) => p.userId === req.user.id);

    if (existing && existing.isActive) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Already in this game' },
      });
    }

    const { playerName } = req.body;
    const newPlayer = {
      id: `player-${Date.now()}`,
      userId: req.user.id,
      playerName: playerName || req.user.displayName,
      isHost: false,
      isActive: true,
    };

    gamePlayers.push(newPlayer);
    players.set(req.params.gameId, gamePlayers);
    game.playerCount = gamePlayers.filter((p: any) => p.isActive).length;

    res.status(201).json({ success: true, data: newPlayer });
  });

  // Start game
  app.post('/api/games/:gameId/start', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const host = gamePlayers.find((p: any) => p.userId === req.user.id && p.isHost);

    if (!host) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the host can start the game' },
      });
    }

    if (game.status !== 'LOBBY') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Game has already started' },
      });
    }

    const activePlayers = gamePlayers.filter((p: any) => p.isActive);
    if (activePlayers.length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Need at least 2 players to start' },
      });
    }

    game.status = 'ACTIVE';
    game.currentPhase = 'PROPOSAL';
    game.startedAt = new Date();

    res.json({ success: true, data: { ...game, players: gamePlayers } });
  });

  // Leave game
  app.post('/api/games/:gameId/leave', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const player = gamePlayers.find((p: any) => p.userId === req.user.id && p.isActive);

    if (!player) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not in this game' },
      });
    }

    player.isActive = false;
    game.playerCount = gamePlayers.filter((p: any) => p.isActive).length;

    res.json({ success: true, data: { message: 'Left game successfully' } });
  });

  return app;
}

describe('Game Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    games = new Map();
    players = new Map();
    currentUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test User' };
    app = createTestApp();
  });

  describe('POST /api/games', () => {
    it('should create a new game', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game', description: 'A test' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Game');
      expect(response.body.data.status).toBe('LOBBY');
      expect(response.body.data.players).toHaveLength(1);
      expect(response.body.data.players[0].isHost).toBe(true);
    });

    it('should reject game without name', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({ description: 'No name' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject unauthenticated request', async () => {
      currentUser = null;
      const response = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/games/:gameId', () => {
    it('should get game by id', async () => {
      // Create game first
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      const response = await request(app).get(`/api/games/${gameId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(gameId);
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app).get('/api/games/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/games/:gameId/join', () => {
    it('should allow joining a game in lobby', async () => {
      // Create game as user 1
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Switch to user 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Player 2' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.playerName).toBe('Player 2');
      expect(response.body.data.isHost).toBe(false);
    });

    it('should reject joining already started game', async () => {
      // Create and start game
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Add another player
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Start game as host
      currentUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test User' };
      await request(app).post(`/api/games/${gameId}/start`);

      // Try to join as user 3
      currentUser = { id: 'user-3', email: 'third@example.com', displayName: 'Third User' };
      const response = await request(app).post(`/api/games/${gameId}/join`).send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('already started');
    });

    it('should reject double joining', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Try to join own game
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/games/:gameId/start', () => {
    it('should start game with enough players', async () => {
      // Create game
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Add player 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Start as host
      currentUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test User' };
      const response = await request(app).post(`/api/games/${gameId}/start`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.currentPhase).toBe('PROPOSAL');
    });

    it('should reject starting with only 1 player', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      const response = await request(app).post(`/api/games/${gameId}/start`);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('2 players');
    });

    it('should reject non-host starting game', async () => {
      // Create game as user 1
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Join as user 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Try to start as non-host
      const response = await request(app).post(`/api/games/${gameId}/start`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('host');
    });
  });

  describe('POST /api/games/:gameId/leave', () => {
    it('should allow leaving a game', async () => {
      // Create game
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Join as user 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Leave
      const response = await request(app).post(`/api/games/${gameId}/leave`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject leaving game not in', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Try to leave as different user
      currentUser = { id: 'user-99', email: 'other@example.com', displayName: 'Other' };
      const response = await request(app).post(`/api/games/${gameId}/leave`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /games/:gameId/image', () => {
    it('should upload an image for a game', async () => {
      // Create a simple 1x1 PNG image buffer
      const imageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const response = await request(app)
        .post(`/api/games/${game.id}/image`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', imageBuffer, 'test.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.imageUrl).toBeDefined();
      expect(response.body.data.game.imageUrl).toBeDefined();
    });

    it('should reject upload if user is not the game creator', async () => {
      const otherUserToken = generateToken({ id: 'other-user-id', email: 'other@test.com' });
      const imageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const response = await request(app)
        .post(`/api/games/${game.id}/image`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .attach('image', imageBuffer, 'test.png');

      expect(response.status).toBe(403);
    });

    it('should reject upload without a file', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/image`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });
});
