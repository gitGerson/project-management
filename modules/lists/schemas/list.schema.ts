import { z } from 'zod';

export const createListSchema = z.object({
  boardId: z.number().int().positive('Invalid board ID'),
  title: z
    .string()
    .trim()
    .min(1, 'List title is required')
    .max(255, 'List title cannot exceed 255 characters'),
  code: z
    .string()
    .trim()
    .max(100, 'List code cannot exceed 100 characters')
    .optional(),
  position: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const updateListSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'List title is required')
    .max(255, 'List title cannot exceed 255 characters')
    .optional(),
  code: z
    .string()
    .trim()
    .max(100, 'List code cannot exceed 100 characters')
    .optional(),
  position: z.number().optional(),
  isActive: z.boolean().optional(),
});

export type CreateListSchemaInput = z.infer<typeof createListSchema>;
export type UpdateListSchemaInput = z.infer<typeof updateListSchema>;

