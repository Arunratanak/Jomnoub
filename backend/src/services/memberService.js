import User, { VERIFIED_EMAIL_FILTER } from '../models/User.js';
import Task from '../models/Task.js';
import { logActivity, quote } from './activityService.js';
import { deleteUserProjectNotifications, notify } from './notificationService.js';
import { populateMembers } from './projectService.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

export const isMember = (project, userId) => project.members.some((m) => m.user.equals(userId));

export const isProjectOwner = (project, userId) =>
  project.members.some((m) => m.role === 'owner' && m.user.equals(userId));

// Owner adds someone by email. They must have signed in to Jomnoub once.
export async function addMemberByEmail(project, actor, email) {
  // Unverified password accounts could have been registered with someone else's
  // address, so they join by invite link until they've verified it.
  const user = await User.findOne({ email, ...VERIFIED_EMAIL_FILTER });
  if (!user) throw new NotFoundError('No verified Jomnoub user with that email. Send them an invite link instead.');
  if (isMember(project, user._id)) throw new ConflictError('That person is already a member');

  project.members.push({ user: user._id, role: 'member' });
  await project.save();
  await logActivity(project._id, actor._id, `added ${user.name} to the project`);
  await notify([user._id], { actor: actor._id, type: 'added', message: `added you to ${quote(project.name)}`, project: project._id });
  await populateMembers(project);
  return project.members;
}

// Owner removes a member, or a member removes themselves (leaves).
// The last owner can't be removed; the removed person's tasks become unassigned
// and any suggestions they made are withdrawn.
export async function removeMember(project, actor, actorRole, userId) {
  if (!isObjectId(userId)) throw new NotFoundError();

  const isSelf = actor._id.equals(userId);
  if (actorRole !== 'owner' && !isSelf) throw new ForbiddenError('Owners only');

  const member = project.members.find((m) => m.user.equals(userId));
  if (!member) throw new NotFoundError();
  const ownerCount = project.members.filter((m) => m.role === 'owner').length;
  if (member.role === 'owner' && ownerCount === 1) {
    throw new BadRequestError('The last owner cannot be removed. Delete the project instead.');
  }

  project.members = project.members.filter((m) => !m.user.equals(userId));
  await project.save();
  // Keep the rule "assignees must be members": unassign their tasks in this project
  await Task.updateMany({ project: project._id, assignee: userId }, { assignee: null });
  await Task.updateMany({ project: project._id, suggestedBy: userId }, { suggestedBy: null, suggestedAt: null });
  // Their old notifications link into a project they can no longer open
  await deleteUserProjectNotifications(userId, project._id);

  if (isSelf) {
    await logActivity(project._id, actor._id, 'left the project');
    const owners = project.members.filter((m) => m.role === 'owner').map((m) => m.user);
    await notify(owners, { actor: actor._id, type: 'member-left', message: `left ${quote(project.name)}`, project: project._id });
  } else {
    const removed = await User.findById(userId).select('name').lean();
    await logActivity(project._id, actor._id, `removed ${removed?.name || 'a member'} from the project`);
    await notify([userId], { actor: actor._id, type: 'removed', message: `removed you from ${quote(project.name)}`, project: project._id });
  }
}
