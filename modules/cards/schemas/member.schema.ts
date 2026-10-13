import { z } from 'zod';

export const toggleCardMemberSchema = z.object({
  cardId: z.number().int().positive('Invalid card ID'),
  userId: z.number().int().positive('Invalid user ID'),
});

export type ToggleCardMemberSchemaInput = z.infer<typeof toggleCardMemberSchema>;

