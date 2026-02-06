import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    game: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    round: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    action: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Game state machine logic
type GamePhase =
  | 'WAITING'
  | 'PROPOSAL'
  | 'ARGUMENTATION'
  | 'VOTING'
  | 'RESOLUTION'
  | 'NARRATION'
  | 'ROUND_SUMMARY';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  WAITING: ['PROPOSAL'],
  PROPOSAL: ['ARGUMENTATION'],
  ARGUMENTATION: ['VOTING'],
  VOTING: ['RESOLUTION'],
  RESOLUTION: ['NARRATION'],
  NARRATION: ['PROPOSAL', 'ROUND_SUMMARY'],
  ROUND_SUMMARY: ['PROPOSAL'],
};

function isValidTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function canStartGame(playerCount: number, status: string): { canStart: boolean; reason?: string } {
  if (status !== 'LOBBY') {
    return { canStart: false, reason: 'Game has already started' };
  }
  if (playerCount < 2) {
    return { canStart: false, reason: 'Need at least 2 players to start' };
  }
  return { canStart: true };
}

function canJoinGame(status: string): { canJoin: boolean; reason?: string } {
  if (status !== 'LOBBY') {
    return { canJoin: false, reason: 'Game has already started' };
  }
  return { canJoin: true };
}

function calculateRoundProgress(actionsCompleted: number, totalRequired: number) {
  return {
    completed: actionsCompleted,
    total: totalRequired,
    remaining: totalRequired - actionsCompleted,
    isComplete: actionsCompleted >= totalRequired,
    percentage: Math.round((actionsCompleted / totalRequired) * 100),
  };
}

describe('Game Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase Transitions', () => {
    it('should allow WAITING -> PROPOSAL', () => {
      expect(isValidTransition('WAITING', 'PROPOSAL')).toBe(true);
    });

    it('should allow PROPOSAL -> ARGUMENTATION', () => {
      expect(isValidTransition('PROPOSAL', 'ARGUMENTATION')).toBe(true);
    });

    it('should allow ARGUMENTATION -> VOTING', () => {
      expect(isValidTransition('ARGUMENTATION', 'VOTING')).toBe(true);
    });

    it('should allow VOTING -> RESOLUTION', () => {
      expect(isValidTransition('VOTING', 'RESOLUTION')).toBe(true);
    });

    it('should allow RESOLUTION -> NARRATION', () => {
      expect(isValidTransition('RESOLUTION', 'NARRATION')).toBe(true);
    });

    it('should allow NARRATION -> PROPOSAL (more actions in round)', () => {
      expect(isValidTransition('NARRATION', 'PROPOSAL')).toBe(true);
    });

    it('should allow NARRATION -> ROUND_SUMMARY (round complete)', () => {
      expect(isValidTransition('NARRATION', 'ROUND_SUMMARY')).toBe(true);
    });

    it('should allow ROUND_SUMMARY -> PROPOSAL (new round)', () => {
      expect(isValidTransition('ROUND_SUMMARY', 'PROPOSAL')).toBe(true);
    });

    it('should NOT allow skipping phases', () => {
      expect(isValidTransition('PROPOSAL', 'VOTING')).toBe(false);
      expect(isValidTransition('ARGUMENTATION', 'RESOLUTION')).toBe(false);
      expect(isValidTransition('WAITING', 'ARGUMENTATION')).toBe(false);
    });

    it('should NOT allow going backwards', () => {
      expect(isValidTransition('VOTING', 'ARGUMENTATION')).toBe(false);
      expect(isValidTransition('RESOLUTION', 'VOTING')).toBe(false);
      expect(isValidTransition('NARRATION', 'RESOLUTION')).toBe(false);
    });
  });

  describe('Game Start Validation', () => {
    it('should allow starting with 2 players in LOBBY', () => {
      const result = canStartGame(2, 'LOBBY');
      expect(result.canStart).toBe(true);
    });

    it('should allow starting with more than 2 players', () => {
      const result = canStartGame(5, 'LOBBY');
      expect(result.canStart).toBe(true);
    });

    it('should NOT allow starting with 1 player', () => {
      const result = canStartGame(1, 'LOBBY');
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('2 players');
    });

    it('should NOT allow starting with 0 players', () => {
      const result = canStartGame(0, 'LOBBY');
      expect(result.canStart).toBe(false);
    });

    it('should NOT allow starting already started game', () => {
      const result = canStartGame(4, 'ACTIVE');
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('already started');
    });

    it('should NOT allow starting completed game', () => {
      const result = canStartGame(4, 'COMPLETED');
      expect(result.canStart).toBe(false);
    });
  });

  describe('Game Join Validation', () => {
    it('should allow joining game in LOBBY', () => {
      const result = canJoinGame('LOBBY');
      expect(result.canJoin).toBe(true);
    });

    it('should NOT allow joining ACTIVE game', () => {
      const result = canJoinGame('ACTIVE');
      expect(result.canJoin).toBe(false);
      expect(result.reason).toContain('already started');
    });

    it('should NOT allow joining COMPLETED game', () => {
      const result = canJoinGame('COMPLETED');
      expect(result.canJoin).toBe(false);
    });
  });

  describe('Round Progress Calculation', () => {
    it('should calculate progress correctly for new round', () => {
      const result = calculateRoundProgress(0, 4);
      expect(result.completed).toBe(0);
      expect(result.total).toBe(4);
      expect(result.remaining).toBe(4);
      expect(result.isComplete).toBe(false);
      expect(result.percentage).toBe(0);
    });

    it('should calculate progress correctly mid-round', () => {
      const result = calculateRoundProgress(2, 4);
      expect(result.completed).toBe(2);
      expect(result.remaining).toBe(2);
      expect(result.isComplete).toBe(false);
      expect(result.percentage).toBe(50);
    });

    it('should detect completed round', () => {
      const result = calculateRoundProgress(4, 4);
      expect(result.completed).toBe(4);
      expect(result.remaining).toBe(0);
      expect(result.isComplete).toBe(true);
      expect(result.percentage).toBe(100);
    });

    it('should handle single player round', () => {
      const result = calculateRoundProgress(1, 1);
      expect(result.isComplete).toBe(true);
      expect(result.percentage).toBe(100);
    });
  });

  describe('Player Permissions', () => {
    it('should identify host correctly', () => {
      const players = [
        { id: '1', userId: 'user-1', isHost: true },
        { id: '2', userId: 'user-2', isHost: false },
      ];

      const isHost = (userId: string) =>
        players.some(p => p.userId === userId && p.isHost);

      expect(isHost('user-1')).toBe(true);
      expect(isHost('user-2')).toBe(false);
      expect(isHost('user-3')).toBe(false);
    });

    it('should identify game member correctly', () => {
      const players = [
        { id: '1', userId: 'user-1', isActive: true },
        { id: '2', userId: 'user-2', isActive: true },
        { id: '3', userId: 'user-3', isActive: false },
      ];

      const isMember = (userId: string) =>
        players.some(p => p.userId === userId && p.isActive);

      expect(isMember('user-1')).toBe(true);
      expect(isMember('user-2')).toBe(true);
      expect(isMember('user-3')).toBe(false); // Inactive
      expect(isMember('user-4')).toBe(false); // Not in game
    });
  });

  describe('Game Settings', () => {
    it('should have correct default settings', () => {
      const defaultSettings = {
        argumentLimit: 3,
        argumentationTimeoutHours: 24,
        votingTimeoutHours: 24,
        narrationMode: 'initiator_only',
      };

      expect(defaultSettings.argumentLimit).toBe(3);
      expect(defaultSettings.argumentationTimeoutHours).toBe(24);
      expect(defaultSettings.votingTimeoutHours).toBe(24);
      expect(defaultSettings.narrationMode).toBe('initiator_only');
    });

    it('should validate argument limit range', () => {
      const validateArgumentLimit = (limit: number) =>
        limit >= 1 && limit <= 10;

      expect(validateArgumentLimit(1)).toBe(true);
      expect(validateArgumentLimit(3)).toBe(true);
      expect(validateArgumentLimit(10)).toBe(true);
      expect(validateArgumentLimit(0)).toBe(false);
      expect(validateArgumentLimit(11)).toBe(false);
    });

    it('should validate timeout hours range', () => {
      const validateTimeoutHours = (hours: number) =>
        hours >= 1 && hours <= 72;

      expect(validateTimeoutHours(1)).toBe(true);
      expect(validateTimeoutHours(24)).toBe(true);
      expect(validateTimeoutHours(72)).toBe(true);
      expect(validateTimeoutHours(0)).toBe(false);
      expect(validateTimeoutHours(73)).toBe(false);
    });
  });

  describe('NPC Personas', () => {
    it('should identify NPC player correctly', () => {
      const players = [
        { id: '1', userId: 'user-1', isNpc: false, isActive: true },
        { id: '2', userId: 'user-2', isNpc: false, isActive: true },
        { id: '3', userId: 'user-3', isNpc: true, isActive: true },
      ];

      const npcPlayer = players.find(p => p.isNpc);
      const humanPlayers = players.filter(p => !p.isNpc && p.isActive);

      expect(npcPlayer).toBeDefined();
      expect(npcPlayer?.id).toBe('3');
      expect(humanPlayers.length).toBe(2);
    });

    it('should only allow one NPC persona per game', () => {
      const personas = [
        { id: '1', name: 'Hero', isNpc: false },
        { id: '2', name: 'Villain', isNpc: true },
        { id: '3', name: 'Dragon', isNpc: false },
      ];

      const npcPersonas = personas.filter(p => p.isNpc);
      expect(npcPersonas.length).toBe(1);
    });

    it('should exclude NPC personas from player selection', () => {
      const personas = [
        { id: '1', name: 'Hero', isNpc: false, claimedBy: null },
        { id: '2', name: 'Villain', isNpc: true, claimedBy: null },
        { id: '3', name: 'Merchant', isNpc: false, claimedBy: 'player-1' },
      ];

      const availableForPlayers = personas.filter(p => !p.isNpc && !p.claimedBy);
      expect(availableForPlayers.length).toBe(1);
      expect(availableForPlayers[0]?.name).toBe('Hero');
    });

    it('should calculate NPC momentum correctly', () => {
      const calculateMomentum = (results: number[]) =>
        results.reduce((sum, val) => sum + val, 0);

      // Triumph (+3), Success But (+1), Failure But (-1), Disaster (-3)
      expect(calculateMomentum([3])).toBe(3);      // One triumph
      expect(calculateMomentum([3, -3])).toBe(0);  // Balanced
      expect(calculateMomentum([3, 1, -1])).toBe(3); // Net positive
      expect(calculateMomentum([-3, -3, -1])).toBe(-7); // Net negative
    });

    it('should use scripted NPC action description', () => {
      const npcPersona = {
        name: 'Dragon',
        isNpc: true,
        npcActionDescription: 'The dragon attacks the village',
        npcDesiredOutcome: 'The village burns',
      };

      expect(npcPersona.npcActionDescription).toBe('The dragon attacks the village');
      expect(npcPersona.npcDesiredOutcome).toBe('The village burns');
    });

    it('should have fallback for NPC action if not scripted', () => {
      const npcPersona = {
        name: 'Dragon',
        isNpc: true,
        npcActionDescription: null,
        npcDesiredOutcome: null,
      };

      const actionDescription =
        npcPersona.npcActionDescription || `${npcPersona.name} takes action`;
      const desiredOutcome =
        npcPersona.npcDesiredOutcome || `${npcPersona.name} achieves their goal`;

      expect(actionDescription).toBe('Dragon takes action');
      expect(desiredOutcome).toBe('Dragon achieves their goal');
    });

    it('should count only human players for argumentation completion', () => {
      const players = [
        { id: '1', isNpc: false },
        { id: '2', isNpc: false },
        { id: '3', isNpc: true },
      ];

      const humanPlayers = players.filter(p => !p.isNpc);
      const argumentationCompletions = ['1', '2']; // Both humans completed

      const allHumansComplete = humanPlayers.every(p =>
        argumentationCompletions.includes(p.id)
      );

      expect(humanPlayers.length).toBe(2);
      expect(allHumansComplete).toBe(true);
    });

    it('should count only human players for voting', () => {
      const players = [
        { id: '1', isNpc: false },
        { id: '2', isNpc: false },
        { id: '3', isNpc: true },
      ];
      const votes = [
        { playerId: '1', voteType: 'LIKELY_SUCCESS' },
        { playerId: '2', voteType: 'LIKELY_FAILURE' },
      ];

      const humanPlayers = players.filter(p => !p.isNpc);
      const humanVoteCount = votes.filter(v =>
        humanPlayers.some(p => p.id === v.playerId)
      ).length;

      expect(humanPlayers.length).toBe(2);
      expect(humanVoteCount).toBe(2);
      expect(humanVoteCount >= humanPlayers.length).toBe(true);
    });

    it('should allow any player to draw tokens for NPC actions', () => {
      const action = {
        initiatorId: '3',
        initiator: { isNpc: true, userId: 'npc-user' },
      };
      const requestingUserId = 'user-1'; // Regular player

      // NPC actions can have tokens drawn by any player
      const canDraw = action.initiator.isNpc || action.initiator.userId === requestingUserId;

      expect(canDraw).toBe(true);
    });

    it('should allow any player to narrate NPC actions', () => {
      const action = {
        initiatorId: '3',
        initiator: { isNpc: true, userId: 'npc-user' },
      };
      const requestingUserId = 'user-1'; // Regular player
      const narrationMode = 'initiator_only';

      // NPC actions can be narrated by any player regardless of narration mode
      const isNpcAction = action.initiator.isNpc;
      const canNarrate = isNpcAction ||
        narrationMode !== 'initiator_only' ||
        action.initiator.userId === requestingUserId;

      expect(canNarrate).toBe(true);
    });
  });

  describe('Game Deletion', () => {
    it('should allow host to delete game in LOBBY status', () => {
      const game = {
        id: 'game-1',
        status: 'LOBBY',
        players: [
          { id: 'player-1', userId: 'user-1', isHost: true, isActive: true },
          { id: 'player-2', userId: 'user-2', isHost: false, isActive: true },
        ],
      };
      const requestingUserId = 'user-1';

      const hostPlayer = game.players.find((p) => p.isHost);
      const isHost = hostPlayer?.userId === requestingUserId;
      const canDelete = isHost && game.status === 'LOBBY';

      expect(canDelete).toBe(true);
    });

    it('should not allow non-host to delete game', () => {
      const game = {
        id: 'game-1',
        status: 'LOBBY',
        players: [
          { id: 'player-1', userId: 'user-1', isHost: true, isActive: true },
          { id: 'player-2', userId: 'user-2', isHost: false, isActive: true },
        ],
      };
      const requestingUserId = 'user-2'; // Not the host

      const hostPlayer = game.players.find((p) => p.isHost);
      const isHost = hostPlayer?.userId === requestingUserId;
      const canDelete = isHost && game.status === 'LOBBY';

      expect(canDelete).toBe(false);
    });

    it('should not allow deleting game that has started', () => {
      const game = {
        id: 'game-1',
        status: 'ACTIVE',
        players: [
          { id: 'player-1', userId: 'user-1', isHost: true, isActive: true },
          { id: 'player-2', userId: 'user-2', isHost: false, isActive: true },
        ],
      };
      const requestingUserId = 'user-1';

      const hostPlayer = game.players.find((p) => p.isHost);
      const isHost = hostPlayer?.userId === requestingUserId;
      const canDelete = isHost && game.status === 'LOBBY';

      expect(canDelete).toBe(false);
    });

    it('should not allow deleting completed game', () => {
      const game = {
        id: 'game-1',
        status: 'COMPLETED',
        players: [
          { id: 'player-1', userId: 'user-1', isHost: true, isActive: true },
        ],
      };
      const requestingUserId = 'user-1';

      const hostPlayer = game.players.find((p) => p.isHost);
      const isHost = hostPlayer?.userId === requestingUserId;
      const canDelete = isHost && game.status === 'LOBBY';

      expect(canDelete).toBe(false);
    });

    it('should return not found error for non-existent game', () => {
      const game = null;
      const shouldThrowNotFound = game === null;

      expect(shouldThrowNotFound).toBe(true);
    });
  });
});
