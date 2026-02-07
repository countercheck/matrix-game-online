import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app.js';
import { testDb } from './setup.js';

const app = createTestApp();

describe('Complete Game Flow E2E Tests', () => {
  describe('Full Game Lifecycle', () => {
    it('should complete full game setup flow: register -> create -> invite -> join -> start', async () => {
      // Step 1: Register host user
      const hostResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@example.com',
          password: 'HostPassword123!',
          displayName: 'Game Host',
        });

      expect(hostResponse.status).toBe(201);
      const hostToken = hostResponse.body.data.token;

      // Step 2: Register player users
      const player1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'player1@example.com',
          password: 'Player1Pass123!',
          displayName: 'Player Alpha',
        });

      expect(player1Response.status).toBe(201);
      const player1Token = player1Response.body.data.token;

      const player2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'player2@example.com',
          password: 'Player2Pass123!',
          displayName: 'Player Beta',
        });

      expect(player2Response.status).toBe(201);
      const player2Token = player2Response.body.data.token;

      // Step 3: Host creates a game
      const createGameResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: 'Epic Adventure',
          description: 'A thrilling game of strategy and storytelling',
        });

      expect(createGameResponse.status).toBe(201);
      expect(createGameResponse.body.data.status).toBe('LOBBY');
      const gameId = createGameResponse.body.data.id;

      // Verify host is automatically added as player
      expect(createGameResponse.body.data.players).toHaveLength(1);
      expect(createGameResponse.body.data.players[0].isHost).toBe(true);
      expect(createGameResponse.body.data.players[0].playerName).toBe('Game Host');

      // Step 4: Players join the game
      const join1Response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ playerName: 'Alpha the Warrior' });

      expect(join1Response.status).toBe(200);
      expect(join1Response.body.data.playerName).toBe('Alpha the Warrior');

      const join2Response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ playerName: 'Beta the Mage' });

      expect(join2Response.status).toBe(200);
      expect(join2Response.body.data.playerName).toBe('Beta the Mage');

      // Step 5: Verify game state shows all players
      const getGameResponse = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(getGameResponse.status).toBe(200);
      expect(getGameResponse.body.data.playerCount).toBe(3);
      expect(getGameResponse.body.data.players).toHaveLength(3);

      // Step 6: Host starts the game
      const startResponse = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.data.status).toBe('ACTIVE');
      expect(startResponse.body.data.currentPhase).toBe('PROPOSAL');
      expect(startResponse.body.data.currentRound).not.toBeNull();
      expect(startResponse.body.data.currentRound.roundNumber).toBe(1);
      expect(startResponse.body.data.currentRound.totalActionsRequired).toBe(3);

      // Step 7: Verify game appears in each player's game list
      const hostGamesResponse = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(hostGamesResponse.body.data).toContainEqual(
        expect.objectContaining({
          id: gameId,
          name: 'Epic Adventure',
          status: 'ACTIVE',
          isHost: true,
        })
      );

      const player1GamesResponse = await request(app)
        .get('/api/users/me/games')
        .set('Authorization', `Bearer ${player1Token}`);

      expect(player1GamesResponse.body.data).toContainEqual(
        expect.objectContaining({
          id: gameId,
          playerName: 'Alpha the Warrior',
          isHost: false,
        })
      );

      // Step 8: Verify game events were logged
      const events = await testDb.gameEvent.findMany({
        where: { gameId },
        orderBy: { createdAt: 'asc' },
      });

      expect(events.length).toBeGreaterThanOrEqual(4);
      expect(events.map(e => e.eventType)).toContain('GAME_CREATED');
      expect(events.map(e => e.eventType)).toContain('PLAYER_JOINED');
      expect(events.map(e => e.eventType)).toContain('GAME_STARTED');
      expect(events.map(e => e.eventType)).toContain('ROUND_STARTED');
    });

    it('should handle concurrent join attempts gracefully', async () => {
      // Setup users
      const hostResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@test.com',
          password: 'Password123!',
          displayName: 'Host',
        });
      const hostToken = hostResponse.body.data.token;

      const playerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'player@test.com',
          password: 'Password123!',
          displayName: 'Player',
        });
      const playerToken = playerResponse.body.data.token;

      // Create game
      const gameResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Concurrent Test Game' });

      const gameId = gameResponse.body.data.id;

      // Simulate concurrent join attempts
      const joinPromises = [
        request(app)
          .post(`/api/games/${gameId}/join`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send({ playerName: 'Player 1' }),
        request(app)
          .post(`/api/games/${gameId}/join`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send({ playerName: 'Player 2' }),
      ];

      const results = await Promise.all(joinPromises);

      // One should succeed, one should fail with conflict
      const successCount = results.filter(r => r.status === 200).length;
      const conflictCount = results.filter(r => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
    });

    it('should prevent starting a game that is already in progress', async () => {
      // Setup
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@test.com',
          password: 'Password123!',
          displayName: 'User 1',
        });
      const user1Token = user1Response.body.data.token;

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@test.com',
          password: 'Password123!',
          displayName: 'User 2',
        });
      const user2Token = user2Response.body.data.token;

      // Create and start game
      const gameResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Double Start Test' });

      const gameId = gameResponse.body.data.id;

      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      // Try to start again
      const secondStartResponse = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(secondStartResponse.status).toBe(400);
    });

    it('should track game state correctly after player leaves and rejoins', async () => {
      // Setup
      const hostResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@leave.com',
          password: 'Password123!',
          displayName: 'Host',
        });
      const hostToken = hostResponse.body.data.token;

      const playerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'player@leave.com',
          password: 'Password123!',
          displayName: 'Player',
        });
      const playerToken = playerResponse.body.data.token;

      // Create game
      const gameResponse = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Leave/Rejoin Test' });

      const gameId = gameResponse.body.data.id;

      // Player joins
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ playerName: 'Original Name' });

      // Verify 2 players
      let gameState = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(gameState.body.data.playerCount).toBe(2);

      // Player leaves
      await request(app)
        .post(`/api/games/${gameId}/leave`)
        .set('Authorization', `Bearer ${playerToken}`);

      // Verify 1 player
      gameState = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(gameState.body.data.playerCount).toBe(1);

      // Player rejoins with new name
      await request(app)
        .post(`/api/games/${gameId}/join`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ playerName: 'Rejoined Name' });

      // Verify 2 players again with new name
      gameState = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(gameState.body.data.playerCount).toBe(2);

      const player = gameState.body.data.players.find(
        (p: { playerName: string }) => p.playerName === 'Rejoined Name'
      );
      expect(player).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for invalid game ID format', async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'error@test.com',
          password: 'Password123!',
          displayName: 'Error Tester',
        });

      const response = await request(app)
        .get('/api/games/invalid-uuid-format')
        .set('Authorization', `Bearer ${userResponse.body.data.token}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({ name: 'Unauthorized Game' });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent game', async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@notfound.com',
          password: 'Password123!',
          displayName: 'Tester',
        });

      const response = await request(app)
        .get('/api/games/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userResponse.body.data.token}`);

      expect(response.status).toBe(404);
    });
  });
});
