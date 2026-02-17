import { z } from 'zod';

export const createChannelSchema = z
  .object({
    scope: z.enum(['PERSONA', 'DIRECT']),
    personaIds: z.array(z.string().uuid()).optional(),
    playerIds: z.array(z.string().uuid()).optional(),
    name: z.string().max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.scope === 'PERSONA') {
        return data.personaIds && data.personaIds.length > 0;
      }
      if (data.scope === 'DIRECT') {
        return data.playerIds && data.playerIds.length > 0;
      }
      return true;
    },
    {
      message: 'PERSONA scope requires personaIds, DIRECT scope requires playerIds',
    }
  );

export const getMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  replyToId: z.string().uuid().optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
