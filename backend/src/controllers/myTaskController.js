import { listMyTasks, listSuggestionsForOwner } from '../services/myTaskService.js';

// GET /api/my-tasks: my assigned tasks, plus suggestions waiting for me as an owner
export async function list(req, res) {
  const [tasks, suggestions] = await Promise.all([
    listMyTasks(req.user._id),
    listSuggestionsForOwner(req.user._id),
  ]);
  res.json({ tasks, suggestions });
}
