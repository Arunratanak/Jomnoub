import { Router } from 'express';
import { messageLimiter } from '../middlewares/rateLimit.js';
import * as messages from '../controllers/messageController.js';

// Mounted at /api/projects/:projectId/messages, behind requireAuth + requireMember
const router = Router({ mergeParams: true });

router.get('/', messages.list);
router.post('/', messageLimiter, messages.create);
router.delete('/:messageId', messages.remove);

export default router;
