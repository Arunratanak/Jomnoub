import { createInvite, disableInvites, acceptInvite } from '../services/inviteService.js';
import { toInvitePreview } from '../dto/inviteDto.js';

// POST /api/projects/:projectId/invites (owner)
export async function create(req, res) {
  res.status(201).json(await createInvite(req.project, req.user));
}

// DELETE /api/projects/:projectId/invites (owner)
export async function disable(req, res) {
  await disableInvites(req.project);
  res.json({ ok: true });
}

// GET /api/invites/:token
export function preview(req, res) {
  res.json({ invite: toInvitePreview(req.invite, req.project, req.user._id) });
}

// POST /api/invites/:token/accept
export async function accept(req, res) {
  res.json({ projectId: await acceptInvite(req.project, req.user) });
}
