import { MAX_PHOTO_BYTES } from '../config/uploads.js';
import { BadRequestError, HttpError, NotFoundError } from '../exceptions/HttpError.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { isObjectId } from '../validations/common.js';
import { createUpload, deleteFile, openDownload } from './storageService.js';

const PHOTO_TOO_LARGE = 'That photo is too large.';
const NOT_A_PHOTO = 'That file isn\'t a JPEG image.';

// The version in the address means a new photo is never hidden by the browser's cache
const photoPath = (userId, fileId) => `/profile/photos/${userId}?v=${fileId}`;

// What the profile page needs that isn't part of the user everyone else sees
export async function getAccount(user) {
  const hasPassword = await User.exists({ _id: user._id, passwordHash: { $type: 'string' } });
  return {
    signInWithGoogle: Boolean(user.googleId),
    signInWithPassword: Boolean(hasPassword),
    hasUploadedPhoto: Boolean(user.photoFileId),
    hasPhoto: Boolean(user.picture),
    canUseGooglePhoto: Boolean(user.googlePicture && user.picture !== user.googlePicture),
  };
}

// Counts of the person's assigned tasks, only in projects they still belong to
export async function getSummary(userId) {
  const projects = await Project.find({ 'members.user': userId }).select('name members').sort({ updatedAt: -1 }).lean();
  const tasks = await Task.find({ assignees: userId, project: { $in: projects.map((p) => p._id) } })
    .select('project status deadline')
    .lean();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // deadlines are stored as UTC dates

  const rows = new Map(projects.map((p) => [String(p._id), {
    id: p._id,
    name: p.name,
    role: p.members.find((m) => m.user.equals(userId))?.role,
    open: 0,
    done: 0,
    overdue: 0,
  }]));
  const totals = { todo: 0, inProgress: 0, done: 0, overdue: 0 };

  for (const t of tasks) {
    const row = rows.get(String(t.project));
    if (t.status === 'done') {
      row.done += 1;
      totals.done += 1;
      continue;
    }
    row.open += 1;
    if (t.status === 'todo') totals.todo += 1;
    else totals.inProgress += 1;
    if (t.deadline && t.deadline < today) {
      row.overdue += 1;
      totals.overdue += 1;
    }
  }

  return { projectCount: projects.length, ...totals, projects: [...rows.values()] };
}

export async function updateName(user, name) {
  user.name = name;
  user.customName = true;
  await user.save();
}

// Keeps the Google photo before the first change, for accounts from before it was stored
function rememberGooglePhoto(user) {
  if (user.googleId && !user.customPicture && user.picture) user.googlePicture = user.picture;
}

async function readPhoto(stream, declaredSize) {
  if (declaredSize > MAX_PHOTO_BYTES) throw new HttpError(413, PHOTO_TOO_LARGE);
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_PHOTO_BYTES) throw new HttpError(413, PHOTO_TOO_LARGE);
    chunks.push(chunk);
  }
  const photo = Buffer.concat(chunks);
  if (photo[0] !== 0xff || photo[1] !== 0xd8 || photo[2] !== 0xff) throw new BadRequestError(NOT_A_PHOTO);
  return photo;
}

export async function savePhoto(user, stream, declaredSize) {
  const photo = await readPhoto(stream, declaredSize);
  const upload = createUpload('profile-photo.jpg', 'image/jpeg');
  try {
    await upload.write(photo);
    await upload.finish();
  } catch (err) {
    await upload.abort();
    throw err;
  }

  rememberGooglePhoto(user);
  const oldPhoto = user.photoFileId;
  user.photoFileId = upload.id;
  user.picture = photoPath(user._id, upload.id);
  user.customPicture = true;
  await user.save();
  if (oldPhoto) await deleteFile(oldPhoto);
}

// No photo at all: everyone sees their initial, and Google's photo stays away too
export async function removePhoto(user) {
  rememberGooglePhoto(user);
  const oldPhoto = user.photoFileId;
  user.photoFileId = undefined;
  user.picture = undefined;
  user.customPicture = true;
  await user.save();
  if (oldPhoto) await deleteFile(oldPhoto);
}

export async function useGooglePhoto(user) {
  if (!user.googlePicture) throw new BadRequestError('There is no Google photo to go back to.');
  const oldPhoto = user.photoFileId;
  user.photoFileId = undefined;
  user.picture = user.googlePicture;
  user.customPicture = false;
  await user.save();
  if (oldPhoto) await deleteFile(oldPhoto);
}

// Only the person and people who share a project with them can see an uploaded photo.
// Anyone else gets the same 404 as for a photo that doesn't exist.
export async function openPhoto(viewer, userId) {
  if (!isObjectId(userId)) throw new NotFoundError();
  const isSelf = viewer._id.equals(userId);
  const allowed = isSelf || await Project.exists({ 'members.user': { $all: [viewer._id, userId] } });
  if (!allowed) throw new NotFoundError();
  const owner = isSelf ? viewer : await User.findById(userId).select('photoFileId').lean();
  if (!owner?.photoFileId) throw new NotFoundError();
  return openDownload(owner.photoFileId);
}
