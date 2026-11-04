import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import * as myTasks from '../controllers/myTaskController.js';

// Mounted at /api/my-tasks
const router = Router();
router.use(requireAuth);

router.get('/', myTasks.list);

export default router;
