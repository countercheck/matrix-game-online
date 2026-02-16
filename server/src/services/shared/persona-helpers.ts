interface PlayerForCounting {
  readonly id: string;
  readonly personaId: string | null;
  readonly isNpc: boolean;
  readonly isActive: boolean;
}

/**
 * Count distinct "acting units" for a game.
 * An acting unit is either:
 * - A unique claimed persona (shared by one or more players)
 * - A solo player without a persona
 * NPCs and inactive players are excluded.
 */
export function countActingUnits(players: readonly PlayerForCounting[]): number {
  const activePlayers = players.filter((p) => p.isActive && !p.isNpc);

  const personaIds = new Set<string>();
  let soloCount = 0;

  for (const player of activePlayers) {
    if (player.personaId) {
      personaIds.add(player.personaId);
    } else {
      soloCount++;
    }
  }

  return personaIds.size + soloCount;
}

/**
 * Get the IDs of all active players sharing a specific persona.
 */
export function getPersonaMemberIds(
  players: readonly PlayerForCounting[],
  personaId: string
): string[] {
  return players
    .filter((p) => p.isActive && !p.isNpc && p.personaId === personaId)
    .map((p) => p.id);
}
