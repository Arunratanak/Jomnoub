import { z } from 'zod';

// Google ID tokens are about 1-2 KB
export const googleLoginSchema = z.object({ credential: z.string().min(1).max(4096) });
