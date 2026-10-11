import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal('')),
});

export type RegisterInput = z.infer<typeof registerSchema>;

