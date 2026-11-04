import { z } from 'zod';

// Strict MongoDB ObjectId: exactly 24 hex characters. (mongoose.isValidObjectId
// also accepts any 12-character string, which is too loose for ids from users.)
const OBJECT_ID = /^[a-f\d]{24}$/i;

export const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);
export const objectIdSchema = z.string().regex(OBJECT_ID, 'Invalid id');
