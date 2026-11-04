import { Router } from 'express';
import Invite, { hashToken } from '../models/Invite.js';
import Project from '../models/Project.js';
import requireAuth from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Look up a valid, unexpired invite and its project. Invalid, expired and
// deleted-project invites all get the same 404.
async function loadInvite(req, res, next) {
  const { token } = req.params;
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
    return res.status(404).json({ error: 'This invite link is invalid or has expired.' });
  }

  const invite = await Invite.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  const project = invite && (await Project.findById(invite.project));
  if (!project) return res.status(404).json({ error: 'This invite link is invalid or has expired.' });

  req.invite = invite;
  req.project = project;
  next();
}

const isMember = (project, userId) => project.members.some((m) => m.user.equals(userId));

// Preview: which project the link is for (shown before joining)
router.get('/:token', loadInvite, (req, res) => {
  res.json({
    invite: {
      projectId: req.project.id,
      projectName: req.project.name,
      memberCount: req.project.members.length,
      expiresAt: req.invite.expiresAt,
      alreadyMember: isMember(req.project, req.user._id),
    },
  });
});

// Accept: join as a member (joining twice is harmless)
router.post('/:token/accept', loadInvite, async (req, res) => {
  // Atomic: only adds the user if they aren't already in members
  await Project.updateOne(
    { _id: req.project._id, 'members.user': { $ne: req.user._id } },
    { $push: { members: { user: req.user._id, role: 'member' } } }
  );
  res.json({ projectId: req.project.id });
});

export default router;
