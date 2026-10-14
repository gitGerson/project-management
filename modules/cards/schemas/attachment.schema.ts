import { z } from 'zod';

export const createCardAttachmentSchema = z.object({
  cardId: z.number().int().positive('Card ID must be a positive integer'),
  fileName: z.string().min(1, 'File name is required').max(255),
  fileUrl: z.string().min(1, 'File URL is required').max(1024),
  fileSize: z.number().int().nonnegative('File size must be non-negative'),
  fileType: z.string().min(1, 'File type is required').max(100),
});

export type CreateCardAttachmentSchemaInput = z.infer<typeof createCardAttachmentSchema>;

