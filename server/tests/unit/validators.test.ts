import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  createGameSchema,
  actionProposalSchema,
  argumentSchema,
  voteSchema,
  narrationSchema,
  personaSchema,
} from '../../src/utils/validators.js';

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

    it('should reject game name over 100 chars', () => {
      const data = { name: 'a'.repeat(101) };
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
        settings: { argumentationTimeoutHours: 169 },
      };
      expect(() => createGameSchema.parse(data)).toThrow();
    });

    it('should accept timeout hours up to 168 (1 week)', () => {
      const data = {
        name: 'Test Game',
        settings: { argumentationTimeoutHours: 168 },
      };
      expect(() => createGameSchema.parse(data)).not.toThrow();
    });

    it('should accept timeout hours of 100', () => {
      const data = {
        name: 'Test Game',
        settings: { argumentationTimeoutHours: 100 },
      };
      expect(() => createGameSchema.parse(data)).not.toThrow();
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
      expect(() =>
        argumentSchema.parse({ argumentType: 'FOR', content: 'This is a good idea' })
      ).not.toThrow();
    });

    it('should accept valid AGAINST argument', () => {
      expect(() =>
        argumentSchema.parse({ argumentType: 'AGAINST', content: 'This is risky' })
      ).not.toThrow();
    });

    it('should accept valid CLARIFICATION', () => {
      expect(() =>
        argumentSchema.parse({ argumentType: 'CLARIFICATION', content: 'To clarify...' })
      ).not.toThrow();
    });

    it('should reject invalid argument type', () => {
      expect(() => argumentSchema.parse({ argumentType: 'INVALID', content: 'Content' })).toThrow();
    });

    it('should reject empty content', () => {
      expect(() => argumentSchema.parse({ argumentType: 'FOR', content: '' })).toThrow();
    });

    it('should reject content over 900 chars', () => {
      expect(() =>
        argumentSchema.parse({ argumentType: 'FOR', content: 'a'.repeat(901) })
      ).toThrow();
    });
  });

  describe('voteSchema', () => {
    it('should accept LIKELY_SUCCESS', () => {
      expect(() => voteSchema.parse({ voteType: 'LIKELY_SUCCESS' })).not.toThrow();
    });

    it('should accept LIKELY_FAILURE', () => {
      expect(() => voteSchema.parse({ voteType: 'LIKELY_FAILURE' })).not.toThrow();
    });

    it('should accept UNCERTAIN', () => {
      expect(() => voteSchema.parse({ voteType: 'UNCERTAIN' })).not.toThrow();
    });

    it('should reject invalid vote type', () => {
      expect(() => voteSchema.parse({ voteType: 'MAYBE' })).toThrow();
    });
  });

  describe('narrationSchema', () => {
    it('should accept valid narration', () => {
      expect(() =>
        narrationSchema.parse({ content: 'The fortress fell after a fierce battle...' })
      ).not.toThrow();
    });

    it('should reject empty narration', () => {
      expect(() => narrationSchema.parse({ content: '' })).toThrow();
    });

    it('should reject narration over 3600 chars', () => {
      expect(() => narrationSchema.parse({ content: 'a'.repeat(3601) })).toThrow();
    });

    it('should accept narration at max length', () => {
      expect(() => narrationSchema.parse({ content: 'a'.repeat(3600) })).not.toThrow();
    });
  });

  describe('personaSchema', () => {
    it('should accept valid persona', () => {
      expect(() =>
        personaSchema.parse({ name: 'Hero', description: 'A brave warrior' })
      ).not.toThrow();
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

    it('should reject NPC persona without action description', () => {
      const data = {
        name: 'Dragon',
        isNpc: true,
      };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should reject persona without name', () => {
      expect(() => personaSchema.parse({ description: 'Description without name' })).toThrow();
    });

    it('should reject persona with name over 100 chars', () => {
      expect(() => personaSchema.parse({ name: 'a'.repeat(101) })).toThrow();
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
        npcActionDescription: 'Valid description',
        npcDesiredOutcome: 'a'.repeat(1201),
      };
      expect(() => personaSchema.parse(data)).toThrow();
    });

    it('should default isNpc to false', () => {
      const result = personaSchema.parse({ name: 'Hero' });
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
      expect(() => createGameSchema.parse({ name: 'Test Game', personas })).toThrow();
    });

    it('should accept game with empty personas array', () => {
      expect(() => createGameSchema.parse({ name: 'Test Game', personas: [] })).not.toThrow();
    });

    it('should accept game without personas', () => {
      expect(() => createGameSchema.parse({ name: 'Test Game' })).not.toThrow();
    });
  });
});
