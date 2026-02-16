import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../../../src/middleware/errorHandler.js';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    game: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
    round: {
      create: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';
import { selectPersona, joinGame, setPersonaLead } from '../../../src/services/game.service.js';

function mockPlayer(overrides: {
  id: string;
  userId: string;
  playerName: string;
  personaId?: string | null;
  isPersonaLead?: boolean;
  isActive?: boolean;
  isNpc?: boolean;
  isHost?: boolean;
}) {
  return {
    id: overrides.id,
    userId: overrides.userId,
    playerName: overrides.playerName,
    personaId: overrides.personaId ?? null,
    isPersonaLead: overrides.isPersonaLead ?? false,
    isActive: overrides.isActive ?? true,
    isNpc: overrides.isNpc ?? false,
    isHost: overrides.isHost ?? false,
  };
}

describe('Shared Persona - Game Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectPersona with allowSharedPersonas', () => {
    it('should allow second player to claim same persona when sharing enabled', async () => {
      const player1 = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });
      const player2 = mockPlayer({ id: 'p2', userId: 'u2', playerName: 'Bob' });

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [player1, player2],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: 'p1', playerName: 'Alice' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: 'p2',
        personaId: 'persona-1',
        persona: { id: 'persona-1', name: 'Warrior' },
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await selectPersona('game-1', 'u2', 'persona-1');

      expect(result.personaId).toBe('persona-1');
      // Second claimer should NOT be lead
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { personaId: 'persona-1', isPersonaLead: false },
        include: { persona: true },
      });
    });

    it('should block second player claiming when sharing disabled', async () => {
      const player1 = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });
      const player2 = mockPlayer({ id: 'p2', userId: 'u2', playerName: 'Bob' });

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: false },
        players: [player1, player2],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: 'p1', playerName: 'Alice' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      await expect(selectPersona('game-1', 'u2', 'persona-1')).rejects.toThrow(ConflictError);
    });

    it('should auto-promote next member when lead clears persona', async () => {
      const player1 = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });
      const player2 = mockPlayer({
        id: 'p2',
        userId: 'u2',
        playerName: 'Bob',
        personaId: 'persona-1',
        isPersonaLead: false,
      });

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [player1, player2],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [
              { id: 'p1', playerName: 'Alice' },
              { id: 'p2', playerName: 'Bob' },
            ],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: 'p1',
        personaId: null,
        persona: null,
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      await selectPersona('game-1', 'u1', null);

      // First call: clear the lead's persona
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { personaId: null, isPersonaLead: false },
        include: { persona: true },
      });

      // Second call: promote Bob to lead
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { isPersonaLead: true },
      });
    });

    it('should set first claimer as persona lead', async () => {
      const player1 = mockPlayer({ id: 'p1', userId: 'u1', playerName: 'Alice' });

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [player1],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: 'p1',
        personaId: 'persona-1',
        persona: { id: 'persona-1', name: 'Warrior' },
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      await selectPersona('game-1', 'u1', 'persona-1');

      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { personaId: 'persona-1', isPersonaLead: true },
        include: { persona: true },
      });
    });

    it('should preserve non-lead status when re-selecting same persona', async () => {
      const player1 = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });
      const player2 = mockPlayer({
        id: 'p2',
        userId: 'u2',
        playerName: 'Bob',
        personaId: 'persona-1',
        isPersonaLead: false,
      });

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [player1, player2],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [
              { id: 'p1', playerName: 'Alice' },
              { id: 'p2', playerName: 'Bob' },
            ],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({
        id: 'p2',
        personaId: 'persona-1',
        persona: { id: 'persona-1', name: 'Warrior' },
      } as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      await selectPersona('game-1', 'u2', 'persona-1');

      // Non-lead re-selecting same persona should stay non-lead
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { personaId: 'persona-1', isPersonaLead: false },
        include: { persona: true },
      });
    });
  });

  describe('joinGame with shared personas', () => {
    it('should allow joining with already-claimed persona when sharing enabled', async () => {
      const existingPlayer = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });

      const mockGame = {
        id: 'game-1',
        name: 'Test',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [existingPlayer],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: 'p1', playerName: 'Alice' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.create).mockResolvedValue({
        id: 'p2',
        personaId: 'persona-1',
        isPersonaLead: false,
        persona: { name: 'Warrior' },
      } as never);
      vi.mocked(db.game.update).mockResolvedValue({} as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await joinGame('game-1', 'u2', 'Bob', 'persona-1');

      expect(result.personaId).toBe('persona-1');
      expect(result.isPersonaLead).toBe(false);
    });

    it('should block joining with claimed persona when sharing disabled', async () => {
      const existingPlayer = mockPlayer({
        id: 'p1',
        userId: 'u1',
        playerName: 'Alice',
        personaId: 'persona-1',
        isPersonaLead: true,
      });

      const mockGame = {
        id: 'game-1',
        name: 'Test',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: false },
        players: [existingPlayer],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [{ id: 'p1', playerName: 'Alice' }],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      await expect(joinGame('game-1', 'u2', 'Bob', 'persona-1')).rejects.toThrow(ConflictError);
    });

    it('should set first claimer as lead on join', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Test',
        status: 'LOBBY',
        deletedAt: null,
        settings: { allowSharedPersonas: true },
        players: [],
        personas: [
          {
            id: 'persona-1',
            name: 'Warrior',
            isNpc: false,
            claimedBy: [],
          },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.create).mockResolvedValue({
        id: 'p1',
        personaId: 'persona-1',
        isPersonaLead: true,
        persona: { name: 'Warrior' },
      } as never);
      vi.mocked(db.game.update).mockResolvedValue({} as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await joinGame('game-1', 'u1', 'Alice', 'persona-1');

      expect(result.isPersonaLead).toBe(true);
      expect(db.gamePlayer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPersonaLead: true,
          }),
        })
      );
    });
  });

  describe('setPersonaLead', () => {
    it('should swap lead from one member to another', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'p-host',
        userId: 'host-user',
        isHost: true,
        isActive: true,
      } as never);

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        players: [
          mockPlayer({
            id: 'p1',
            userId: 'u1',
            playerName: 'Alice',
            personaId: 'persona-1',
            isPersonaLead: true,
            isHost: true,
          }),
          mockPlayer({
            id: 'p2',
            userId: 'u2',
            playerName: 'Bob',
            personaId: 'persona-1',
            isPersonaLead: false,
          }),
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);
      vi.mocked(db.gamePlayer.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never);
      vi.mocked(db.gameEvent.create).mockResolvedValue({} as never);

      const result = await setPersonaLead('game-1', 'persona-1', 'p2', 'u1');

      expect(result.message).toBe('Persona lead updated');

      // Should remove lead from all current leads of this persona
      expect(db.gamePlayer.updateMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1', personaId: 'persona-1', isPersonaLead: true },
        data: { isPersonaLead: false },
      });

      // Should set new lead
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { isPersonaLead: true },
      });
    });

    it('should reject if game is not in LOBBY', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'p-host',
        isHost: true,
        isActive: true,
      } as never);

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        status: 'ACTIVE',
        deletedAt: null,
        players: [],
      } as never);

      await expect(setPersonaLead('game-1', 'persona-1', 'p2', 'u1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reject if player is not a member of the persona', async () => {
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'p-host',
        isHost: true,
        isActive: true,
      } as never);

      const mockGame = {
        id: 'game-1',
        status: 'LOBBY',
        deletedAt: null,
        players: [
          mockPlayer({
            id: 'p2',
            userId: 'u2',
            playerName: 'Bob',
            personaId: 'persona-2', // Different persona
          }),
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as never);

      await expect(setPersonaLead('game-1', 'persona-1', 'p2', 'u1')).rejects.toThrow(
        BadRequestError
      );
    });
  });
});
