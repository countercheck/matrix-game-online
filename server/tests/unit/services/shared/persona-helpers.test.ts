import { describe, it, expect } from 'vitest';
import { countActingUnits, getPersonaMemberIds } from '../../../../src/services/shared/persona-helpers';

function makePlayer(overrides: {
  id: string;
  personaId?: string | null;
  isNpc?: boolean;
  isActive?: boolean;
}) {
  return {
    id: overrides.id,
    personaId: overrides.personaId ?? null,
    isNpc: overrides.isNpc ?? false,
    isActive: overrides.isActive ?? true,
  };
}

describe('countActingUnits', () => {
  it('should count each unique persona as one unit', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'p2', personaId: 'persona-a' }),
      makePlayer({ id: 'p3', personaId: 'persona-b' }),
    ];
    expect(countActingUnits(players)).toBe(2);
  });

  it('should count solo players (no persona) individually', () => {
    const players = [
      makePlayer({ id: 'p1' }),
      makePlayer({ id: 'p2' }),
    ];
    expect(countActingUnits(players)).toBe(2);
  });

  it('should count mix of shared personas and solo players', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'p2', personaId: 'persona-a' }),
      makePlayer({ id: 'p3' }),
    ];
    expect(countActingUnits(players)).toBe(2);
  });

  it('should exclude NPC players', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'npc', personaId: 'persona-npc', isNpc: true }),
    ];
    expect(countActingUnits(players)).toBe(1);
  });

  it('should exclude inactive players', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'p2', personaId: 'persona-b', isActive: false }),
    ];
    expect(countActingUnits(players)).toBe(1);
  });

  it('should return 0 for empty player list', () => {
    expect(countActingUnits([])).toBe(0);
  });

  it('should return 0 when all players are NPCs or inactive', () => {
    const players = [
      makePlayer({ id: 'npc1', isNpc: true }),
      makePlayer({ id: 'p1', isActive: false }),
    ];
    expect(countActingUnits(players)).toBe(0);
  });
});

describe('getPersonaMemberIds', () => {
  it('should return IDs of all players sharing the persona', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'p2', personaId: 'persona-a' }),
      makePlayer({ id: 'p3', personaId: 'persona-b' }),
    ];
    expect(getPersonaMemberIds(players, 'persona-a')).toEqual(['p1', 'p2']);
  });

  it('should exclude inactive members', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'p2', personaId: 'persona-a', isActive: false }),
    ];
    expect(getPersonaMemberIds(players, 'persona-a')).toEqual(['p1']);
  });

  it('should exclude NPC members', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-a' }),
      makePlayer({ id: 'npc', personaId: 'persona-a', isNpc: true }),
    ];
    expect(getPersonaMemberIds(players, 'persona-a')).toEqual(['p1']);
  });

  it('should return empty array when no players share the persona', () => {
    const players = [
      makePlayer({ id: 'p1', personaId: 'persona-b' }),
    ];
    expect(getPersonaMemberIds(players, 'persona-a')).toEqual([]);
  });

  it('should return empty array for empty player list', () => {
    expect(getPersonaMemberIds([], 'persona-a')).toEqual([]);
  });
});
