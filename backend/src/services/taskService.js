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
const TAKEN = 'Someone already has this task';
const MAX_SUBTASKS = 50;

const populateTask = (task) =>
  task.populate([
    { path: 'assignees', select: ASSIGNEE_FIELDS },
    { path: 'suggestedBy', select: 'name' },
    { path: 'startedBy', select: 'name' },
    { path: 'completedBy', select: 'name' },
  ]);

// Ids as strings, whether the people are loaded or not
const idOf = (person) => String(person?._id || person);
const assigneeIds = (task) => task.assignees.map(idOf);
const ownerIdOf = (project) => idOf(project.members.find((m) => m.role === 'owner')?.user);

// "Alex", "Alex and Sam", "Alex, Sam and Jordan"
function namesOf(people) {
  const names = people.map((p) => p.name);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

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

const notifyAssigned = ({ project, user, task }, people) =>
  notify(people, { actor: user._id, type: 'assigned', message: `assigned you to ${quote(task.title)}`, project: project._id, task: task._id });

// The owner can do anything to any task. A member can do anything to their own: one
// they are assigned to, or one they created that nobody has been given.
export const canManageTask = (role, task, userId) =>
  role === 'owner' || (task.assignees.length ? assigneeIds(task).includes(String(userId)) : task.createdBy.equals(userId));

// A suggestion waiting for the owner, with nobody else on the task, can't be worked on yet
const waitingOnOwner = (task) => Boolean(task.suggestedBy) && task.assignees.length === 0;

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
    .populate('assignees', ASSIGNEE_FIELDS)
    .populate('suggestedBy', 'name')
    .populate('startedBy', 'name')
    .populate('completedBy', 'name');
}

function requireMembers(project, ids) {
  if (ids.some((id) => !isMember(project, id))) throw new BadRequestError(NOT_A_MEMBER);
}

// Only the owner can give work to the owner. When a member includes the owner, the
// owner gets a suggestion to accept instead, and everyone else is assigned directly.
function splitChoice(project, role, ids) {
  const ownerId = ownerIdOf(project);
  const suggestOwner = role !== 'owner' && ids.includes(ownerId);
  return { assignees: suggestOwner ? ids.filter((id) => id !== ownerId) : ids, suggestOwner };
}

export async function createTask(context, data) {
  const { project, role, user } = context;
  const { separate, assignees: chosen = [], ...fields } = data;
  requireMembers(project, chosen);
  if (separate && chosen.length > 1) return createCopies(context, fields, chosen, `for ${chosen.length} members`);

  const { assignees, suggestOwner } = splitChoice(project, role, chosen);
  const task = await Task.create({
    ...fields,
    assignees,
    ...(suggestOwner ? { suggestedBy: user._id, suggestedAt: new Date() } : {}),
    ...(fields.status ? statusRecord({}, fields.status, user._id) : {}),
    project: project._id,
    createdBy: user._id,
  });
  await populateTask(task);

  await logActivity(project._id, user._id, `created task ${quote(task.title)}`);
  if (suggestOwner) await logActivity(project._id, user._id, `suggested ${quote(task.title)} for the owner`);
  await notifyAssigned({ project, user, task }, assignees);
  return task;
}

// One task for each person, so each moves their own through the stages. As with any
// task, a member's copy for the owner waits as a suggestion.
async function createCopies({ project, role, user }, fields, memberIds, whom) {
  const tasks = [];
  for (const memberId of memberIds) {
    const suggest = role !== 'owner' && memberId === ownerIdOf(project);
    const task = await Task.create({
      ...fields,
      assignees: suggest ? [] : [memberId],
      ...(suggest ? { suggestedBy: user._id, suggestedAt: new Date() } : {}),
      ...(fields.status ? statusRecord({}, fields.status, user._id) : {}),
      project: project._id,
      createdBy: user._id,
    });
    await populateTask(task);
    tasks.push(task);
    if (!suggest) await notifyAssigned({ project, user, task }, [memberId]);
  }
  await logActivity(project._id, user._id, `created task ${quote(fields.title)} ${whom}`);
  return tasks;
}

// "Assign to all": a copy for every member
export const createTaskForEveryone = (context, data) =>
  createCopies(context, data, context.project.members.map((m) => idOf(m.user)), `for all ${context.project.members.length} members`);

export async function updateTask({ project, role, user, task }, updates) {
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('You can only change your own tasks');
  if (updates.assignees) requireMembers(project, updates.assignees);
  // A suggestion has to be accepted before anyone works on it
  if (updates.status && updates.status !== task.status && waitingOnOwner(task)) {
    throw new ConflictError('The owner has to accept this task before it can be moved');
  }

  const oldStatus = task.status;
  const before = assigneeIds(task);
  const { assignees: chosen, ...fields } = updates;
  let newlySuggested = false;
  let added = [];

  if (chosen) {
    const { assignees, suggestOwner } = splitChoice(project, role, chosen);
    task.assignees = assignees;
    added = assignees.filter((id) => !before.includes(id));
    if (suggestOwner) {
      // A member included the owner: the owner is asked to confirm
      newlySuggested = !task.suggestedBy;
      if (newlySuggested) {
        task.suggestedBy = user._id;
        task.suggestedAt = new Date();
      }
    } else {
      // Any choice without the owner withdraws a pending suggestion
      task.suggestedBy = null;
      task.suggestedAt = null;
    }
  }

  if (fields.status && fields.status !== oldStatus) {
    Object.assign(fields, statusRecord(task, fields.status, user._id));
  }
  Object.assign(task, fields);
  await task.save();
  await populateTask(task);

  const title = quote(task.title);
  if (fields.status && fields.status !== oldStatus) {
    await logActivity(project._id, user._id,
      `moved ${title} from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[fields.status]}`);
  }
  const after = assigneeIds(task);
  if (chosen && (after.length !== before.length || after.some((id) => !before.includes(id)))) {
    await logActivity(project._id, user._id,
      after.length ? `assigned ${title} to ${namesOf(task.assignees)}` : `unassigned ${title}`);
    await notifyAssigned({ project, user, task }, added);
  }
  if (fields.status === 'done' && oldStatus !== 'done') {
    await notify([task.createdBy], { actor: user._id, type: 'task-done', message: `completed ${title}`, project: project._id, task: task._id });
  }
  if (newlySuggested) await logActivity(project._id, user._id, `suggested ${title} for the owner`);
  return task;
}

// Any member can pick up a task nobody has, for themselves only
export async function takeTask({ project, user, task }) {
  if (task.assignees.length || task.suggestedBy) throw new ConflictError(TAKEN);
  task.assignees = [user._id];
  await task.save();
  await populateTask(task);
  await logActivity(project._id, user._id, `took ${quote(task.title)}`);
  await notify([task.createdBy], { actor: user._id, type: 'task-taken', message: `took ${quote(task.title)}`, project: project._id, task: task._id });
  return task;
}

export async function deleteTask({ project, role, user, task }) {
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('You can only delete your own tasks');
  await deleteTaskAttachments(task._id);
  await deleteTaskComments(task._id);
  await task.deleteOne();
  await logActivity(project._id, user._id, `deleted task ${quote(task.title)}`);
  // Anyone with a stake in it should know it's gone
  await notify([ownerIdOf(project), task.createdBy, ...task.assignees], { actor: user._id, type: 'task-deleted', message: `deleted task ${quote(task.title)}`, project: project._id });
}

// ---------- Suggestions for the owner ----------
function requirePendingSuggestion(role, task) {
  if (role !== 'owner') throw new ForbiddenError('Owners only');
  if (!task.suggestedBy) throw new ConflictError('This task has no pending suggestion');
}

// The owner joins whoever else is already on the task
export async function acceptSuggestion({ project, role, user, task }) {
  requirePendingSuggestion(role, task);
  const suggester = task.suggestedBy;
  if (!assigneeIds(task).includes(String(user._id))) task.assignees.push(user._id);
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
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('Not allowed');
  if (task.subtasks.length >= MAX_SUBTASKS) throw new BadRequestError(`A task can have at most ${MAX_SUBTASKS} subtasks`);
  task.subtasks.push(data);
  await task.save();
  await populateTask(task);
  await logActivity(project._id, user._id, `added subtask ${quote(data.title)} to ${quote(task.title)}`);
  return task;
}

export async function updateSubtask({ project, role, user, task }, subtaskId, updates) {
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('Not allowed');
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
  if (!canManageTask(role, task, user._id)) throw new ForbiddenError('Not allowed');
  findSubtask(task, subtaskId).deleteOne();
  await task.save();
  await populateTask(task);
  return task;
}
