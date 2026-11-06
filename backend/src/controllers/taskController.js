import {
  assignToAllSchema, createTaskSchema, updateTaskSchema, createSubtaskSchema, updateSubtaskSchema,
} from '../validations/taskValidation.js';
import * as taskService from '../services/taskService.js';

const context = (req) => ({ project: req.project, role: req.role, user: req.user, task: req.task });

// GET /api/projects/:projectId/tasks
export async function list(req, res) {
  res.json({ tasks: await taskService.listTasks(req.project) });
}

// POST /api/projects/:projectId/tasks
export async function create(req, res) {
  const task = await taskService.createTask(context(req), createTaskSchema.parse(req.body));
  res.status(201).json({ task });
}

// POST /api/projects/:projectId/tasks/assign-all
export async function createForEveryone(req, res) {
  const tasks = await taskService.createTaskForEveryone(context(req), assignToAllSchema.parse(req.body));
  res.status(201).json({ tasks });
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

// POST /api/projects/:projectId/tasks/:taskId/suggestion/accept (owner)
export async function acceptSuggestion(req, res) {
  res.json({ task: await taskService.acceptSuggestion(context(req)) });
}

// POST /api/projects/:projectId/tasks/:taskId/suggestion/decline (owner)
export async function declineSuggestion(req, res) {
  res.json({ task: await taskService.declineSuggestion(context(req)) });
}

// POST /api/projects/:projectId/tasks/:taskId/subtasks
export async function addSubtask(req, res) {
  const task = await taskService.addSubtask(context(req), createSubtaskSchema.parse(req.body));
  res.status(201).json({ task });
}

// PATCH /api/projects/:projectId/tasks/:taskId/subtasks/:subtaskId
export async function updateSubtask(req, res) {
  const task = await taskService.updateSubtask(context(req), req.params.subtaskId, updateSubtaskSchema.parse(req.body));
  res.json({ task });
}

// DELETE /api/projects/:projectId/tasks/:taskId/subtasks/:subtaskId
export async function removeSubtask(req, res) {
  res.json({ task: await taskService.deleteSubtask(context(req), req.params.subtaskId) });
}
