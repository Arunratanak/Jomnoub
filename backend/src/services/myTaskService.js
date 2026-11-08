import Project from '../models/Project.js';
import Task from '../models/Task.js';

// Tasks assigned to the user, only in projects they're still a member of
// (so tasks from projects they left never show up). Soonest deadline first,
// tasks without a deadline last.
export async function listMyTasks(userId) {
  const projects = await Project.find({ 'members.user': userId }).select('_id');

  const tasks = await Task.find({ assignees: userId, project: { $in: projects.map((p) => p._id) } })
    .populate('project', 'name')
    .lean();

  return tasks.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
}

// Tasks waiting for this user's confirmation, in the projects they own
export async function listSuggestionsForOwner(userId) {
  const owned = await Project.find({ members: { $elemMatch: { user: userId, role: 'owner' } } }).select('_id');
  return Task.find({ project: { $in: owned.map((p) => p._id) }, suggestedBy: { $ne: null } })
    .sort({ suggestedAt: 1 })
    .populate('project', 'name')
    .populate('suggestedBy', 'name')
    .lean();
}
