import Task from '../models/Task.js';
import { logActivity, quote } from './activityService.js';
import { deleteTaskAttachments } from './attachmentService.js';
import { deleteTaskComments } from './commentService.js';
import { notify } from './notificationService.js';
import { isMember, isProjectOwner } from './memberService.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const ASSIGNEE_FIELDS = 'name email picture';
const NOT_A_MEMBER = 'Assignee must be a member of this project';
const MAX_SUBTASKS = 50;

const populateTask = (task) =>
  task.populate([
    { path: 'assignee', select: ASSIGNEE_FIELDS },
    { path: 'suggestedBy', select: 'name' },
    { path: 'startedBy', select: 'name' },
    { path: 'completedBy', select: 'name' },
  ]);

// The record of who moved a task and when. Back to To do starts over; reopening a
// finished task clears the completion but keeps when work first started.
function statusRecord(task, status, userId) {
  if (status === 'todo') return { startedAt: null, startedBy: null, completedAt: null, completedBy: null };
  if (status === 'done') return { completedAt: new Date(), completedBy: userId };
  return {
    completedAt: null,
    completedBy: null,
    ...(task.startedAt ? {} : { startedAt: new Date(), startedBy: userId }),
  };
}

const notifyAssigned = ({ project, user, task }) =>
  notify([task.assignee._id], { actor: user._id, type: 'assigned', message: `assigned you to ${quote(task.title)}`, project: project._id, task: task._id });

// Owner of the project, or whoever created the task
export const canManageTask = (role, task, userId) => role === 'owner' || task.createdBy.equals(userId);

// The owner can delete any task. A member can delete their own: one assigned to them, or
// one they created that nobody else has been given.
const canDeleteTask = (role, task, userId) =>
  role === 'owner' || (task.assignee ? task.assignee.equals(userId) : task.createdBy.equals(userId));

// A task's stage belongs to the person doing it. With nobody assigned, its owner or
// creator can move it. A pending suggestion has to be accepted first.
function requireCanMove(role, task, userId) {
  if (task.suggestedBy) throw new ConflictError('The owner has to accept this task before it can be moved');
  if (task.assignee && !task.assignee.equals(userId)) {
    throw new ForbiddenError('Only the person assigned to this task can change its status');
  }
  if (!task.assignee && !canManageTask(role, task, userId)) throw new ForbiddenError('Not allowed');
}

// Managers and the task's assignee can work on its subtasks
const canEditSubtasks = (role, task, userId) => canManageTask(role, task, userId) || task.assignee?.equals(userId);

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
    .populate('assignee', ASSIGNEE_FIELDS)
    .populate('suggestedBy', 'name')
    .populate('startedBy', 'name')
    .populate('completedBy', 'name');
}

// Only the owner can give work to the owner; a member's request becomes a suggestion
const isSuggestionForOwner = (project, role, assignee) =>
  Boolean(assignee) && role !== 'owner' && isProjectOwner(project, assignee);

export async function createTask({ project, role, user }, data) {
  if (data.assignee && !isMember(project, data.assignee)) throw new BadRequestError(NOT_A_MEMBER);

  const suggest = isSuggestionForOwner(project, role, data.assignee);
  const task = await Task.create({
    ...data,
    ...(suggest ? { assignee: null, suggestedBy: user._id, suggestedAt: new Date() } : {}),
    ...(data.status ? statusRecord({}, data.status, user._id) : {}),
    project: project._id,
    createdBy: user._id,
  });
  await populateTask(task);

  await logActivity(project._id, user._id, `created task ${quote(task.title)}`);
  if (suggest) await logActivity(project._id, user._id, `suggested ${quote(task.title)} for the owner`);
  if (task.assignee) await notifyAssigned({ project, user, task });
  return task;
}

// "Assign to all": one task per member, so each person moves their own through the
// stages. As with any task, a member's copy for the owner waits as a suggestion.
export async function createTaskForEveryone({ project, role, user }, data) {
  const tasks = [];
  for (const { user: memberId } of project.members) {
    const suggest = isSuggestionForOwner(project, role, memberId);
    const task = await Task.create({
      ...data,
      assignee: suggest ? null : memberId,
      ...(suggest ? { suggestedBy: user._id, suggestedAt: new Date() } : {}),
      project: project._id,
      createdBy: user._id,
    });
    await populateTask(task);
    tasks.push(task);
    if (task.assignee) await notifyAssigned({ project, user, task });
  }
  await logActivity(project._id, user._id, `created task ${quote(data.title)} for all ${tasks.length} members`);
  return tasks;
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
  if (updates.status && updates.status !== task.status) requireCanMove(role, task, user._id);

  const oldStatus = task.status;
  const oldAssignee = task.assignee ? String(task.assignee) : null;
  const fields = { ...updates };
  let newlySuggested = false;

  if ('assignee' in updates) {
    const target = updates.assignee ? updates.assignee.toLowerCase() : null;
    if (target !== oldAssignee && isSuggestionForOwner(project, role, target)) {
      // A member picked the owner: the task waits for the owner's confirmation
      newlySuggested = !task.suggestedBy;
      fields.assignee = null;
      if (newlySuggested) {
        task.suggestedBy = user._id;
        task.suggestedAt = new Date();
      }
    } else {
      // Any other assignee choice replaces a pending suggestion
      fields.assignee = target;
      task.suggestedBy = null;
      task.suggestedAt = null;
    }
  }

  if (updates.status && updates.status !== oldStatus) {
    Object.assign(fields, statusRecord(task, updates.status, user._id));
  }
  Object.assign(task, fields);
  await task.save();
  await populateTask(task);

  const title = quote(task.title);
  if (updates.status && updates.status !== oldStatus) {
    await logActivity(project._id, user._id,
      `moved ${title} from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[updates.status]}`);
  }
  if ('assignee' in fields && (fields.assignee || null) !== oldAssignee) {
    await logActivity(project._id, user._id,
      task.assignee ? `assigned ${title} to ${task.assignee.name}` : `unassigned ${title}`);
    if (task.assignee) await notifyAssigned({ project, user, task });
  }
  if (updates.status === 'done' && oldStatus !== 'done') {
    await notify([task.createdBy], { actor: user._id, type: 'task-done', message: `completed ${title}`, project: project._id, task: task._id });
  }
  if (newlySuggested) await logActivity(project._id, user._id, `suggested ${title} for the owner`);
  return task;
}

export async function deleteTask({ project, role, user, task }) {
  if (!canDeleteTask(role, task, user._id)) throw new ForbiddenError('You can only delete your own tasks');
  await deleteTaskAttachments(task._id);
  await deleteTaskComments(task._id);
  await task.deleteOne();
  await logActivity(project._id, user._id, `deleted task ${quote(task.title)}`);
}

// ---------- Suggestions for the owner ----------
function requirePendingSuggestion(role, task) {
  if (role !== 'owner') throw new ForbiddenError('Owners only');
  if (!task.suggestedBy) throw new ConflictError('This task has no pending suggestion');
}

export async function acceptSuggestion({ project, role, user, task }) {
  requirePendingSuggestion(role, task);
  const suggester = task.suggestedBy;
  task.assignee = user._id;
  task.suggestedBy = null;
  task.suggestedAt = null;
  await task.save();
  await populateTask(task);
  await logActivity(project._id, user._id, `accepted the suggestion for ${quote(task.title)}`);
  await notify([suggester], { actor: user._id, type: 'suggestion-accepted', message: `accepted your suggestion for ${quote(task.title)}`, project: project._id, task: task._id });
  return task;
}

export async function declineSuggestion({ project, role, user, task }) {
  requirePendingSuggestion(role, task);
  const suggester = task.suggestedBy;
  task.suggestedBy = null;
  task.suggestedAt = null;
  await task.save();
  await populateTask(task);
  await logActivity(project._id, user._id, `declined the suggestion for ${quote(task.title)}`);
  await notify([suggester], { actor: user._id, type: 'suggestion-declined', message: `declined your suggestion for ${quote(task.title)}`, project: project._id, task: task._id });
  return task;
}

// ---------- Subtasks ----------
function findSubtask(task, subtaskId) {
  const subtask = isObjectId(subtaskId) ? task.subtasks.id(subtaskId) : null;
  if (!subtask) throw new NotFoundError();
  return subtask;
}

export async function addSubtask({ project, role, user, task }, data) {
  if (!canEditSubtasks(role, task, user._id)) throw new ForbiddenError('Not allowed');
  if (task.subtasks.length >= MAX_SUBTASKS) throw new BadRequestError(`A task can have at most ${MAX_SUBTASKS} subtasks`);
  task.subtasks.push(data);
  await task.save();
  await populateTask(task);
  await logActivity(project._id, user._id, `added subtask ${quote(data.title)} to ${quote(task.title)}`);
  return task;
}

export async function updateSubtask({ project, role, user, task }, subtaskId, updates) {
  if (!canEditSubtasks(role, task, user._id)) throw new ForbiddenError('Not allowed');
  const subtask = findSubtask(task, subtaskId);
  const justCompleted = updates.done === true && !subtask.done;
  Object.assign(subtask, updates);
  await task.save();
  await populateTask(task);
  if (justCompleted) {
    await logActivity(project._id, user._id, `completed subtask ${quote(subtask.title)} in ${quote(task.title)}`);
  }
  return task;
}

export async function deleteSubtask({ role, user, task }, subtaskId) {
  if (!canEditSubtasks(role, task, user._id)) throw new ForbiddenError('Not allowed');
  findSubtask(task, subtaskId).deleteOne();
  await task.save();
  await populateTask(task);
  return task;
}
