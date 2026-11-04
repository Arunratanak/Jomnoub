import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().default(''),
});

// Separate schema without .default(), so a PATCH that omits description doesn't wipe it
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

export const addMemberSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });
