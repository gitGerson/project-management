import { z } from 'zod';

export const sendCommentSchema = z.object({
  commentableType: z.string().min(1, 'Target scope type is required'),
  commentableId: z.number().int().positive('Target ID must be a positive integer'),
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message cannot exceed 10,000 characters'),
  tempId: z.string().optional(),
});

export const listCommentsQuerySchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.number().int().positive(),
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

