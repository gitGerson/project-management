import { z } from 'zod';

export const boardMemberRoleSchema = z.enum(['owner', 'member', 'monitor', 'guest'], {
  errorMap: () => ({ message: 'Role must be one of: owner, member, monitor, guest' }),
});

export const addBoardMemberSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  userId: z.number().int().positive('User ID must be a positive integer'),
  role: boardMemberRoleSchema.default('member'),
});

export const updateBoardMemberRoleSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  userId: z.number().int().positive('User ID must be a positive integer'),
  role: boardMemberRoleSchema,
});

export const removeBoardMemberSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  userId: z.number().int().positive('User ID must be a positive integer'),
});

export const syncBoardMembersSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  members: z.array(
    z.object({
      userId: z.number().int().positive('User ID must be a positive integer'),
      role: boardMemberRoleSchema,
    })
  ),
});

