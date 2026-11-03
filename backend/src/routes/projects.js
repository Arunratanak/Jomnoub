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

export default router;