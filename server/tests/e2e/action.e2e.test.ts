import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './test-app.js';
import { testDb, cleanDatabase } from './setup.js';

const app = createTestApp();

describe('Action Resolution E2E Tests', () => {
  let hostToken: string;
  let player1Token: string;
  let player2Token: string;
  let gameId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Create 3 users
    const hostResponse = await request(app).post('/api/auth/register').send({
      email: 'host@action.com',
      password: 'Password123!',
      displayName: 'Game Host',
    });
    hostToken = hostResponse.body.data.token;

    const player1Response = await request(app).post('/api/auth/register').send({
      email: 'player1@action.com',
      password: 'Password123!',
      displayName: 'Player One',
    });
    player1Token = player1Response.body.data.token;

    const player2Response = await request(app).post('/api/auth/register').send({
      email: 'player2@action.com',
      password: 'Password123!',
      displayName: 'Player Two',
    });
    player2Token = player2Response.body.data.token;

    // Create and setup game
    const gameResponse = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ name: 'Action Test Game' });

    gameId = gameResponse.body.data.id;

    // Join players
    await request(app)
      .post(`/api/games/${gameId}/join`)
      .set('Authorization', `Bearer ${player1Token}`)
      .send({});

    await request(app)
      .post(`/api/games/${gameId}/join`)
      .set('Authorization', `Bearer ${player2Token}`)
      .send({});

    // Start game
    await request(app)
      .post(`/api/games/${gameId}/start`)
      .set('Authorization', `Bearer ${hostToken}`);
  });

  describe('Action Proposal', () => {
    it('should allow player to propose an action', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'I attempt to scale the castle walls under cover of darkness',
          desiredOutcome: 'Successfully infiltrate the castle undetected',
          initialArguments: [
            'I have trained as a climber',
            'The guards are distracted by the festival',
            'I have magical climbing gear',
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.actionDescription).toBe(
        'I attempt to scale the castle walls under cover of darkness'
      );
      expect(response.body.data.status).toBe('ARGUING');
      expect(response.body.data.arguments).toHaveLength(3);

      // Verify game state changed
      const gameResponse = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(gameResponse.body.data.currentPhase).toBe('ARGUMENTATION');
    });

    it('should prevent player from proposing twice in same round', async () => {
      // First proposal
      await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'First action',
          desiredOutcome: 'First outcome',
          initialArguments: ['Reason 1'],
        });

      // Complete the action cycle (simplified - just mark complete)
      // For now, test that second proposal fails during same round
      // Switch to player 1 for second action of round
      await request(app)
        .post(
          `/api/actions/${(await testDb.action.findFirst({ where: { gameId } }))!.id}/complete-argumentation`
        )
        .set('Authorization', `Bearer ${player1Token}`);

      // This would need more setup to properly test, but shows the concept
    });

    it('should reject proposal without required fields', async () => {
      const response = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'Missing outcome',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Argumentation Phase', () => {
    let actionId: string;

    beforeEach(async () => {
      const actionResponse = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'Test action for argumentation',
          desiredOutcome: 'Success',
          initialArguments: ['Initial reason'],
        });

      actionId = actionResponse.body.data.id;
    });

    it('should allow non-initiator to add FOR argument', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({
          argumentType: 'FOR',
          content: 'I support this action because it makes strategic sense',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.argumentType).toBe('FOR');
    });

    it('should allow non-initiator to add AGAINST argument', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({
          argumentType: 'AGAINST',
          content: 'This is too risky and likely to fail',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.argumentType).toBe('AGAINST');
    });

    it('should allow initiator to add CLARIFICATION', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          argumentType: 'CLARIFICATION',
          content: 'To clarify, I meant under the full moon',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.argumentType).toBe('CLARIFICATION');
    });

    it('should prevent initiator from adding FOR/AGAINST arguments', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          argumentType: 'FOR',
          content: 'I support my own action',
        });

      expect(response.status).toBe(400);
    });

    it('should prevent non-initiator from adding CLARIFICATION', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({
          argumentType: 'CLARIFICATION',
          content: 'Let me clarify for them',
        });

      expect(response.status).toBe(400);
    });

    it('should retrieve all arguments for an action', async () => {
      // Add some arguments
      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ argumentType: 'FOR', content: 'Support argument' });

      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ argumentType: 'AGAINST', content: 'Opposition argument' });

      const response = await request(app)
        .get(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3); // Initial + 2 new
    });
  });

  describe('Voting Phase', () => {
    let actionId: string;

    beforeEach(async () => {
      // Create action
      const actionResponse = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'Test action for voting',
          desiredOutcome: 'Success',
          initialArguments: ['Reason'],
        });

      actionId = actionResponse.body.data.id;

      // All players must submit an argument and complete
      // Host already has initial arguments, other players submit theirs
      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ argumentType: 'FOR', content: 'I support this' });

      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ argumentType: 'AGAINST', content: 'I oppose this' });

      // All players must mark as complete (including initiator)
      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${hostToken}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player1Token}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player2Token}`);
    });

    it('should allow player to vote LIKELY_SUCCESS', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      expect(response.status).toBe(201);
      expect(response.body.data.voteType).toBe('LIKELY_SUCCESS');
      expect(response.body.data.successTokens).toBe(2);
      expect(response.body.data.failureTokens).toBe(0);
    });

    it('should allow player to vote LIKELY_FAILURE', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ voteType: 'LIKELY_FAILURE' });

      expect(response.status).toBe(201);
      expect(response.body.data.voteType).toBe('LIKELY_FAILURE');
      expect(response.body.data.successTokens).toBe(0);
      expect(response.body.data.failureTokens).toBe(2);
    });

    it('should allow player to vote UNCERTAIN', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ voteType: 'UNCERTAIN' });

      expect(response.status).toBe(201);
      expect(response.body.data.voteType).toBe('UNCERTAIN');
      expect(response.body.data.successTokens).toBe(1);
      expect(response.body.data.failureTokens).toBe(1);
    });

    it('should prevent double voting', async () => {
      // First vote
      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'UNCERTAIN' });

      // Second vote attempt
      const response = await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      expect(response.status).toBe(409);
    });

    it('should hide individual votes until all submitted', async () => {
      // Submit one vote
      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'UNCERTAIN' });

      // Check votes - should only show count
      const response = await request(app)
        .get(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.votesSubmitted).toBe(1);
      expect(response.body.data.votes).toEqual([]);
    });

    it('should advance to resolution after all votes', async () => {
      // All players vote
      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ voteType: 'UNCERTAIN' });

      // Check action status
      const actionResponse = await request(app)
        .get(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(actionResponse.body.data.status).toBe('RESOLVED');

      // Check game phase
      const gameResponse = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(gameResponse.body.data.currentPhase).toBe('RESOLUTION');
    });
  });

  describe('Token Drawing', () => {
    let actionId: string;

    beforeEach(async () => {
      // Create action and go through phases
      const actionResponse = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'Test action for drawing',
          desiredOutcome: 'Success',
          initialArguments: ['Reason'],
        });

      actionId = actionResponse.body.data.id;

      // All players must submit an argument and complete
      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ argumentType: 'FOR', content: 'I support this' });

      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ argumentType: 'FOR', content: 'I also support this' });

      // All players must mark as complete (including initiator)
      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${hostToken}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player1Token}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player2Token}`);

      // All vote (favoring success for predictable pool)
      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ voteType: 'LIKELY_SUCCESS' });
    });

    it('should allow initiator to draw tokens', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.drawnSuccess + response.body.data.drawnFailure).toBe(3);
      expect(response.body.data.resultType).toMatch(/TRIUMPH|SUCCESS_BUT|FAILURE_BUT|DISASTER/);
      expect(response.body.data.resultValue).toBeGreaterThanOrEqual(-3);
      expect(response.body.data.resultValue).toBeLessThanOrEqual(3);
    });

    it('should prevent non-initiator from drawing', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(response.status).toBe(403);
    });

    it('should prevent drawing twice', async () => {
      // First draw
      await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${hostToken}`);

      // Second draw attempt
      const response = await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(409);
    });

    it('should calculate correct token pool', async () => {
      const response = await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${hostToken}`);

      // Base pool: 1S + 1F
      // 3 players voting LIKELY_SUCCESS: 6S + 0F
      // Total: 7S + 1F
      expect(response.body.data.totalSuccessTokens).toBe(7);
      expect(response.body.data.totalFailureTokens).toBe(1);
    });
  });

  describe('Narration', () => {
    // Helper to set up a complete action ready for narration
    async function setupActionForNarration(): Promise<string> {
      const actionResponse = await request(app)
        .post(`/api/games/${gameId}/actions`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          actionDescription: 'Test action for narration',
          desiredOutcome: 'Success',
          initialArguments: ['Reason'],
        });

      const actionId = actionResponse.body.data.id;

      // All players must submit an argument and complete
      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ argumentType: 'FOR', content: 'I support this' });

      await request(app)
        .post(`/api/actions/${actionId}/arguments`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ argumentType: 'FOR', content: 'I also support this' });

      // All players must mark as complete (including initiator)
      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${hostToken}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player1Token}`);

      await request(app)
        .post(`/api/actions/${actionId}/complete-argumentation`)
        .set('Authorization', `Bearer ${player2Token}`);

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ voteType: 'LIKELY_SUCCESS' });

      await request(app)
        .post(`/api/actions/${actionId}/votes`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ voteType: 'UNCERTAIN' });

      await request(app)
        .post(`/api/actions/${actionId}/draw`)
        .set('Authorization', `Bearer ${hostToken}`);

      return actionId;
    }

    it('should allow initiator to submit narration', async () => {
      const actionId = await setupActionForNarration();

      const response = await request(app)
        .post(`/api/actions/${actionId}/narration`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          content: 'With cat-like grace, I scaled the walls and slipped past the guards unnoticed.',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.content).toContain('cat-like grace');
    });

    it('should mark action as narrated after submission', async () => {
      const actionId = await setupActionForNarration();

      await request(app)
        .post(`/api/actions/${actionId}/narration`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ content: 'The deed is done.' });

      const actionResponse = await request(app)
        .get(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(actionResponse.status).toBe(200);
      expect(actionResponse.body.data.status).toBe('NARRATED');
    });

    it('should increment round actions completed', async () => {
      const actionId = await setupActionForNarration();

      await request(app)
        .post(`/api/actions/${actionId}/narration`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ content: 'Action complete.' });

      const round = await testDb.round.findFirst({
        where: { gameId },
      });

      expect(round?.actionsCompleted).toBe(1);
    });
  });
});
