import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Project from '../models/Project.js';
import User from '../models/User.js';
import taskRoutes from './tasks.js';
import Task from '../models/Task.js';
import requireAuth from '../middleware/auth.js';
import { requireMember, requireOwner } from '../middleware/requireMember.js';

const router = Router();
router.use(requireAuth);
router.use('/:projectId/tasks', requireMember, taskRoutes);

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().default(''),
});
// Separate schema without .default(), so a PATCH that omits description doesn't wipe it
const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
});
const addMemberSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const memberSelect = 'name email picture';

// Create a project (the creator becomes its owner)
router.post('/', async (req, res) => {
  const { name, description } = createSchema.parse(req.body);
  const project = await Project.create({
    name,
    description,
    members: [{ user: req.user._id, role: 'owner' }],
  });
  res.status(201).json({ project });
});

// List only the projects I belong to
router.get('/', async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id }).sort({ updatedAt: -1 });
  res.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      memberCount: p.members.length,
      role: p.members.find((m) => m.user.equals(req.user._id)).role,
      updatedAt: p.updatedAt,
    })),
  });
});

// View one project
router.get('/:projectId', requireMember, async (req, res) => {
  await req.project.populate('members.user', memberSelect);
  res.json({ project: req.project, role: req.role });
});

// Edit (owner only)
router.patch('/:projectId', requireMember, requireOwner, async (req, res) => {
  const updates = updateSchema.parse(req.body);
  Object.assign(req.project, updates);
  await req.project.save();
  await req.project.populate('members.user', memberSelect);
  res.json({ project: req.project });
});

// Delete (owner only)
router.delete('/:projectId', requireMember, requireOwner, async (req, res) => {
  await Task.deleteMany({ project: req.project._id });
  await req.project.deleteOne();
  res.json({ ok: true });
});

// Add a member by email (owner only). The person must have signed in to TaskHub once.
router.post('/:projectId/members', requireMember, requireOwner, async (req, res) => {
  const { email } = addMemberSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ error: 'No TaskHub user with that email. They need to sign in once first.' });
  }
  if (req.project.members.some((m) => m.user.equals(user._id))) {
    return res.status(409).json({ error: 'That person is already a member' });
  }

  req.project.members.push({ user: user._id, role: 'member' });
  await req.project.save();
  await req.project.populate('members.user', memberSelect);
  res.status(201).json({ members: req.project.members });
});

// Remove a member (owner), or leave the project (any non-owner member removing themselves)
router.delete('/:projectId/members/:userId', requireMember, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) return res.status(404).json({ error: 'Not found' });

  const isSelf = req.user._id.equals(userId);
  if (req.role !== 'owner' && !isSelf) return res.status(403).json({ error: 'Owners only' });

  const member = req.project.members.find((m) => m.user.equals(userId));
  if (!member) return res.status(404).json({ error: 'Not found' });
  if (member.role === 'owner') {
    return res.status(400).json({ error: 'The owner cannot leave. Delete the project instead.' });
  }

  req.project.members = req.project.members.filter((m) => !m.user.equals(userId));
  await req.project.save();
  // Keep the rule "assignees must be members": unassign their tasks in this project
  await Task.updateMany({ project: req.project._id, assignee: userId }, { assignee: null });
  res.json({ ok: true });
});

// Progress statistics for one project
router.get('/:projectId/stats', requireMember, async (req, res) => {
  const tasks = await Task.find({ project: req.project._id })
    .select('status deadline assignee')
    .populate('assignee', 'name')
    .lean();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // deadlines are stored as UTC dates
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const byStatus = { todo: 0, 'in-progress': 0, done: 0 };
  let overdue = 0;
  let dueThisWeek = 0;
  const workload = new Map();

  for (const t of tasks) {
    byStatus[t.status] += 1;
    const open = t.status !== 'done';

    if (open && t.deadline) {
      if (t.deadline < today) overdue += 1;
      else if (t.deadline <= weekAhead) dueThisWeek += 1;
    }

    const key = t.assignee ? String(t.assignee._id) : 'unassigned';
    const entry = workload.get(key) || { name: t.assignee?.name || 'Unassigned', open: 0, done: 0 };
    if (open) entry.open += 1;
    else entry.done += 1;
    workload.set(key, entry);
  }

  const total = tasks.length;
  res.json({
    stats: {
      total,
      done: byStatus.done,
      completion: total ? Math.round((byStatus.done / total) * 100) : 0,
      byStatus,
      overdue,
      dueThisWeek,
      workload: [...workload.values()],
    },
  });
});

export default router;