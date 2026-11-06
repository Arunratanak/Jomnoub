import { pipeline } from 'node:stream/promises';
import { BadRequestError } from '../exceptions/HttpError.js';
import * as profile from '../services/profileService.js';
import { updateProfileSchema } from '../validations/profileValidation.js';

const YEAR_SECONDS = 365 * 24 * 60 * 60;

const sendUser = async (res, user) => res.json({ user, account: await profile.getAccount(user) });

// GET /api/profile
export async function get(req, res) {
  const [account, summary] = await Promise.all([profile.getAccount(req.user), profile.getSummary(req.user._id)]);
  res.json({ user: req.user, account, summary });
}

// PATCH /api/profile
export async function update(req, res) {
  const { name } = updateProfileSchema.parse(req.body);
  await profile.updateName(req.user, name);
  await sendUser(res, req.user);
}

// POST /api/profile/photo (the body is the JPEG itself)
export async function uploadPhoto(req, res) {
  try {
    if (!req.is('image/jpeg')) throw new BadRequestError('That file isn\'t a JPEG image.');
    await profile.savePhoto(req.user, req, Number(req.get('content-length')) || 0);
  } catch (err) {
    if (!req.readableEnded) res.set('Connection', 'close'); // don't wait for the rest
    throw err;
  }
  await sendUser(res, req.user);
}

// DELETE /api/profile/photo
export async function removePhoto(req, res) {
  await profile.removePhoto(req.user);
  await sendUser(res, req.user);
}

// POST /api/profile/photo/google
export async function useGooglePhoto(req, res) {
  await profile.useGooglePhoto(req.user);
  await sendUser(res, req.user);
}

// GET /api/profile/photos/:userId
export async function showPhoto(req, res) {
  const contents = await profile.openPhoto(req.user, req.params.userId);
  res.set({
    'Content-Type': 'image/jpeg',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Cache-Control': `private, max-age=${YEAR_SECONDS}, immutable`, // a new photo gets a new address
  });
  try {
    await pipeline(contents, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('Photo download failed:', err.message);
    if (!res.headersSent) {
      res.removeHeader('Cache-Control');
      res.status(500).json({ error: 'Could not load this photo.' });
    } else {
      res.destroy();
    }
  }
}
