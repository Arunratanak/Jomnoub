import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import * as notifications from '../controllers/notificationController.js';

// Mounted at /api/notifications. Always limited to the signed-in user's own inbox.
const router = Router();
router.use(requireAuth);

router.get('/', notifications.list);
router.post('/read-all', notifications.readAll);
router.post('/:notificationId/read', notifications.read);

export default router;
