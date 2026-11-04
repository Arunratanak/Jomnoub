import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Invite from '../models/Invite.js';
import { deleteProjectActivity } from './activityService.js';
import { toProjectSummary } from '../dto/projectDto.js';
import { NotFoundError } from '../exceptions/HttpError.js';
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

// The creator becomes the owner
export function createProject(user, { name, description }) {
  return Project.create({ name, description, members: [{ user: user._id, role: 'owner' }] });
}

export async function listProjectsForUser(userId) {
  const projects = await Project.find({ 'members.user': userId }).sort({ updatedAt: -1 });
  return projects.map((p) => toProjectSummary(p, userId));
}

export const populateMembers = (project) => project.populate('members.user', MEMBER_FIELDS);

export async function updateProject(project, updates) {
  Object.assign(project, updates);
  await project.save();
  return populateMembers(project);
}

// Deletes the project and everything that belongs to it
export async function deleteProject(project) {
  await Task.deleteMany({ project: project._id });
  await Invite.deleteMany({ project: project._id });
  await deleteProjectActivity(project._id);
  await project.deleteOne();
}
