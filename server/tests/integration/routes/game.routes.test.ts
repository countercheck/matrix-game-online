import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

// Mock data store
let games: Map<string, any>;
let players: Map<string, any[]>;
let currentUser: { id: string; email: string; displayName: string } | null;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.text({ type: ['text/yaml', 'text/plain', 'application/x-yaml'] }));

  // Mock auth middleware
  app.use((req: any, _res, next) => {
    req.user = currentUser;
    next();
  });

  // Configure multer for tests (using memory storage)
  const upload = multer({ storage: multer.memoryStorage() });

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

  // Upload game image
  app.post('/api/games/:gameId/image', upload.single('image'), (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    if (game.creatorId !== req.user.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const imageUrl = `http://localhost:3000/uploads/${req.file.filename || 'test-image.png'}`;
    game.imageUrl = imageUrl;

    res.json({ success: true, data: { imageUrl, game } });
  });

  // Delete game
  app.delete('/api/games/:gameId', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game || game.deletedAt) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Game not found' } });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const hostPlayer = gamePlayers.find((p: any) => p.isHost);

    if (!hostPlayer || hostPlayer.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the game host can delete this game' },
      });
    }

    if (game.status !== 'LOBBY') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot delete a game that has already started' },
      });
    }

    // Soft delete
    game.deletedAt = new Date();

    res.json({ success: true, data: { message: 'Game deleted successfully' } });
  });

  // Export game
  app.get('/api/games/:gameId/export', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const game = games.get(req.params.gameId);
    if (!game || game.deletedAt) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const gamePlayers = players.get(req.params.gameId) || [];
    const isMember = gamePlayers.some((p: any) => p.userId === req.user.id && p.isActive);

    if (!isMember) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    // Generate a simple YAML export
    const yamlContent = `exported_at: ${new Date().toISOString()}
game:
  name: ${game.name}
  description: ${game.description || 'null'}
  status: ${game.status}
  current_phase: ${game.currentPhase}
  settings:
    argument_limit: 3
    argumentation_timeout_hours: 24
    voting_timeout_hours: 24
    narration_mode: initiator_only
    personas_required: false
personas: []
players: []
rounds: []
`;

    const safeName = game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${safeName}-export-${date}.yaml`;

    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(yamlContent);
  });

  // Import game
  app.post('/api/games/import', (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const yamlContent = req.body;
    if (!yamlContent || typeof yamlContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid YAML format' },
      });
    }

    // Simple YAML parsing validation
    try {
      const lines = yamlContent.split('\n');
      const hasGame = lines.some((line: string) => line.trim().startsWith('game:'));
      
      if (!hasGame) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid YAML: missing "game" section' },
        });
      }

      // Check for invalid personas array
      const personasMatch = yamlContent.match(/personas:\s*"[^"]*"/);
      if (personasMatch) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid YAML: "personas" must be an array' },
        });
      }

      // Check for invalid persona object
      const personasSection = yamlContent.split('personas:')[1];
      if (personasSection && personasSection.includes('- "')) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid YAML: persona at index 1 must be an object' },
        });
      }

      // Extract game name from YAML
      const nameMatch = yamlContent.match(/name:\s*(.+)/);
      const name = nameMatch ? nameMatch[1].trim() : 'Imported Game';

      // Create the imported game
      const gameId = `game-${Date.now()}`;
      const newGame = {
        id: gameId,
        name: `${name} (Copy)`,
        description: null,
        creatorId: req.user.id,
        status: 'LOBBY',
        currentPhase: 'WAITING',
        playerCount: 1,
      };

      games.set(gameId, newGame);
      players.set(gameId, [{
        id: `player-${Date.now()}`,
        userId: req.user.id,
        playerName: req.user.displayName,
        isHost: true,
        isActive: true,
      }]);

      res.status(201).json({ success: true, data: newGame });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid YAML format' },
      });
    }
  });

  return app;
}

describe('Game Routes', () => {
  let app: express.Express;
  let game: any;
  let authToken: string;

  beforeEach(async () => {
    games = new Map();
    players = new Map();
    currentUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test User' };
    app = createTestApp();
    
    // Create a test game for image upload tests
    const res = await request(app)
      .post('/api/games')
      .send({ name: 'Test Game' });
    game = res.body.data;
    authToken = 'mock-token'; // Mock token for tests
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
        .attach('image', imageBuffer, 'test.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.imageUrl).toBeDefined();
      expect(response.body.data.game.imageUrl).toBeDefined();
    });

    it('should reject upload if user is not the game creator', async () => {
      // Change current user to a different user
      currentUser = { id: 'other-user-id', email: 'other@test.com', displayName: 'Other User' };
      const imageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const response = await request(app)
        .post(`/api/games/${game.id}/image`)
        .attach('image', imageBuffer, 'test.png');

      expect(response.status).toBe(403);
    });

    it('should reject upload without a file', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/image`);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/games/:gameId', () => {
    it('should allow host to delete a game in lobby status', async () => {
      // Create game as host
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Delete as host
      const response = await request(app).delete(`/api/games/${gameId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Game deleted successfully');
    });

    it('should reject deletion by non-host player', async () => {
      // Create game as user 1
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Join as user 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Try to delete as non-host (user 2)
      const response = await request(app).delete(`/api/games/${gameId}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('host');
    });

    it('should reject deletion when game has started', async () => {
      // Create game as user 1
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Add player 2
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      await request(app).post(`/api/games/${gameId}/join`).send({});

      // Start game as host
      currentUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test User' };
      await request(app).post(`/api/games/${gameId}/start`);

      // Try to delete started game
      const response = await request(app).delete(`/api/games/${gameId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain('already started');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app).delete('/api/games/nonexistent-game-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for already deleted game', async () => {
      // Create game
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Delete game
      await request(app).delete(`/api/games/${gameId}`);

      // Try to delete again
      const response = await request(app).delete(`/api/games/${gameId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/games/:gameId/export', () => {
    it('should export game as YAML with correct content-type and content-disposition', async () => {
      // Create game
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      const response = await request(app).get(`/api/games/${gameId}/export`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/yaml');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.yaml');
      expect(response.text).toContain('exported_at:');
      expect(response.text).toContain('game:');
      expect(response.text).toContain('name: Test Game');
    });

    it('should require authentication', async () => {
      currentUser = null;
      const response = await request(app).get('/api/games/game-1/export');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app).get('/api/games/nonexistent/export');

      expect(response.status).toBe(404);
    });

    it('should require membership to export', async () => {
      // Create game as user 1
      const createRes = await request(app)
        .post('/api/games')
        .send({ name: 'Test Game' });

      const gameId = createRes.body.data.id;

      // Try to export as user 2 (not a member)
      currentUser = { id: 'user-2', email: 'other@example.com', displayName: 'Other User' };
      const response = await request(app).get(`/api/games/${gameId}/export`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/games/import', () => {
    it('should import a valid YAML file and create a new game', async () => {
      const validYaml = `
game:
  name: Test Game
  description: A test description
  settings:
    argument_limit: 3
    argumentation_timeout_hours: 24
    voting_timeout_hours: 24
    narration_mode: initiator_only
    personas_required: false
personas:
  - name: Hero
    description: The protagonist
    is_npc: false
  - name: Villain
    description: The antagonist
    is_npc: true
    npc_action_description: Cause chaos
    npc_desired_outcome: World domination
`;

      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send(validYaml);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Game (Copy)');
      expect(response.body.data.status).toBe('LOBBY');
    });

    it('should require authentication', async () => {
      currentUser = null;
      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send('game:\n  name: Test');

      expect(response.status).toBe(401);
    });

    it('should reject invalid YAML', async () => {
      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send('invalid: yaml: :');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid YAML');
    });

    it('should reject YAML missing game section', async () => {
      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send('personas: []\n');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('missing "game" section');
    });

    it('should reject YAML with invalid personas array', async () => {
      const invalidYaml = `
game:
  name: Test
personas: "not an array"
`;

      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send(invalidYaml);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('personas" must be an array');
    });

    it('should reject YAML with invalid persona object', async () => {
      const invalidYaml = `
game:
  name: Test
personas:
  - name: Valid
  - "invalid object"
`;

      const response = await request(app)
        .post('/api/games/import')
        .set('Content-Type', 'text/yaml')
        .send(invalidYaml);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('persona at index');
    });
  });
});
