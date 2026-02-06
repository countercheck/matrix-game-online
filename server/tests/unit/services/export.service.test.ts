import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parse } from 'yaml';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    game: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock notification service
vi.mock('../../../src/services/notification.service.js', () => ({
  notifyGameStarted: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../../../src/config/database.js';
import * as exportService from '../../../src/services/export.service.js';

const mockDb = db as unknown as {
  game: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  gamePlayer: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  gameEvent: { create: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

// Full game fixture for export tests
function buildGameFixture() {
  return {
    id: 'game-1',
    name: 'The Fall of Empires',
    description: 'A story of political intrigue',
    imageUrl: null,
    creatorId: 'user-1',
    status: 'ACTIVE',
    currentPhase: 'PROPOSAL',
    currentRoundId: 'round-1',
    currentActionId: null,
    playerCount: 2,
    settings: {
      argumentLimit: 3,
      argumentationTimeoutHours: 24,
      votingTimeoutHours: 24,
      narrationMode: 'initiator_only',
      personasRequired: false,
    },
    npcMomentum: -2,
    createdAt: new Date('2025-01-10T10:00:00.000Z'),
    updatedAt: new Date('2025-01-12T10:00:00.000Z'),
    startedAt: new Date('2025-01-10T12:00:00.000Z'),
    completedAt: null,
    deletedAt: null,
    personas: [
      {
        id: 'persona-1',
        name: 'The Chancellor',
        description: 'A cunning political operator',
        isNpc: false,
        npcActionDescription: null,
        npcDesiredOutcome: null,
        sortOrder: 0,
        claimedBy: { playerName: 'Alice' },
      },
      {
        id: 'persona-2',
        name: 'The Shadow',
        description: 'A mysterious force',
        isNpc: true,
        npcActionDescription: 'Undermines the ruling class',
        npcDesiredOutcome: 'Chaos reigns',
        sortOrder: 1,
        claimedBy: null,
      },
    ],
    players: [
      {
        id: 'player-1',
        playerName: 'Alice',
        isHost: true,
        isNpc: false,
        isActive: true,
        joinOrder: 1,
        userId: 'user-1',
        user: { displayName: 'alice123' },
        persona: { name: 'The Chancellor' },
      },
      {
        id: 'player-2',
        playerName: 'Bob',
        isHost: false,
        isNpc: false,
        isActive: true,
        joinOrder: 2,
        userId: 'user-2',
        user: { displayName: 'bob456' },
        persona: null,
      },
    ],
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        status: 'COMPLETED',
        startedAt: new Date('2025-01-10T12:00:00.000Z'),
        completedAt: new Date('2025-01-11T12:00:00.000Z'),
        actions: [
          {
            id: 'action-1',
            sequenceNumber: 1,
            actionDescription: 'Forge an alliance with the northern lords',
            desiredOutcome: 'The northern lords pledge loyalty',
            status: 'NARRATED',
            argumentationWasSkipped: false,
            votingWasSkipped: false,
            proposedAt: new Date('2025-01-10T13:00:00.000Z'),
            initiator: { playerName: 'Alice' },
            arguments: [
              {
                id: 'arg-1',
                argumentType: 'INITIATOR_FOR',
                content: 'The northern lords have long awaited this',
                sequence: 1,
                player: { playerName: 'Alice' },
              },
              {
                id: 'arg-2',
                argumentType: 'AGAINST',
                content: 'The alliance is doomed because of old feuds',
                sequence: 2,
                player: { playerName: 'Bob' },
              },
            ],
            votes: [
              {
                id: 'vote-1',
                voteType: 'LIKELY_FAILURE',
                successTokens: 0,
                failureTokens: 2,
                wasSkipped: false,
                player: { playerName: 'Bob' },
              },
            ],
            tokenDraw: {
              id: 'draw-1',
              totalSuccessTokens: 1,
              totalFailureTokens: 3,
              drawnSuccess: 1,
              drawnFailure: 2,
              resultValue: -1,
              resultType: 'FAILURE_BUT',
              drawnTokens: [
                { id: 'dt-1', drawSequence: 1, tokenType: 'FAILURE' },
                { id: 'dt-2', drawSequence: 2, tokenType: 'SUCCESS' },
                { id: 'dt-3', drawSequence: 3, tokenType: 'FAILURE' },
              ],
            },
            narration: {
              id: 'narr-1',
              content: 'The northern lords listened, but ultimately refused.',
              author: { playerName: 'Alice' },
            },
          },
        ],
        summary: {
          id: 'summary-1',
          content: 'Round 1 saw the beginning of diplomacy.',
          outcomes: { netMomentum: -1, keyEvents: ['Alliance attempt failed'] },
          author: { playerName: 'Alice' },
        },
      },
    ],
  };
}

describe('exportGameState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export game state as valid YAML', async () => {
    const gameFixture = buildGameFixture();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    const result = await exportService.exportGameState('game-1', 'user-1');

    expect(result.yaml).toBeTruthy();
    expect(result.filename).toMatch(/^the-fall-of-empires-export-\d{4}-\d{2}-\d{2}\.yaml$/);

    // Parse the YAML back and verify structure
    const parsed = parse(result.yaml);
    expect(parsed.exported_at).toBeTruthy();
    expect(parsed.game.name).toBe('The Fall of Empires');
    expect(parsed.game.status).toBe('ACTIVE');
    expect(parsed.game.npc_momentum).toBe(-2);
  });

  it('should include personas with correct structure', async () => {
    const gameFixture = buildGameFixture();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    const { yaml } = await exportService.exportGameState('game-1', 'user-1');
    const parsed = parse(yaml);

    expect(parsed.personas).toHaveLength(2);
    expect(parsed.personas[0].name).toBe('The Chancellor');
    expect(parsed.personas[0].is_npc).toBe(false);
    expect(parsed.personas[0].claimed_by).toBe('Alice');
    expect(parsed.personas[1].name).toBe('The Shadow');
    expect(parsed.personas[1].is_npc).toBe(true);
    expect(parsed.personas[1].npc_action_description).toBe('Undermines the ruling class');
  });

  it('should include players without sensitive data', async () => {
    const gameFixture = buildGameFixture();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    const { yaml } = await exportService.exportGameState('game-1', 'user-1');
    const parsed = parse(yaml);

    expect(parsed.players).toHaveLength(2);
    expect(parsed.players[0].player_name).toBe('Alice');
    expect(parsed.players[0].display_name).toBe('alice123');
    expect(parsed.players[0].is_host).toBe(true);

    // No IDs, emails, or passwords in the output
    const yamlStr = yaml;
    expect(yamlStr).not.toContain('user-1');
    expect(yamlStr).not.toContain('user-2');
    expect(yamlStr).not.toContain('player-1');
    expect(yamlStr).not.toContain('player-2');
    expect(yamlStr).not.toContain('game-1');
    expect(yamlStr).not.toContain('password');
    expect(yamlStr).not.toContain('email');
  });

  it('should include rounds with actions in correct order', async () => {
    const gameFixture = buildGameFixture();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    const { yaml } = await exportService.exportGameState('game-1', 'user-1');
    const parsed = parse(yaml);

    expect(parsed.rounds).toHaveLength(1);
    expect(parsed.rounds[0].round_number).toBe(1);
    expect(parsed.rounds[0].status).toBe('COMPLETED');
    expect(parsed.rounds[0].actions).toHaveLength(1);

    const action = parsed.rounds[0].actions[0];
    expect(action.sequence).toBe(1);
    expect(action.initiator).toBe('Alice');
    expect(action.description).toBe('Forge an alliance with the northern lords');
    expect(action.arguments).toHaveLength(2);
    expect(action.votes).toHaveLength(1);
    expect(action.token_draw.pool).toEqual({ success: 1, failure: 3 });
    expect(action.token_draw.drawn).toEqual(['FAILURE', 'SUCCESS', 'FAILURE']);
    expect(action.token_draw.result).toBe('FAILURE_BUT');
    expect(action.narration.author).toBe('Alice');
  });

  it('should include round summary', async () => {
    const gameFixture = buildGameFixture();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    const { yaml } = await exportService.exportGameState('game-1', 'user-1');
    const parsed = parse(yaml);

    expect(parsed.rounds[0].summary.author).toBe('Alice');
    expect(parsed.rounds[0].summary.content).toBe('Round 1 saw the beginning of diplomacy.');
    expect(parsed.rounds[0].summary.outcomes.netMomentum).toBe(-1);
  });

  it('should reject non-members', async () => {
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);

    await expect(
      exportService.exportGameState('game-1', 'outsider')
    ).rejects.toThrow();
  });

  it('should reject deleted games', async () => {
    const gameFixture = buildGameFixture();
    gameFixture.deletedAt = new Date();
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', userId: 'user-1' });
    mockDb.game.findUnique.mockResolvedValue(gameFixture);

    await expect(
      exportService.exportGameState('game-1', 'user-1')
    ).rejects.toThrow('Game not found');
  });
});

describe('importGameFromYaml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a game from valid YAML with (Copy) suffix', async () => {
    const yamlContent = `
game:
  name: "The Fall of Empires"
  description: "A story of political intrigue"
  settings:
    argument_limit: 3
    argumentation_timeout_hours: 24
    voting_timeout_hours: 24
    narration_mode: initiator_only
    personas_required: false
personas:
  - name: "The Chancellor"
    description: "A cunning political operator"
    is_npc: false
  - name: "The Shadow"
    description: "A mysterious force"
    is_npc: true
    npc_action_description: "Undermines the ruling class"
    npc_desired_outcome: "Chaos reigns"
rounds:
  - round_number: 1
    status: COMPLETED
    actions:
      - sequence: 1
        initiator: "Alice"
`;

    const mockUser = { id: 'user-1', displayName: 'Importer' };
    mockDb.user.findUnique.mockResolvedValue(mockUser);
    mockDb.game.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: 'new-game-id',
        ...data,
        status: 'LOBBY',
        currentPhase: 'WAITING',
        players: [{ id: 'p-1', playerName: 'Importer', isHost: true }],
        personas: [],
      });
    });
    mockDb.gameEvent.create.mockResolvedValue({});

    const result = await exportService.importGameFromYaml(yamlContent, 'user-1');

    expect(result.id).toBe('new-game-id');
    // Verify createGame was called with correct data
    expect(mockDb.game.create).toHaveBeenCalledOnce();
    const createCall = mockDb.game.create.mock.calls[0][0];
    expect(createCall.data.name).toBe('The Fall of Empires (Copy)');
    expect(createCall.data.description).toBe('A story of political intrigue');
  });

  it('should ignore historical data (rounds, actions, etc.)', async () => {
    const yamlContent = `
game:
  name: "Test Game"
  settings:
    argument_limit: 5
personas: []
rounds:
  - round_number: 1
    status: COMPLETED
    actions:
      - sequence: 1
        initiator: "Alice"
        description: "This should be ignored"
`;

    const mockUser = { id: 'user-1', displayName: 'Importer' };
    mockDb.user.findUnique.mockResolvedValue(mockUser);
    mockDb.game.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: 'new-game-id',
        ...data,
        status: 'LOBBY',
        currentPhase: 'WAITING',
        players: [],
        personas: [],
      });
    });
    mockDb.gameEvent.create.mockResolvedValue({});

    await exportService.importGameFromYaml(yamlContent, 'user-1');

    // The create call should not contain any round/action data
    const createCall = mockDb.game.create.mock.calls[0][0];
    expect(createCall.data.rounds).toBeUndefined();
    expect(createCall.data.actions).toBeUndefined();
  });

  it('should import personas correctly', async () => {
    const yamlContent = `
game:
  name: "Persona Test"
personas:
  - name: "Hero"
    description: "The brave one"
    is_npc: false
  - name: "Villain"
    description: "The bad one"
    is_npc: true
    npc_action_description: "Does evil things"
    npc_desired_outcome: "World domination"
`;

    const mockUser = { id: 'user-1', displayName: 'Importer' };
    mockDb.user.findUnique.mockResolvedValue(mockUser);
    mockDb.game.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: 'new-game-id',
        ...data,
        status: 'LOBBY',
        currentPhase: 'WAITING',
        players: [],
        personas: [],
      });
    });
    mockDb.gameEvent.create.mockResolvedValue({});

    await exportService.importGameFromYaml(yamlContent, 'user-1');

    const createCall = mockDb.game.create.mock.calls[0][0];
    const personas = createCall.data.personas.create;
    expect(personas).toHaveLength(2);
    expect(personas[0].name).toBe('Hero');
    expect(personas[0].isNpc).toBe(false);
    expect(personas[1].name).toBe('Villain');
    expect(personas[1].isNpc).toBe(true);
    expect(personas[1].npcActionDescription).toBe('Does evil things');
  });

  it('should reject invalid YAML', async () => {
    await expect(
      exportService.importGameFromYaml('{{{{ not yaml', 'user-1')
    ).rejects.toThrow('Invalid YAML');
  });

  it('should reject YAML missing game section', async () => {
    await expect(
      exportService.importGameFromYaml('personas: []', 'user-1')
    ).rejects.toThrow('missing "game" section');
  });

  it('should use fallback name when game name is empty', async () => {
    const yamlContent = `
game:
  name: ""
personas: []
`;
    const mockUser = { id: 'user-1', displayName: 'Importer' };
    mockDb.user.findUnique.mockResolvedValue(mockUser);
    mockDb.game.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: 'new-game-id',
        ...data,
        status: 'LOBBY',
        currentPhase: 'WAITING',
        players: [],
        personas: [],
      });
    });
    mockDb.gameEvent.create.mockResolvedValue({});

    await exportService.importGameFromYaml(yamlContent, 'user-1');

    const createCall = mockDb.game.create.mock.calls[0][0];
    expect(createCall.data.name).toBe('Imported Game (Copy)');
  });
});
