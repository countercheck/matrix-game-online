import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError, ConflictError } from '../../../src/middleware/errorHandler.js';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    game: {
      findUnique: vi.fn(),
    },
    gamePlayer: {
      update: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';
import { selectPersona } from '../../../src/services/game.service.js';

function mockPlayer(overrides: {
  id: string;
  userId: string;
  playerName: string;
  personaId?: string | null;
  isPersonaLead?: boolean;
  isActive?: boolean;
  isNpc?: boolean;
}) {
  return {
    id: overrides.id,
    userId: overrides.userId,
    playerName: overrides.playerName,
    personaId: overrides.personaId ?? null,
    isPersonaLead: overrides.isPersonaLead ?? false,
    isActive: overrides.isActive ?? true,
    isNpc: overrides.isNpc ?? false,
  };
}

describe('Persona Swapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectPersona', () => {
    it('should allow player to swap from one persona to another directly', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const persona1Id = 'persona-1';
      const persona2Id = 'persona-2';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player', personaId: persona1Id, isPersonaLead: true }),
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: playerId, playerName: 'Test Player' }],
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: [],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        userId: userId,
        playerName: 'Test Player',
        personaId: persona2Id,
        persona: { id: persona2Id, name: 'Mage' },
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await selectPersona(gameId, userId, persona2Id);

      expect(result.personaId).toBe(persona2Id);
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: persona2Id, isPersonaLead: true },
        include: { persona: true },
      });
    });

    it('should allow player to re-select their current persona (idempotent)', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const personaId = 'persona-1';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player', personaId, isPersonaLead: true }),
        ],
        personas: [
          {
            id: personaId,
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: playerId, playerName: 'Test Player' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        personaId: personaId,
        persona: { id: personaId, name: 'Warrior' },
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      await selectPersona(gameId, userId, personaId);

      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: personaId, isPersonaLead: true },
        include: { persona: true },
      });
    });

    it('should allow player to clear persona selection', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const personaId = 'persona-1';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player', personaId, isPersonaLead: true }),
        ],
        personas: [
          {
            id: personaId,
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: playerId, playerName: 'Test Player' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        personaId: null,
        persona: null,
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await selectPersona(gameId, userId, null);

      expect(result.personaId).toBeNull();
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: null, isPersonaLead: false },
        include: { persona: true },
      });
    });

    it('should prevent swapping to already claimed persona', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const otherPlayerId = 'player-999';
      const persona1Id = 'persona-1';
      const persona2Id = 'persona-2';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player', personaId: persona1Id }),
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: playerId, playerName: 'Test Player' }],
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: [{ id: otherPlayerId, playerName: 'Other Player' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      const swapPromise = selectPersona(gameId, userId, persona2Id);
      await expect(swapPromise).rejects.toThrow(ConflictError);
      await expect(swapPromise).rejects.toThrow('This persona has already been claimed');
    });

    it('should prevent persona swapping after game has started', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const persona1Id = 'persona-1';
      const persona2Id = 'persona-2';

      const mockGame = {
        id: gameId,
        status: 'ACTIVE',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player', personaId: persona1Id }),
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: playerId, playerName: 'Test Player' }],
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: [],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      const swapPromise = selectPersona(gameId, userId, persona2Id);
      await expect(swapPromise).rejects.toThrow(BadRequestError);
      await expect(swapPromise).rejects.toThrow('Cannot change persona after game has started');
    });

    it('should prevent selecting NPC persona', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const npcPersonaId = 'persona-npc';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        settings: {},
        players: [
          mockPlayer({ id: playerId, userId, playerName: 'Test Player' }),
        ],
        personas: [
          {
            id: npcPersonaId,
            name: 'Dragon',
            isNpc: true,
            claimedBy: [],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      const selectPromise = selectPersona(gameId, userId, npcPersonaId);
      await expect(selectPromise).rejects.toThrow(BadRequestError);
      await expect(selectPromise).rejects.toThrow('Cannot select an NPC persona');
    });
  });
});
