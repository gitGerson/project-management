import { z } from 'zod';

export const userFilterSchema = z.object({
  search: z.string().optional(),
  roleId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateManagedUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(191).optional(),
  phone: z.string().max(191).nullable().optional(),
  roleIds: z.array(z.number().int().positive()).optional(),
});

export type UserFilterSchemaInput = z.infer<typeof userFilterSchema>;
export type UpdateManagedUserSchemaInput = z.infer<typeof updateManagedUserSchema>;

