import { createMessageSchema, listMessagesSchema } from '../validations/messageValidation.js';
import * as messageService from '../services/messageService.js';

// GET /api/projects/:projectId/messages[?before=<id>&limit=50]
export async function list(req, res) {
  res.json(await messageService.listMessages(req.project._id, listMessagesSchema.parse(req.query)));
}

// POST /api/projects/:projectId/messages
export async function create(req, res) {
  const { text } = createMessageSchema.parse(req.body);
  res.status(201).json({ message: await messageService.createMessage(req.project, req.user, text) });
}

// DELETE /api/projects/:projectId/messages/:messageId (author or owner)
export async function remove(req, res) {
  await messageService.deleteMessage({ project: req.project, role: req.role, user: req.user }, req.params.messageId);
  res.json({ ok: true });
}
