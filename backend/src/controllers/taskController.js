import { createTaskSchema, updateTaskSchema } from '../validations/taskValidation.js';
import * as taskService from '../services/taskService.js';

const context = (req) => ({ project: req.project, role: req.role, user: req.user, task: req.task });

// GET /api/projects/:projectId/tasks
export async function list(req, res) {
  res.json({ tasks: await taskService.listTasks(req.project) });
}

// POST /api/projects/:projectId/tasks
export async function create(req, res) {
  const task = await taskService.createTask(req.project, req.user, createTaskSchema.parse(req.body));
  res.status(201).json({ task });
}

// PATCH /api/projects/:projectId/tasks/:taskId
export async function update(req, res) {
  const task = await taskService.updateTask(context(req), updateTaskSchema.parse(req.body));
  res.json({ task });
}

// DELETE /api/projects/:projectId/tasks/:taskId
export async function remove(req, res) {
  await taskService.deleteTask(context(req));
  res.json({ ok: true });
}
