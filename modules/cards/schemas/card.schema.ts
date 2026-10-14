import { z } from 'zod';

export const createCardSchema = z.object({
  boardId: z.number().int().positive('Invalid board ID'),
  listId: z.number().int().positive('Invalid list ID'),
  title: z
    .string()
    .trim()
    .min(1, 'Card title is required')
    .max(255, 'Card title cannot exceed 255 characters'),
  description: z.string().trim().nullable().optional(),
  coverUrl: z.string().trim().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  position: z.enum(['top', 'bottom']).optional().default('top'),
});

export const updateCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Card title is required')
    .max(255, 'Card title cannot exceed 255 characters')
    .optional(),
  description: z.string().trim().nullable().optional(),
  coverUrl: z.string().trim().nullable().optional(),
  status: z.string().trim().max(20).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  ownerId: z.number().int().positive('Invalid owner ID').optional(),
});

export const moveCardSchema = z.object({
  cardId: z.number().int().positive('Invalid card ID'),
  targetListId: z.number().int().positive('Invalid target list ID'),
  previousCardId: z.number().int().positive().nullable().optional(),
  nextCardId: z.number().int().positive().nullable().optional(),
});

export type CreateCardSchemaInput = z.infer<typeof createCardSchema>;
export type UpdateCardSchemaInput = z.infer<typeof updateCardSchema>;
export type MoveCardSchemaInput = z.infer<typeof moveCardSchema>;

