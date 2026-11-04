import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import requireAuth from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  // Only projects I'm still a member of, so tasks from projects I left never show up
  const projects = await Project.find({ 'members.user': req.user._id }).select('_id');

  const tasks = await Task.find({
    assignee: req.user._id,
    project: { $in: projects.map((p) => p._id) },
  })
    .populate('project', 'name')
    .lean();

  // Soonest deadline first, tasks without a deadline last
  tasks.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  res.json({ tasks });
});

export default router;