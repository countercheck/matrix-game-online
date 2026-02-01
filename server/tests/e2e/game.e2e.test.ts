import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app.js';
import { testDb, cleanDatabase } from './setup.js';

const app = createTestApp();

describe('Game E2E Tests', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Create two test users
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'player1@example.com',
        password: 'Password123!',
        displayName: 'Player One',
      });
    user1Token = user1Response.body.data.token;
    user1Id = user1Response.body.data.user.id;

    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'player2@example.com',
        password: 'Password123!',
        displayName: 'Player Two',
      });
    user2Token = user2Response.body.data.token;
    user2Id = user2Response.body.data.user.id;
  });

  describe('Game Creation', () => {
    it('should create a new game', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Game',
          description: 'A test game for E2E testing',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Test Game',
        description: 'A test game for E2E testing',
        status: 'LOBBY',
        playerCount: 1,
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.players).toHaveLength(1);
      expect(response.body.data.players[0].isHost).toBe(true);

      // Verify in database
      const dbGame = await testDb.game.findUnique({
        where: { id: response.body.data.id },
        include: { players: true },
      });
      expect(dbGame).not.toBeNull();
      expect(dbGame?.name).toBe('Test Game');
      expect(dbGame?.creatorId).toBe(user1Id);
    });

    it('should create a game without description', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Simple Game',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Simple Game');
      expect(response.body.data.description).toBeNull();
    });

    it('should reject game creation without name', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          description: 'A game without a name',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject game creation without authentication', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({
          name: 'Unauthorized Game',
        });

      expect(response.status).toBe(401);
    });

    it('should log game creation event', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Event Test Game',
        });

      const gameId = response.body.data.id;

      const event = await testDb.gameEvent.findFirst({
        where: {
          gameId,
          eventType: 'GAME_CREATED',
        },
      });

      expect(event).not.toBeNull();
      expect(event?.userId).toBe(user1Id);
    });
  });

  describe('Game Joining', () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Joinable Game',
        });
      gameId = response.body.data.id;
    });

    it('should allow a player to join a game', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          playerName: 'Player Two Custom Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.playerName).toBe('Player Two Custom Name');
      expect(response.body.data.isHost).toBe(false);

      // Verify game state
      const dbGame = await testDb.game.findUnique({
        where: { id: gameId },
        include: { players: { where: { isActive: true } } },
      });
      expect(dbGame?.playerCount).toBe(2);
      expect(dbGame?.players).toHaveLength(2);
    });

    it('should use display name if playerName not provided', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.playerName).toBe('Player Two');
    });

    it('should reject joining same game twice', async () => {
      // First join
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      // Second join attempt
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should reject joining non-existent game', async () => {
      const response = await request(app)
        .post('/api/games/non-existent-id/join')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      expect(response.status).toBe(404);
    });

    it('should log player joined event', async () => {
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      const event = await testDb.gameEvent.findFirst({
        where: {
          gameId,
          eventType: 'PLAYER_JOINED',
        },
      });

      expect(event).not.toBeNull();
      expect(event?.userId).toBe(user2Id);
    });
  });

  describe('Game Starting', () => {
    let gameId: string;

    beforeEach(async () => {
      // Create game
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Start Test Game' });
      gameId = response.body.data.id;

      // User 2 joins
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});
    });

    it('should allow host to start game with 2+ players', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.currentPhase).toBe('PROPOSAL');
      expect(response.body.data.currentRound).not.toBeNull();
      expect(response.body.data.currentRound.roundNumber).toBe(1);

      // Verify database
      const dbGame = await testDb.game.findUnique({
        where: { id: gameId },
        include: { currentRound: true },
      });
      expect(dbGame?.status).toBe('ACTIVE');
      expect(dbGame?.startedAt).not.toBeNull();
    });

    it('should reject starting game with less than 2 players', async () => {
      // Create new game with only 1 player
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Solo Game' });

      const soloGameId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/games/${soloGameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject non-host starting game', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject starting already started game', async () => {
      // Start once
      await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      // Try to start again
      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(400);
    });

    it('should create first round when starting', async () => {
      await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      const rounds = await testDb.round.findMany({
        where: { gameId },
      });

      expect(rounds).toHaveLength(1);
      expect(rounds[0].roundNumber).toBe(1);
      expect(rounds[0].totalActionsRequired).toBe(2); // 2 players
      expect(rounds[0].actionsCompleted).toBe(0);
    });
  });

  describe('Game Retrieval', () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Retrieval Test Game',
          description: 'Test description',
        });
      gameId = response.body.data.id;
    });

    it('should retrieve game details', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: gameId,
        name: 'Retrieval Test Game',
        description: 'Test description',
        status: 'LOBBY',
      });
      expect(response.body.data.players).toBeDefined();
    });

    it('should allow non-member to view lobby game', async () => {
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
    });

    it('should reject viewing active game as non-member', async () => {
      // Add second player and start game
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      // Create third user
      const user3Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'player3@example.com',
          password: 'Password123!',
          displayName: 'Player Three',
        });

      // Try to view as non-member
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${user3Response.body.data.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('User Games List', () => {
    it('should list all games for a user', async () => {
      // Create multiple games
      await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Game 1' });

      await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Game 2' });

      const response = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should include joined games in user games list', async () => {
      // User 1 creates game
      const createResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Shared Game' });

      const gameId = createResponse.body.data.id;

      // User 2 joins
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      // User 2 should see the game
      const response = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(gameId);
    });
  });

  describe('Leaving Game', () => {
    let gameId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Leave Test Game' });
      gameId = response.body.data.id;

      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});
    });

    it('should allow player to leave game', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/leave`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);

      // Verify player is inactive
      const dbGame = await testDb.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });
      expect(dbGame?.playerCount).toBe(1);

      const player2 = dbGame?.players.find(p => p.userId === user2Id);
      expect(player2?.isActive).toBe(false);
    });

    it('should allow player to rejoin after leaving', async () => {
      // Leave
      await request(app)
        .post(`/api/games/${gameId}/leave`)
        .set('Authorization', `Bearer ${user2Token}`);

      // Rejoin
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ playerName: 'Rejoined Player' });

      expect(response.status).toBe(200);
      expect(response.body.data.playerName).toBe('Rejoined Player');
    });
  });
});
