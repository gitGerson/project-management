import { z } from 'zod';

export const commentAttachmentSchema = z.object({
  id: z.number().optional(),
  url: z.string().url('Invalid attachment URL'),
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  isImage: z.boolean(),
});

export const commentReplySchema = z.object({
  id: z.number().int().positive(),
  authorName: z.string().min(1),
  snippet: z.string().max(500),
});

export const sendCommentSchema = z
  .object({
    commentableType: z.string().min(1, 'Target scope type is required'),
    commentableId: z.number().int().positive('Target ID must be a positive integer'),
    content: z.string().max(10000, 'Message cannot exceed 10,000 characters').default(''),
    replyTo: commentReplySchema.nullable().optional(),
    attachments: z.array(commentAttachmentSchema).optional(),
    tempId: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasText = data.content && data.content.trim().length > 0;
      const hasAttachments = data.attachments && data.attachments.length > 0;
      return hasText || hasAttachments;
    },
    {
      message: 'Comment must contain text or at least one attachment.',
      path: ['content'],
    }
  );

export const listCommentsQuerySchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.number().int().positive(),
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
