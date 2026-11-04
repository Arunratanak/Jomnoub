import { findValidInvite } from '../services/inviteService.js';

// Loads a valid, unexpired invite for :token; sets req.invite and req.project
export default async function loadInvite(req, res, next) {
  const { invite, project } = await findValidInvite(req.params.token);
  req.invite = invite;
  req.project = project;
  next();
}
