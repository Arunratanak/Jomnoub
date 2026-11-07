import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Invite from '../models/Invite.js';
import { findTemplate, PROJECT_TEMPLATES } from '../data/projectTemplates.js';
import { deleteProjectActivity, logActivity, quote } from './activityService.js';
import { deleteProjectMessages } from './messageService.js';
import { deleteProjectAttachments } from './attachmentService.js';
import { deleteProjectComments } from './commentService.js';
import { deleteProjectNotifications } from './notificationService.js';
import { toProjectSummary } from '../dto/projectDto.js';
import { BadRequestError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

export const MEMBER_FIELDS = 'name email picture';

// The project, only if the user is a member. Non-members get the same 404 as a
// missing project, so they can't tell whether it exists.
export async function findProjectForMember(projectId, userId) {
  if (!isObjectId(projectId)) throw new NotFoundError();
  const project = await Project.findOne({ _id: projectId, 'members.user': userId });
  if (!project) throw new NotFoundError();
  const role = project.members.find((m) => m.user.equals(userId)).role;
  return { project, role };
}

// What the New project form shows: enough to choose one, without the task descriptions
export const listTemplates = () => PROJECT_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  tasks: t.tasks.map((task) => task.title),
}));

// The board shows newest first, so the template's first task gets the newest time
function addTemplateTasks(project, user, template) {
  const now = Date.now();
  return Task.insertMany(template.tasks.map((task, index) => ({
    ...task,
    subtasks: task.subtasks.map((title) => ({ title })),
    project: project._id,
    createdBy: user._id,
    createdAt: new Date(now - index),
  })));
}

// The creator becomes the owner
export async function createProject(user, { name, description, template: templateId }) {
  const template = templateId ? findTemplate(templateId) : null;
  if (templateId && !template) throw new BadRequestError('That template doesn\'t exist.');

  const project = await Project.create({ name, description, members: [{ user: user._id, role: 'owner' }] });
  if (template) {
    try {
      await addTemplateTasks(project, user, template);
    } catch (err) {
      // Don't leave a half-filled project behind: they can simply try again
      await Task.deleteMany({ project: project._id });
      await project.deleteOne();
      throw err;
    }
    await logActivity(project._id, user._id, `started this project from the ${quote(template.name)} template`);
  }
  return project;
}

export async function listProjectsForUser(userId) {
  const projects = await Project.find({ 'members.user': userId }).sort({ updatedAt: -1 });
  const counts = await Task.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  const byProject = new Map(counts.map((c) => [String(c._id), c]));
  return projects.map((p) => toProjectSummary(p, userId, byProject.get(p.id)));
}

export const populateMembers = (project) => project.populate('members.user', MEMBER_FIELDS);

export async function updateProject(project, updates) {
  Object.assign(project, updates);
  await project.save();
  return populateMembers(project);
}

// Deletes the project and everything that belongs to it
export async function deleteProject(project) {
  await deleteProjectAttachments(project._id);
  await Task.deleteMany({ project: project._id });
  await Invite.deleteMany({ project: project._id });
  await deleteProjectActivity(project._id);
  await deleteProjectMessages(project._id);
  await deleteProjectComments(project._id);
  await deleteProjectNotifications(project._id);
  await project.deleteOne();
}
