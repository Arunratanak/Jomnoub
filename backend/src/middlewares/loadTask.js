import { findTaskInProject } from '../services/taskService.js';

// Loads :taskId inside the already-verified req.project; sets req.task
export default async function loadTask(req, res, next) {
  req.task = await findTaskInProject(req.project, req.params.taskId);
  next();
}
