import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const createMessageSchema = z.object({ text: z.string().trim().min(1).max(2000) });

export const listMessagesSchema = z.object({
  before: objectIdSchema.optional(), // load messages older than this id
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
