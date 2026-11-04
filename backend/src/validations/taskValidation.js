import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const TASK_STATUSES = ['todo', 'in-progress', 'done'];

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  deadline: z.coerce.date().min(new Date('2000-01-01')).max(new Date('2100-12-31')).nullable().optional(),
  assignee: objectIdSchema.nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();
