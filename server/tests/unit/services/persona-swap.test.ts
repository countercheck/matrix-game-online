import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../../../src/middleware/errorHandler.js';

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

      // Mock game with two personas and a player who has selected persona1
      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: persona1Id,
          },
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: { id: playerId, playerName: 'Test Player' },
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: null, // Available
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        userId: userId,
        playerName: 'Test Player',
        personaId: persona2Id,
        persona: { id: persona2Id, name: 'Mage' },
      } as any);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as any);

      // Player swaps from Warrior to Mage
      const result = await selectPersona(gameId, userId, persona2Id);

      expect(result.personaId).toBe(persona2Id);
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: persona2Id },
        include: { persona: true },
      });
    });

    it('should allow player to select same persona (no-op)', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const personaId = 'persona-1';

      const mockGame = {
        id: gameId,
        status: 'LOBBY',
        deletedAt: null,
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: personaId,
          },
        ],
        personas: [
          {
            id: personaId,
            name: 'Warrior',
            isNpc: false,
            claimedBy: { id: playerId, playerName: 'Test Player' },
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        personaId: personaId,
        persona: { id: personaId, name: 'Warrior' },
      } as any);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as any);

      // Player selects the same persona they already have
      await selectPersona(gameId, userId, personaId);

      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: personaId },
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
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: personaId,
          },
        ],
        personas: [
          {
            id: personaId,
            name: 'Warrior',
            isNpc: false,
            claimedBy: { id: playerId, playerName: 'Test Player' },
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: playerId,
        personaId: null,
        persona: null,
      } as any);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as any);

      // Player clears their persona
      const result = await selectPersona(gameId, userId, null);

      expect(result.personaId).toBeNull();
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: playerId },
        data: { personaId: null },
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
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: persona1Id,
          },
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: { id: playerId, playerName: 'Test Player' },
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: { id: otherPlayerId, playerName: 'Other Player' },
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);

      // Player tries to swap to persona claimed by another player
      await expect(selectPersona(gameId, userId, persona2Id)).rejects.toThrow(ConflictError);
      await expect(selectPersona(gameId, userId, persona2Id)).rejects.toThrow('This persona has already been claimed');
    });

    it('should prevent persona swapping after game has started', async () => {
      const gameId = 'game-123';
      const userId = 'user-456';
      const playerId = 'player-789';
      const persona1Id = 'persona-1';
      const persona2Id = 'persona-2';

      const mockGame = {
        id: gameId,
        status: 'ACTIVE', // Game has started
        deletedAt: null,
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: persona1Id,
          },
        ],
        personas: [
          {
            id: persona1Id,
            name: 'Warrior',
            isNpc: false,
            claimedBy: { id: playerId, playerName: 'Test Player' },
          },
          {
            id: persona2Id,
            name: 'Mage',
            isNpc: false,
            claimedBy: null,
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);

      // Player tries to swap persona after game started
      await expect(selectPersona(gameId, userId, persona2Id)).rejects.toThrow(BadRequestError);
      await expect(selectPersona(gameId, userId, persona2Id)).rejects.toThrow('Cannot change persona after game has started');
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
        players: [
          {
            id: playerId,
            userId: userId,
            playerName: 'Test Player',
            personaId: null,
          },
        ],
        personas: [
          {
            id: npcPersonaId,
            name: 'Dragon',
            isNpc: true, // NPC persona
            claimedBy: null,
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);

      // Player tries to select NPC persona
      await expect(selectPersona(gameId, userId, npcPersonaId)).rejects.toThrow(BadRequestError);
      await expect(selectPersona(gameId, userId, npcPersonaId)).rejects.toThrow('Cannot select an NPC persona');
    });
  });
});
