import { Router } from 'express';
import loadTask from '../middlewares/loadTask.js';
import { commentLimiter, createTaskLimiter, uploadLimiter } from '../middlewares/rateLimit.js';
import * as comments from '../controllers/commentController.js';
import * as tasks from '../controllers/taskController.js';
import * as attachments from '../controllers/attachmentController.js';

// Mounted at /api/projects/:projectId/tasks, behind requireAuth + requireMember
const router = Router({ mergeParams: true });

router.get('/', tasks.list);
router.post('/', createTaskLimiter, tasks.create);
router.post('/assign-all', createTaskLimiter, tasks.createForEveryone);
router.patch('/:taskId', loadTask, tasks.update);
router.delete('/:taskId', loadTask, tasks.remove);
router.post('/:taskId/take', loadTask, tasks.take);

router.post('/:taskId/suggestion/accept', loadTask, tasks.acceptSuggestion);
router.post('/:taskId/suggestion/decline', loadTask, tasks.declineSuggestion);

router.post('/:taskId/subtasks', loadTask, tasks.addSubtask);
router.patch('/:taskId/subtasks/:subtaskId', loadTask, tasks.updateSubtask);
router.delete('/:taskId/subtasks/:subtaskId', loadTask, tasks.removeSubtask);

router.get('/:taskId/comments', loadTask, comments.list);
router.post('/:taskId/comments', commentLimiter, loadTask, comments.create);
router.delete('/:taskId/comments/:commentId', loadTask, comments.remove);

router.get('/:taskId/attachments', loadTask, attachments.list);
router.post('/:taskId/attachments', uploadLimiter, loadTask, attachments.upload);
router.get('/:taskId/attachments/:attachmentId/download', loadTask, attachments.download);
router.delete('/:taskId/attachments/:attachmentId', loadTask, attachments.remove);

export default router;
