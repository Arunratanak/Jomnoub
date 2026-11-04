import { findProjectForMember } from '../services/projectService.js';
import { ForbiddenError } from '../exceptions/HttpError.js';

// Loads :projectId only if the logged-in user is a member; sets req.project and req.role.
// Non-members get the same 404 as a missing project.
export async function requireMember(req, res, next) {
  const { project, role } = await findProjectForMember(req.params.projectId, req.user._id);
  req.project = project;
  req.role = role;
  next();
}

export function requireOwner(req, res, next) {
  if (req.role !== 'owner') throw new ForbiddenError('Owners only');
  next();
}
