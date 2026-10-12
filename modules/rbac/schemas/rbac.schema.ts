import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(100, 'Role name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Role name can only contain letters, numbers, spaces, underscores, and hyphens'),
  description: z.string().max(255).optional(),
  permissionIds: z.array(z.number().int().positive()).optional(),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(100, 'Role name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Role name can only contain letters, numbers, spaces, underscores, and hyphens')
    .optional(),
  description: z.string().max(255).optional(),
  permissionIds: z.array(z.number().int().positive()).optional(),
});

export const assignUserRolesSchema = z.object({
  userId: z.number().int().positive('Valid user ID is required'),
  roleIds: z.array(z.number().int().positive()),
});

export type CreateRoleSchemaInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;
export type AssignUserRolesSchemaInput = z.infer<typeof assignUserRolesSchema>;

