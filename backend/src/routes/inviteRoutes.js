import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import loadInvite from '../middlewares/loadInvite.js';
import { inviteLimiter } from '../middlewares/rateLimit.js';
import * as invites from '../controllers/inviteController.js';

// Mounted at /api/invites. Creating and disabling links is in projectRoutes.js.
const router = Router();
router.use(requireAuth);

router.get('/:token', loadInvite, invites.preview);
router.post('/:token/accept', inviteLimiter, loadInvite, invites.accept);

export default router;
