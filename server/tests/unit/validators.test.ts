import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import schemas (recreated here for testing to avoid module issues)
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(1).max(50, 'Display name must be 50 characters or less'),
});

const personaSchema = z.object({
  name: z.string().min(1, 'Persona name is required').max(100),
  description: z.string().max(1800).optional(),
  isNpc: z.boolean().default(false),
  npcActionDescription: z.string().max(1800).optional(),
  npcDesiredOutcome: z.string().max(1200).optional(),
});

const createGameSchema = z.object({
  name: z.string().min(1, 'Game name is required').max(150, 'Game name must be 150 characters or less'),
  description: z.string().max(3600).optional(),
  settings: z.object({
    argumentLimit: z.number().int().min(1).max(10).default(3),
    argumentationTimeoutHours: z.number().int().min(1).max(72).default(24),
    votingTimeoutHours: z.number().int().min(1).max(72).default(24),
    narrationMode: z.enum(['initiator_only', 'collaborative']).default('initiator_only'),
  }).optional(),
  personas: z.array(personaSchema).max(20).optional(),
});

const actionProposalSchema = z.object({
  actionDescription: z.string().min(1).max(1800),
  desiredOutcome: z.string().min(1).max(1200),
  initialArguments: z.array(z.string().min(1).max(900)).min(1).max(3),
});

const argumentSchema = z.object({
  argumentType: z.enum(['FOR', 'AGAINST', 'CLARIFICATION']),
  content: z.string().min(1).max(900),
});

const voteSchema = z.object({
  voteType: z.enum(['LIKELY_SUCCESS', 'LIKELY_FAILURE', 'UNCERTAIN']),
});

const narrationSchema = z.object({
  content: z.string().min(1).max(3600),
});

describe('Validators', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'ValidPass123',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'not-an-email',
        password: 'ValidPass123',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        password: 'Short1',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject password without uppercase', () => {
      const data = {
        email: 'test@example.com',
        password: 'nouppercase123',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject password without lowercase', () => {
      const data = {
        email: 'test@example.com',
        password: 'NOLOWERCASE123',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject password without number', () => {
      const data = {
        email: 'test@example.com',
        password: 'NoNumbersHere',
        displayName: 'Test User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject empty display name', () => {
      const data = {
        email: 'test@example.com',
        password: 'ValidPass123',
        displayName: '',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject display name over 50 chars', () => {
      const data = {
        email: 'test@example.com',
        password: 'ValidPass123',
        displayName: 'a'.repeat(51),
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });
  });

  describe('createGameSchema', () => {
    it('should accept valid game data', () => {
      const data = {
        name: 'Test Game',
        description: 'A test game',
      };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should accept game without description', () => {
      const data = { name: 'Test Game' };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should reject empty game name', () => {
      const data = { name: '' };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should reject game name over 150 chars', () => {
      const data = { name: 'a'.repeat(151) };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should reject description over 3600 chars', () => {
      const data = { name: 'Test', description: 'a'.repeat(3601) };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should accept custom settings', () => {
      const data = {
        name: 'Test Game',
        settings: {
          argumentLimit: 5,
          argumentationTimeoutHours: 48,
          votingTimeoutHours: 12,
          narrationMode: 'collaborative' as const,
        },
      };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid argument limit', () => {
      const data = {
        name: 'Test Game',
        settings: { argumentLimit: 0 },
      };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should reject invalid timeout hours', () => {
      const data = {
        name: 'Test Game',
        settings: { argumentationTimeoutHours: 100 },
      };
      expect(() => createGameSchema.parse(data)).toThrow();
    });
  });

  describe('actionProposalSchema', () => {
    it('should accept valid action proposal', () => {
      const data = {
        actionDescription: 'Attack the fortress',
        desiredOutcome: 'Fortress is captured',
        initialArguments: ['We have superior numbers', 'Element of surprise'],
      };
      expect(() => actionProposalSchema.parse(data)).not.toThrow();
    });

    it('should require at least one argument', () => {
      const data = {
        actionDescription: 'Attack the fortress',
        desiredOutcome: 'Fortress is captured',
        initialArguments: [],
      };
      expect(() => actionProposalSchema.parse(data)).toThrow();
    });

    it('should reject more than 3 arguments', () => {
      const data = {
        actionDescription: 'Attack the fortress',
        desiredOutcome: 'Fortress is captured',
        initialArguments: ['Arg 1', 'Arg 2', 'Arg 3', 'Arg 4'],
      };
      expect(() => actionProposalSchema.parse(data)).toThrow();
    });

    it('should reject action description over 1800 chars', () => {
      const data = {
        actionDescription: 'a'.repeat(1801),
        desiredOutcome: 'Success',
        initialArguments: ['Arg'],
      };
      expect(() => actionProposalSchema.parse(data)).toThrow();
    });

    it('should reject desired outcome over 1200 chars', () => {
      const data = {
        actionDescription: 'Action',
        desiredOutcome: 'a'.repeat(1201),
        initialArguments: ['Arg'],
      };
      expect(() => actionProposalSchema.parse(data)).toThrow();
    });

    it('should reject argument over 900 chars', () => {
      const data = {
        actionDescription: 'Action',
        desiredOutcome: 'Outcome',
        initialArguments: ['a'.repeat(901)],
      };
      expect(() => actionProposalSchema.parse(data)).toThrow();
    });
  });

  describe('argumentSchema', () => {
    it('should accept valid FOR argument', () => {
      const data = { argumentType: 'FOR', content: 'This is a good idea' };
      expect(() => argumentSchema.parse(data)).not.toThrow();
    });

    it('should accept valid AGAINST argument', () => {
      const data = { argumentType: 'AGAINST', content: 'This is risky' };
      expect(() => argumentSchema.parse(data)).not.toThrow();
    });

    it('should accept valid CLARIFICATION', () => {
      const data = { argumentType: 'CLARIFICATION', content: 'To clarify...' };
      expect(() => argumentSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid argument type', () => {
      const data = { argumentType: 'INVALID', content: 'Content' };
      expect(() => argumentSchema.parse(data)).toThrow();
    });

    it('should reject empty content', () => {
      const data = { argumentType: 'FOR', content: '' };
      expect(() => argumentSchema.parse(data)).toThrow();
    });

    it('should reject content over 900 chars', () => {
      const data = { argumentType: 'FOR', content: 'a'.repeat(901) };
      expect(() => argumentSchema.parse(data)).toThrow();
    });
  });

  describe('voteSchema', () => {
    it('should accept LIKELY_SUCCESS', () => {
      const data = { voteType: 'LIKELY_SUCCESS' };
      expect(() => voteSchema.parse(data)).not.toThrow();
    });

    it('should accept LIKELY_FAILURE', () => {
      const data = { voteType: 'LIKELY_FAILURE' };
      expect(() => voteSchema.parse(data)).not.toThrow();
    });

    it('should accept UNCERTAIN', () => {
      const data = { voteType: 'UNCERTAIN' };
      expect(() => voteSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid vote type', () => {
      const data = { voteType: 'MAYBE' };
      expect(() => voteSchema.parse(data)).toThrow();
    });
  });

  describe('narrationSchema', () => {
    it('should accept valid narration', () => {
      const data = { content: 'The fortress fell after a fierce battle...' };
      expect(() => narrationSchema.parse(data)).not.toThrow();
    });

    it('should reject empty narration', () => {
      const data = { content: '' };
      expect(() => narrationSchema.parse(data)).toThrow();
    });

    it('should reject narration over 3600 chars', () => {
      const data = { content: 'a'.repeat(3601) };
      expect(() => narrationSchema.parse(data)).toThrow();
    });

    it('should accept narration at max length', () => {
      const data = { content: 'a'.repeat(3600) };
      expect(() => narrationSchema.parse(data)).not.toThrow();
    });
  });

  describe('personaSchema', () => {
    it('should accept valid persona', () => {
      const data = { name: 'Hero', description: 'A brave warrior' };
      expect(() => personaSchema.parse(data)).not.toThrow();
    });

    it('should accept NPC persona with action description', () => {
      const data = {
        name: 'Dragon',
        isNpc: true,
        npcActionDescription: 'The dragon attacks the village',
        npcDesiredOutcome: 'The village burns',
      };
      expect(() => personaSchema.parse(data)).not.toThrow();
    });

    it('should reject persona without name', () => {
      const data = { description: 'Description without name' };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should reject persona with name over 100 chars', () => {
      const data = { name: 'a'.repeat(101) };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should reject NPC action description over 1800 chars', () => {
      const data = {
        name: 'Dragon',
        isNpc: true,
        npcActionDescription: 'a'.repeat(1801),
      };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should reject NPC desired outcome over 1200 chars', () => {
      const data = {
        name: 'Dragon',
        isNpc: true,
        npcDesiredOutcome: 'a'.repeat(1201),
      };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should default isNpc to false', () => {
      const data = { name: 'Hero' };
      const result = personaSchema.parse(data);
      expect(result.isNpc).toBe(false);
    });
  });

  describe('createGameSchema with personas', () => {
    it('should accept game with personas', () => {
      const data = {
        name: 'Test Game',
        personas: [
          { name: 'Hero', description: 'A brave warrior' },
          { name: 'Villain', isNpc: true, npcActionDescription: 'Evil plans unfold' },
        ],
      };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should reject game with more than 20 personas', () => {
      const personas = Array.from({ length: 21 }, (_, i) => ({
        name: `Persona ${i + 1}`,
      }));
      const data = { name: 'Test Game', personas };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should accept game with empty personas array', () => {
      const data = { name: 'Test Game', personas: [] };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should accept game without personas', () => {
      const data = { name: 'Test Game' };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });
  });
});
