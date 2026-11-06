import Invite, { INVITE_TTL_MS, hashToken, newToken } from '../models/Invite.js';
import Project from '../models/Project.js';
import { logActivity, quote } from './activityService.js';
import { notify } from './notificationService.js';
import { NotFoundError } from '../exceptions/HttpError.js';

const INVALID_INVITE = 'This invite link is invalid or has expired.';

// Only one link is active per project: generating a new one invalidates the old one.
// The raw token is returned once; the database keeps just its hash.
export async function createInvite(project, user) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await Invite.deleteMany({ project: project._id });
  await Invite.create({ project: project._id, tokenHash: hashToken(token), createdBy: user._id, expiresAt });
  return { token, expiresAt };
}

export const disableInvites = (project) => Invite.deleteMany({ project: project._id });

// A valid, unexpired invite and its project. Invalid, expired and
// deleted-project invites all get the same 404.
export async function findValidInvite(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new NotFoundError(INVALID_INVITE);
  const invite = await Invite.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  const project = invite && (await Project.findById(invite.project));
  if (!project) throw new NotFoundError(INVALID_INVITE);
  return { invite, project };
}

// Joins as a member. Atomic, so accepting twice never adds the user twice.
export async function acceptInvite(project, user) {
  const result = await Project.updateOne(
    { _id: project._id, 'members.user': { $ne: user._id } },
    { $push: { members: { user: user._id, role: 'member' } } }
  );
  // Only log a real join, not a second click by an existing member
  if (result.modifiedCount === 1) {
    await logActivity(project._id, user._id, 'joined via invite link');
    const owners = project.members.filter((m) => m.role === 'owner').map((m) => m.user);
    await notify(owners, { actor: user._id, type: 'member-joined', message: `joined ${quote(project.name)}`, project: project._id });
  }
  return project.id;
}
