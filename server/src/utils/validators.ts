import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(1).max(50, 'Display name must be 50 characters or less'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// User schemas
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  gameStarted: z.boolean().optional(),
  actionProposed: z.boolean().optional(),
  votingStarted: z.boolean().optional(),
  resolutionReady: z.boolean().optional(),
  roundSummaryNeeded: z.boolean().optional(),
  newRound: z.boolean().optional(),
  timeoutWarnings: z.boolean().optional(),
});

// Persona schema
export const personaSchema = z.object({
  name: z.string()
    .min(1, 'Persona name is required')
    .max(100, 'Persona name must be 100 characters or less'),
  description: z.string()
    .max(1800, 'Persona description must be 1800 characters or less')
    .optional(),
  isNpc: z.boolean().default(false),
  npcActionDescription: z.string()
    .max(1800, 'NPC action description must be 1800 characters or less')
    .optional(),
  npcDesiredOutcome: z.string()
    .max(1200, 'NPC desired outcome must be 1200 characters or less')
    .optional(),
}).superRefine((data, ctx) => {
  if (data.isNpc) {
    const desc = data.npcActionDescription;
    if (!desc || desc.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['npcActionDescription'],
        message: 'NPC action description is required and must contain meaningful content when isNpc is true.',
      });
    }
  }
});

// Game schemas
export const createGameSchema = z.object({
  name: z.string().min(1, 'Game name is required').max(100, 'Game name must be 100 characters or less'),
  description: z.string().max(3600).optional(),
  settings: z.object({
    argumentLimit: z.number().int().min(1).max(10).default(3),
    proposalTimeoutHours: z.number().int().min(-1).max(168).default(-1),
    argumentationTimeoutHours: z.number().int().min(-1).max(168).default(-1),
    votingTimeoutHours: z.number().int().min(-1).max(168).default(-1),
    narrationTimeoutHours: z.number().int().min(-1).max(168).default(-1),
    narrationMode: z.enum(['initiator_only', 'collaborative']).default('initiator_only'),
    personasRequired: z.boolean().default(false),
  }).optional(),
  personas: z.array(personaSchema).max(20, 'Maximum 20 personas allowed').optional(),
});

export const joinGameSchema = z.object({
  playerName: z.string().min(1).max(50).optional(),
  personaId: z.string().uuid('Invalid persona ID').optional(),
});

export const selectPersonaSchema = z.object({
  personaId: z.string().uuid('Invalid persona ID').nullable(),
});

export const updatePersonaSchema = z.object({
  name: z.string()
    .min(1, 'Persona name is required')
    .max(50, 'Persona name must be 50 characters or less')
    .optional(),
  description: z.string()
    .max(1800, 'Persona description must be 1800 characters or less')
    .optional()
    .nullable(),
  npcActionDescription: z.string()
    .max(1800, 'NPC action description must be 1800 characters or less')
    .transform(val => val?.trim() || null)
    .optional()
    .nullable(),
  npcDesiredOutcome: z.string()
    .max(1200, 'NPC desired outcome must be 1200 characters or less')
    .transform(val => val?.trim() || null)
    .optional()
    .nullable(),
}).refine(
  (data) =>
    data.name !== undefined ||
    data.description !== undefined ||
    data.npcActionDescription !== undefined ||
    data.npcDesiredOutcome !== undefined,
  {
    message: 'At least one field must be provided to update persona',
  }
);

// Action schemas
export const actionProposalSchema = z.object({
  actionDescription: z.string().min(1, 'Action description is required').max(1800, 'Action description must be 1800 characters or less'),
  desiredOutcome: z.string().min(1, 'Desired outcome is required').max(1200, 'Desired outcome must be 1200 characters or less'),
  initialArguments: z.array(
    z.string().min(1).max(900, 'Each argument must be 900 characters or less')
  ).min(1, 'At least one argument is required').max(3, 'Maximum 3 initial arguments'),
});

export const argumentSchema = z.object({
  argumentType: z.enum(['FOR', 'AGAINST', 'CLARIFICATION']),
  content: z.string().min(1, 'Argument content is required').max(900, 'Argument must be 900 characters or less'),
});

export const voteSchema = z.object({
  voteType: z.enum(['LIKELY_SUCCESS', 'LIKELY_FAILURE', 'UNCERTAIN']),
});

export const narrationSchema = z.object({
  content: z.string().min(1, 'Narration is required').max(3600, 'Narration must be 3600 characters or less'),
});

export const roundSummarySchema = z.object({
  content: z.string().min(1, 'Summary is required').max(7500, 'Summary must be 7500 characters or less'),
  outcomes: z.object({
    totalTriumphs: z.number().int().min(0).optional(),
    totalDisasters: z.number().int().min(0).optional(),
    netMomentum: z.number().int().optional(),
    keyEvents: z.array(z.string()).max(10).optional(),
  }).optional(),
});

// Host edit schemas
export const updateActionSchema = z.object({
  actionDescription: z.string().min(1, 'Action description is required').max(1800, 'Action description must be 1800 characters or less').optional(),
  desiredOutcome: z.string().min(1, 'Desired outcome is required').max(1200, 'Desired outcome must be 1200 characters or less').optional(),
}).refine(
  (data) => data.actionDescription !== undefined || data.desiredOutcome !== undefined,
  { message: 'At least one field must be provided' }
);

export const updateArgumentSchema = z.object({
  content: z.string().min(1, 'Argument content is required').max(900, 'Argument must be 900 characters or less'),
});

export const updateNarrationSchema = z.object({
  content: z.string().min(1, 'Narration is required').max(3600, 'Narration must be 3600 characters or less'),
});

export const updateRoundSummarySchema = z.object({
  content: z.string().min(1, 'Summary is required').max(7500, 'Summary must be 7500 characters or less'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type PersonaInput = z.infer<typeof personaSchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type SelectPersonaInput = z.infer<typeof selectPersonaSchema>;
export type UpdatePersonaInput = z.infer<typeof updatePersonaSchema>;
export type ActionProposalInput = z.infer<typeof actionProposalSchema>;
export type ArgumentInput = z.infer<typeof argumentSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type NarrationInput = z.infer<typeof narrationSchema>;
export type RoundSummaryInput = z.infer<typeof roundSummarySchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;
export type UpdateArgumentInput = z.infer<typeof updateArgumentSchema>;
export type UpdateNarrationInput = z.infer<typeof updateNarrationSchema>;
export type UpdateRoundSummaryInput = z.infer<typeof updateRoundSummarySchema>;
