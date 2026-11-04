import { Router } from 'express';
import { z } from 'zod';
import Project from '../models/Project.js';
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
const updateSchema = createSchema.partial();



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
  await req.project.populate('members.user', 'name email picture');
  res.json({ project: req.project, role: req.role });
});

// Edit (owner only)
router.patch('/:projectId', requireMember, requireOwner, async (req, res) => {
  const updates = updateSchema.parse(req.body);
  Object.assign(req.project, updates);
  await req.project.save();
  res.json({ project: req.project });
});

// Delete (owner only)
router.delete('/:projectId', requireMember, requireOwner, async (req, res) => {
  await Task.deleteMany({ project: req.project._id });
  await req.project.deleteOne();
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