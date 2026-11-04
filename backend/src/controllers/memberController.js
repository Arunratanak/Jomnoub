import { addMemberSchema } from '../validations/projectValidation.js';
import { addMemberByEmail, removeMember } from '../services/memberService.js';

// POST /api/projects/:projectId/members (owner)
export async function add(req, res) {
  const { email } = addMemberSchema.parse(req.body);
  const members = await addMemberByEmail(req.project, req.user, email);
  res.status(201).json({ members });
}

// DELETE /api/projects/:projectId/members/:userId (owner removes, or member leaves)
export async function remove(req, res) {
  await removeMember(req.project, req.user, req.role, req.params.userId);
  res.json({ ok: true });
}
