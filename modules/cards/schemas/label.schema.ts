import { z } from 'zod';

export const createLabelSchema = z.object({
  boardId: z.number().int().positive('Invalid board ID'),
  title: z.string().trim().max(100, 'Title cannot exceed 100 characters').nullable().optional(),
  color: z.string().trim().max(30, 'Color code cannot exceed 30 characters').nullable().optional(),
});

export const updateLabelSchema = z.object({
  title: z.string().trim().max(100, 'Title cannot exceed 100 characters').nullable().optional(),
  color: z.string().trim().max(30, 'Color code cannot exceed 30 characters').nullable().optional(),
});

export const toggleCardLabelSchema = z.object({
  cardId: z.number().int().positive('Invalid card ID'),
  labelId: z.number().int().positive('Invalid label ID'),
});

export type CreateLabelSchemaInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelSchemaInput = z.infer<typeof updateLabelSchema>;
export type ToggleCardLabelSchemaInput = z.infer<typeof toggleCardLabelSchema>;

