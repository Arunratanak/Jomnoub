import { listMyTasks } from '../services/myTaskService.js';

// GET /api/my-tasks
export async function list(req, res) {
  res.json({ tasks: await listMyTasks(req.user._id) });
}
