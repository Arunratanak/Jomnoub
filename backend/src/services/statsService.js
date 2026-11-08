import Task from '../models/Task.js';
import User from '../models/User.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Progress statistics for one project: completion, counts by status,
// overdue / due within 7 days (open tasks only), and workload per person (a shared task
// counts once for each of its people)
export async function getProjectStats(project) {
  const tasks = await Task.find({ project: project._id })
    .select('status deadline assignees suggestedBy')
    .populate('assignees', 'name')
    .lean();

  // A suggestion waiting for the owner counts as the owner's work
  const ownerId = project.members.find((m) => m.role === 'owner')?.user;
  const owner = tasks.some((t) => t.suggestedBy) && ownerId
    ? await User.findById(ownerId).select('name').lean()
    : null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // deadlines are stored as UTC dates
  const weekAhead = new Date(today.getTime() + 7 * DAY_MS);

  const byStatus = { todo: 0, 'in-progress': 0, done: 0 };
  let overdue = 0;
  let dueThisWeek = 0;
  const workload = new Map();

  for (const t of tasks) {
    byStatus[t.status] += 1;
    const open = t.status !== 'done';

    if (open && t.deadline) {
      if (t.deadline < today) overdue += 1;
      else if (t.deadline <= weekAhead) dueThisWeek += 1;
    }

    const people = t.assignees.length ? t.assignees : t.suggestedBy && owner ? [owner] : [null];
    for (const person of people) {
      const key = person ? String(person._id) : 'unassigned';
      const entry = workload.get(key) || { name: person?.name || 'Unassigned', open: 0, done: 0 };
      if (open) entry.open += 1;
      else entry.done += 1;
      workload.set(key, entry);
    }
  }

  const total = tasks.length;
  return {
    total,
    done: byStatus.done,
    completion: total ? Math.round((byStatus.done / total) * 100) : 0,
    byStatus,
    overdue,
    dueThisWeek,
    workload: [...workload.values()],
  };
}
