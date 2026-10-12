import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board title is required')
    .max(255, 'Board title cannot exceed 255 characters')
    .trim(),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  image: z.string().max(500, 'Image URL or identifier cannot exceed 500 characters').optional().nullable(),
});

export const updateBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board title is required')
    .max(255, 'Board title cannot exceed 255 characters')
    .trim()
    .optional(),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  image: z.string().max(500, 'Image URL or identifier cannot exceed 500 characters').optional().nullable(),
});

export type CreateBoardSchemaInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardSchemaInput = z.infer<typeof updateBoardSchema>;

