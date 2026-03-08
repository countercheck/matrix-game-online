import { describe, it, expect } from 'vitest';
import { sendTestEmailSchema } from '../../src/utils/admin.validators.js';

describe('sendTestEmailSchema', () => {
  it('accepts a valid email', () => {
    const result = sendTestEmailSchema.safeParse({ to: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = sendTestEmailSchema.safeParse({ to: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = sendTestEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
