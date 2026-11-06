import { createCommentSchema } from '../validations/commentValidation.js';
import * as comments from '../services/commentService.js';

const context = (req) => ({ project: req.project, role: req.role, user: req.user, task: req.task });

// GET /api/projects/:projectId/tasks/:taskId/comments
export async function list(req, res) {
  res.json({ comments: await comments.listComments(req.task) });
}

// POST /api/projects/:projectId/tasks/:taskId/comments
export async function create(req, res) {
  const { text } = createCommentSchema.parse(req.body);
  res.status(201).json({ comment: await comments.addComment(context(req), text) });
}

// DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId (author or owner)
export async function remove(req, res) {
  await comments.deleteComment(context(req), req.params.commentId);
  res.json({ ok: true });
}
