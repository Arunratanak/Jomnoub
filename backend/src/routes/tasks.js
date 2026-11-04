import { Router } from 'express';
import { z } from 'zod';
import Task from '../models/Task.js';
import { logActivity, quote } from '../utils/activity.js';
import { isObjectId, objectIdSchema } from '../utils/validate.js';
import { createTaskLimiter } from '../middleware/rateLimit.js';

const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };

const router = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  deadline: z.coerce.date().min(new Date('2000-01-01')).max(new Date('2100-12-31')).nullable().optional(),
  assignee: objectIdSchema.nullable().optional(),
});
const updateSchema = createSchema.partial();

const isMember = (project, userId) => project.members.some((m) => m.user.equals(userId));
const canManage = (req) => req.role === 'owner' || req.task.createdBy.equals(req.user._id);
const populateTask = (task) => task.populate('assignee', 'name email picture');

async function loadTask(req, res, next) {
  const { taskId } = req.params;
  if (!isObjectId(taskId)) return res.status(404).json({ error: 'Not found' });
  // Always scoped to the project the user is a verified member of
  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) return res.status(404).json({ error: 'Not found' });
  req.task = task;
  next();
}

// List tasks in this project
router.get('/', async (req, res) => {
  const tasks = await Task.find({ project: req.project._id })
    .sort({ deadline: 1, createdAt: -1 })
    .populate('assignee', 'name email picture');
  res.json({ tasks });
});

// Create a task
router.post('/', createTaskLimiter, async (req, res) => {
  const data = createSchema.parse(req.body);
  if (data.assignee && !isMember(req.project, data.assignee)) {
    return res.status(400).json({ error: 'Assignee must be a member of this project' });
  }
  const task = await Task.create({
    ...data,
    project: req.project._id,
    createdBy: req.user._id,
  });
  await populateTask(task);
  await logActivity(req.project._id, req.user._id, `created task ${quote(task.title)}`);
  res.status(201).json({ task });
});

// Update a task
router.patch('/:taskId', loadTask, async (req, res) => {
  const updates = updateSchema.parse(req.body);
  const keys = Object.keys(updates);

  if (!canManage(req)) {
    const isAssignee = req.task.assignee?.equals(req.user._id);
    const onlyStatus = keys.length > 0 && keys.every((k) => k === 'status');
    if (!(isAssignee && onlyStatus)) return res.status(403).json({ error: 'Not allowed' });
  }

  if (updates.assignee && !isMember(req.project, updates.assignee)) {
    return res.status(400).json({ error: 'Assignee must be a member of this project' });
  }

  const oldStatus = req.task.status;
  const oldAssignee = req.task.assignee ? String(req.task.assignee) : null;

  Object.assign(req.task, updates);
  await req.task.save();
  await populateTask(req.task);

  const title = quote(req.task.title);
  if (updates.status && updates.status !== oldStatus) {
    await logActivity(req.project._id, req.user._id,
      `moved ${title} from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[updates.status]}`);
  }
  if ('assignee' in updates && (updates.assignee || null) !== oldAssignee) {
    await logActivity(req.project._id, req.user._id,
      req.task.assignee ? `assigned ${title} to ${req.task.assignee.name}` : `unassigned ${title}`);
  }
  res.json({ task: req.task });
});

// Delete a task
router.delete('/:taskId', loadTask, async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Not allowed' });
  await req.task.deleteOne();
  await logActivity(req.project._id, req.user._id, `deleted task ${quote(req.task.title)}`);
  res.json({ ok: true });
});

export default router;