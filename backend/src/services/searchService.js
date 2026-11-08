import Project from '../models/Project.js';
import Task from '../models/Task.js';

const MAX_PROJECTS = 5;
const MAX_TASKS = 8;

// The search text is matched literally: characters like . * ( have no special meaning
const literal = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// Projects and tasks matching the text, only from projects the user belongs to
export async function search(userId, text) {
  const pattern = literal(text);
  const mine = await Project.find({ 'members.user': userId }).select('name description').lean();

  const projects = mine
    .filter((p) => pattern.test(p.name) || pattern.test(p.description || ''))
    .slice(0, MAX_PROJECTS)
    .map((p) => ({ id: p._id, name: p.name, description: p.description || '' }));

  const found = await Task.find({
    project: { $in: mine.map((p) => p._id) },
    $or: [{ title: pattern }, { description: pattern }],
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_TASKS * 4)
    .select('title status deadline project assignees')
    .populate('project', 'name')
    .populate('assignees', 'name picture')
    .lean();

  // Unfinished work first, then the most recently changed
  const tasks = [...found.filter((t) => t.status !== 'done'), ...found.filter((t) => t.status === 'done')].slice(0, MAX_TASKS);
  return { projects, tasks };
}
