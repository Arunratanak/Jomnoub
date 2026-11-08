import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const TASK_STATUSES = ['todo', 'in-progress', 'done'];
const MAX_ASSIGNEES = 50; // more than any project has members

const taskFields = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  deadline: z.coerce.date().min(new Date('2000-01-01')).max(new Date('2100-12-31')).nullable().optional(),
  assignees: z.array(objectIdSchema).max(MAX_ASSIGNEES).optional(),
  // The older single-person form, still accepted: an id, or null for nobody
  assignee: objectIdSchema.nullable().optional(),
});

// One list of people, whichever form was sent, without repeats
function withAssignees({ assignee, ...rest }) {
  if (rest.assignees === undefined && assignee !== undefined) rest.assignees = assignee ? [assignee] : [];
  if (rest.assignees) rest.assignees = [...new Set(rest.assignees.map((id) => id.toLowerCase()))];
  return rest;
}

// separate: with two or more people, make a copy of the task for each one
export const createTaskSchema = taskFields.extend({ separate: z.boolean().optional() }).transform(withAssignees);

export const updateTaskSchema = taskFields.partial().transform(withAssignees);

export const assignToAllSchema = taskFields.omit({ status: true, assignee: true, assignees: true });

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  done: z.boolean().optional(),
});

export const searchSchema = z.object({ q: z.string().trim().min(1).max(100) });
