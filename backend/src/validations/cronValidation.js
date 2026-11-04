import { z } from 'zod';

export const reminderQuerySchema = z.object({ dryRun: z.enum(['true', 'false']).optional() });
