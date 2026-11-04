import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { requireMember, requireOwner } from '../middlewares/requireMember.js';
import { createProjectLimiter, inviteLimiter } from '../middlewares/rateLimit.js';
import taskRoutes from './taskRoutes.js';
import * as projects from '../controllers/projectController.js';
import * as members from '../controllers/memberController.js';
import * as invites from '../controllers/inviteController.js';

// Mounted at /api/projects. Every route requires login; every /:projectId
// route also requires membership (non-members get 404).
const router = Router();
router.use(requireAuth);
router.use('/:projectId/tasks', requireMember, taskRoutes);

router.post('/', createProjectLimiter, projects.create);
router.get('/', projects.list);

router.get('/:projectId', requireMember, projects.getOne);
router.patch('/:projectId', requireMember, requireOwner, projects.update);
router.delete('/:projectId', requireMember, requireOwner, projects.remove);

router.get('/:projectId/stats', requireMember, projects.stats);
router.get('/:projectId/activity', requireMember, projects.activity);

router.post('/:projectId/members', requireMember, requireOwner, members.add);
router.delete('/:projectId/members/:userId', requireMember, members.remove);

router.post('/:projectId/invites', inviteLimiter, requireMember, requireOwner, invites.create);
router.delete('/:projectId/invites', requireMember, requireOwner, invites.disable);

export default router;
