import Task from '../models/Task.js';
import { logActivity, quote } from './activityService.js';
import { isMember } from './memberService.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const ASSIGNEE_FIELDS = 'name email picture';
const NOT_A_MEMBER = 'Assignee must be a member of this project';

const populateTask = (task) => task.populate('assignee', ASSIGNEE_FIELDS);

// Owner of the project, or whoever created the task
export const canManageTask = (role, task, userId) => role === 'owner' || task.createdBy.equals(userId);

// Always scoped to the project the user is a verified member of
export async function findTaskInProject(project, taskId) {
  if (!isObjectId(taskId)) throw new NotFoundError();
  const task = await Task.findOne({ _id: taskId, project: project._id });
  if (!task) throw new NotFoundError();
  return task;
}

export function listTasks(project) {
  return Task.find({ project: project._id })
    .sort({ deadline: 1, createdAt: -1 })
    .populate('assignee', ASSIGNEE_FIELDS);
}

export async function createTask(project, user, data) {
  if (data.assignee && !isMember(project, data.assignee)) throw new BadRequestError(NOT_A_MEMBER);
  const task = await Task.create({ ...data, project: project._id, createdBy: user._id });
  await populateTask(task);
  await logActivity(project._id, user._id, `created task ${quote(task.title)}`);
  return task;
}

// Managers can change anything; the assignee may change only the status
export async function updateTask({ project, role, user, task }, updates) {
  const keys = Object.keys(updates);
  if (!canManageTask(role, task, user._id)) {
    const isAssignee = task.assignee?.equals(user._id);
    const onlyStatus = keys.length > 0 && keys.every((k) => k === 'status');
    if (!(isAssignee && onlyStatus)) throw new ForbiddenError('Not allowed');
  }
  if (updates.assignee && !isMember(project, updates.assignee)) throw new BadRequestError(NOT_A_MEMBER);

  const oldStatus = task.status;
  const oldAssignee = task.assignee ? String(task.assignee) : null;

  Object.assign(task, updates);
  await task.save();
  await populateTask(task);

  const title = quote(task.title);
  if (updates.status && updates.status !== oldStatus) {
    await logActivity(project._id, user._id,
      `moved ${title} from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[updates.status]}`);
  }
  if ('assignee' in updates && (updates.assignee || null) !== oldAssignee) {
    await logActivity(project._id, user._id,
      task.assignee ? `assigned ${title} to ${task.assignee.name}` : `unassigned ${title}`);
  }
  return task;
}

export async function deleteTask({ project, role, user, task }) {
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('Not allowed');
  await task.deleteOne();
  await logActivity(project._id, user._id, `deleted task ${quote(task.title)}`);
}
