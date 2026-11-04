import { createProjectSchema, updateProjectSchema } from '../validations/projectValidation.js';
import * as projectService from '../services/projectService.js';
import { getProjectStats } from '../services/statsService.js';
import { listActivity } from '../services/activityService.js';

// POST /api/projects
export async function create(req, res) {
  const project = await projectService.createProject(req.user, createProjectSchema.parse(req.body));
  res.status(201).json({ project });
}

// GET /api/projects
export async function list(req, res) {
  res.json({ projects: await projectService.listProjectsForUser(req.user._id) });
}

// GET /api/projects/:projectId
export async function getOne(req, res) {
  await projectService.populateMembers(req.project);
  res.json({ project: req.project, role: req.role });
}

// PATCH /api/projects/:projectId (owner)
export async function update(req, res) {
  const project = await projectService.updateProject(req.project, updateProjectSchema.parse(req.body));
  res.json({ project });
}

// DELETE /api/projects/:projectId (owner)
export async function remove(req, res) {
  await projectService.deleteProject(req.project);
  res.json({ ok: true });
}

// GET /api/projects/:projectId/stats
export async function stats(req, res) {
  res.json({ stats: await getProjectStats(req.project._id) });
}

// GET /api/projects/:projectId/activity
export async function activity(req, res) {
  res.json({ activity: await listActivity(req.project._id) });
}
