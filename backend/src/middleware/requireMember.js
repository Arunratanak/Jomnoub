import Project from '../models/Project.js';
import { isObjectId } from '../utils/validate.js';

export async function requireMember(req, res, next) {
  const { projectId } = req.params;
  if (!isObjectId(projectId)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const project = await Project.findOne({
    _id: projectId,
    'members.user': req.user._id,
  });
  if (!project) return res.status(404).json({ error: 'Not found' });

  req.project = project;
  req.role = project.members.find((m) => m.user.equals(req.user._id)).role;
  next();
}

export function requireOwner(req, res, next) {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Owners only' });
  next();
}