import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Task from '../models/Task.js';

const router = Router({ mergeParams: true });

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  deadline: z.coerce.date().nullable().optional(),
  assignee: objectId.nullable().optional(),
});
const updateSchema = createSchema.partial();

const isMember = (project, userId) => project.members.some((m) => m.user.equals(userId));
const canManage = (req) => req.role === 'owner' || req.task.createdBy.equals(req.user._id);
const populateTask = (task) => task.populate('assignee', 'name email picture');

async function loadTask(req, res, next) {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) return res.status(404).json({ error: 'Not found' });
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
router.post('/', async (req, res) => {
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

  Object.assign(req.task, updates);
  await req.task.save();
  await populateTask(req.task);
  res.json({ task: req.task });
});

// Delete a task
router.delete('/:taskId', loadTask, async (req, res) => {
  if (!canManage(req)) return res.status(403).json({ error: 'Not allowed' });
  await req.task.deleteOne();
  res.json({ ok: true });
});

export default router;