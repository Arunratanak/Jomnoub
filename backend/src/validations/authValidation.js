import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// Google ID tokens are about 1-2 KB
export const googleLoginSchema = z.object({ credential: z.string().min(1).max(4096) });

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email,
  // No trimming: spaces are allowed in passwords. The maximum stops huge inputs
  // from tying up the deliberately slow hashing.
  password: z.string().min(8).max(128),
});

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
