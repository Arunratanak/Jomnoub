import { Router } from 'express';
import loadTask from '../middlewares/loadTask.js';
import { createTaskLimiter } from '../middlewares/rateLimit.js';
import * as tasks from '../controllers/taskController.js';

// Mounted at /api/projects/:projectId/tasks, behind requireAuth + requireMember
const router = Router({ mergeParams: true });

router.get('/', tasks.list);
router.post('/', createTaskLimiter, tasks.create);
router.patch('/:taskId', loadTask, tasks.update);
router.delete('/:taskId', loadTask, tasks.remove);

export default router;
