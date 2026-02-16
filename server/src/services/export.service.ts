import { stringify, parse } from 'yaml';
import { db } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { requireMember } from './game.service.js';
import { createGame } from './game.service.js';
import { createGameSchema } from '../utils/validators.js';

interface ExportResult {
  yaml: string;
  filename: string;
}

/**
 * Convert camelCase object keys to snake_case recursively
 */
function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(value);
    }
    return result;
  }

  return obj;
}

/**
 * Export the full game state as a YAML string.
 */
export async function exportGameState(gameId: string, userId: string): Promise<ExportResult> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      personas: {
        orderBy: { sortOrder: 'asc' },
        include: {
          claimedBy: {
            select: { playerName: true },
          },
        },
      },
      players: {
        orderBy: { joinOrder: 'asc' },
        include: {
          user: { select: { displayName: true } },
          persona: { select: { name: true } },
        },
      },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          actions: {
            orderBy: { sequenceNumber: 'asc' },
            include: {
              initiator: {
                select: { playerName: true },
              },
              arguments: {
                orderBy: { sequence: 'asc' },
                include: {
                  player: { select: { playerName: true } },
                },
              },
              votes: {
                orderBy: { castAt: 'asc' },
                include: {
                  player: { select: { playerName: true } },
                },
              },
              tokenDraw: {
                include: {
                  drawnTokens: {
                    orderBy: { drawSequence: 'asc' },
                  },
                },
              },
              narration: {
                include: {
                  author: { select: { playerName: true } },
                },
              },
            },
          },
          summary: {
            include: {
              author: { select: { playerName: true } },
            },
          },
        },
      },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  await requireMember(gameId, userId);

  const settings = (game.settings as Record<string, unknown>) || {};

  const exportData = {
    exported_at: new Date().toISOString(),
    game: {
      name: game.name,
      description: game.description || null,
      status: game.status,
      current_phase: game.currentPhase,
      npc_momentum: game.npcMomentum,
      settings: {
        argument_limit: settings.argumentLimit ?? 3,
        argumentation_timeout_hours: settings.argumentationTimeoutHours ?? 24,
        voting_timeout_hours: settings.votingTimeoutHours ?? 24,
        narration_mode: settings.narrationMode ?? 'initiator_only',
        personas_required: settings.personasRequired ?? false,
      },
      created_at: game.createdAt.toISOString(),
      started_at: game.startedAt?.toISOString() || null,
      completed_at: game.completedAt?.toISOString() || null,
    },
    personas: game.personas.map((p) => ({
      name: p.name,
      description: p.description || null,
      is_npc: p.isNpc,
      ...(p.isNpc
        ? {
            npc_action_description: p.npcActionDescription || null,
            npc_desired_outcome: p.npcDesiredOutcome || null,
          }
        : {}),
      claimed_by: p.claimedBy[0]?.playerName || null,
    })),
    players: game.players.map((p) => ({
      player_name: p.playerName,
      display_name: p.user.displayName,
      persona: p.persona?.name || null,
      is_host: p.isHost,
      is_npc: p.isNpc,
      join_order: p.joinOrder,
    })),
    rounds: game.rounds.map((round) => ({
      round_number: round.roundNumber,
      status: round.status,
      started_at: round.startedAt.toISOString(),
      completed_at: round.completedAt?.toISOString() || null,
      actions: round.actions.map((action) => ({
        sequence: action.sequenceNumber,
        initiator: action.initiator.playerName,
        description: action.actionDescription,
        desired_outcome: action.desiredOutcome,
        status: action.status,
        argumentation_skipped: action.argumentationWasSkipped,
        voting_skipped: action.votingWasSkipped,
        proposed_at: action.proposedAt.toISOString(),
        arguments: action.arguments.map((arg) => ({
          player: arg.player.playerName,
          type: arg.argumentType,
          content: arg.content,
        })),
        votes: action.votes.map((vote) => ({
          player: vote.player.playerName,
          vote: vote.voteType,
          success_tokens: vote.successTokens,
          failure_tokens: vote.failureTokens,
          was_skipped: vote.wasSkipped,
        })),
        token_draw: action.tokenDraw
          ? {
              pool: {
                success: action.tokenDraw.totalSuccessTokens,
                failure: action.tokenDraw.totalFailureTokens,
              },
              drawn: action.tokenDraw.drawnTokens.map((t) => t.tokenType),
              result: action.tokenDraw.resultType,
              result_value: action.tokenDraw.resultValue,
            }
          : null,
        narration: action.narration
          ? {
              author: action.narration.author.playerName,
              content: action.narration.content,
            }
          : null,
      })),
      summary: round.summary
        ? {
            author: round.summary.author.playerName,
            content: round.summary.content,
            outcomes: round.summary.outcomes ? toSnakeCase(round.summary.outcomes) : null,
          }
        : null,
    })),
  };

  const yamlString = stringify(exportData, { lineWidth: 120 });

  // Build a safe filename from the game name
  const rawSafeName = game.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const safeName = rawSafeName === '' ? 'game' : rawSafeName;
  const date = new Date().toISOString().split('T')[0];
  const filename = `${safeName}-export-${date}.yaml`;

  return { yaml: yamlString, filename };
}

/**
 * Import a game from a YAML string. Creates a new LOBBY game using
 * the game name, description, settings, and personas from the export.
 * All historical data (rounds, actions, etc.) is ignored.
 */
export async function importGameFromYaml(yamlString: string, userId: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(yamlString) as Record<string, unknown>;
  } catch {
    throw new BadRequestError('Invalid YAML format');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new BadRequestError('Invalid YAML: expected an object');
  }

  const gameData = parsed.game as Record<string, unknown> | undefined;
  if (!gameData || typeof gameData !== 'object') {
    throw new BadRequestError('Invalid YAML: missing "game" section');
  }

  // Map snake_case YAML back to camelCase for createGameSchema
  const settingsData = (gameData.settings as Record<string, unknown>) || {};
  const personasRaw = (parsed as { personas?: unknown }).personas;

  let personasData: Record<string, unknown>[] = [];

  if (personasRaw !== undefined) {
    if (!Array.isArray(personasRaw)) {
      throw new BadRequestError('Invalid YAML: "personas" must be an array');
    }

    personasData = personasRaw.map((persona, index) => {
      if (persona === null || Array.isArray(persona) || typeof persona !== 'object') {
        throw new BadRequestError(`Invalid YAML: persona at index ${index} must be an object`);
      }
      return persona as Record<string, unknown>;
    });
  }

  const input = {
    name: `${gameData.name || 'Imported Game'} (Copy)`,
    description: gameData.description as string | undefined,
    settings: {
      argumentLimit: settingsData.argument_limit as number | undefined,
      argumentationTimeoutHours: settingsData.argumentation_timeout_hours as number | undefined,
      votingTimeoutHours: settingsData.voting_timeout_hours as number | undefined,
      narrationMode: settingsData.narration_mode as string | undefined,
      personasRequired: settingsData.personas_required as boolean | undefined,
    },
    personas: personasData.map((p) => ({
      name: p.name as string,
      description: p.description as string | undefined,
      isNpc: (p.is_npc as boolean) || false,
      npcActionDescription: p.npc_action_description as string | undefined,
      npcDesiredOutcome: p.npc_desired_outcome as string | undefined,
    })),
  };

  // Validate through the existing schema
  const validated = createGameSchema.parse(input);

  return createGame(userId, validated);
}
