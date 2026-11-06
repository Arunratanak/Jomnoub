import Attachment from '../models/Attachment.js';
import Task from '../models/Task.js';
import {
  FILE_TYPES, IMAGE_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_TASK, MAX_PROJECT_BYTES, MAX_USER_BYTES,
} from '../config/uploads.js';
import { BadRequestError, ForbiddenError, HttpError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';
import { logActivity, quote } from './activityService.js';
import { createUpload, deleteFile, openDownload } from './storageService.js';

const MB = 1024 * 1024;
const TOO_LARGE = `Files can be up to ${MAX_FILE_BYTES / MB} MB.`;
const UPLOADER_FIELDS = 'name picture';

// Removes folder parts and control characters, so a name can't point anywhere else
function cleanFilename(name) {
  const base = String(name).split(/[\\/]/).pop();
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

// Images are the only files shown in the browser, so check they really are images
function looksLike(contentType, head) {
  const starts = (...bytes) => bytes.every((b, i) => head[i] === b);
  if (contentType === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (contentType === 'image/jpeg') return starts(0xff, 0xd8, 0xff);
  if (contentType === 'image/gif') return starts(0x47, 0x49, 0x46, 0x38);
  if (contentType === 'image/webp') {
    return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  return true;
}

async function bytesUsed(match) {
  const [row] = await Attachment.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$size' } } }]);
  return row?.total || 0;
}

export function listAttachments(task) {
  return Attachment.find({ task: task._id }).sort({ createdAt: 1 }).populate('uploader', UPLOADER_FIELDS).lean();
}

// Streams the upload straight to storage, so big files never sit in memory
export async function uploadAttachment({ project, task, user }, { filename, declaredSize, stream }) {
  const name = cleanFilename(filename);
  const contentType = FILE_TYPES[extensionOf(name)];
  if (!name || !contentType) throw new BadRequestError('This file type isn\'t allowed. Try a document, spreadsheet, slide deck, image or zip.');
  if (declaredSize > MAX_FILE_BYTES) throw new HttpError(413, TOO_LARGE);

  if ((await Attachment.countDocuments({ task: task._id })) >= MAX_FILES_PER_TASK) {
    throw new BadRequestError(`A task can have up to ${MAX_FILES_PER_TASK} files.`);
  }
  if ((await bytesUsed({ project: project._id })) + declaredSize > MAX_PROJECT_BYTES) {
    throw new BadRequestError(`This project has reached its ${MAX_PROJECT_BYTES / MB} MB file limit. Delete some files to add more.`);
  }
  if ((await bytesUsed({ uploader: user._id })) + declaredSize > MAX_USER_BYTES) {
    throw new BadRequestError(`You've reached your ${MAX_USER_BYTES / (1024 * MB)} GB upload limit. Delete some files to add more.`);
  }

  const upload = createUpload(name, contentType);
  let size = 0;
  let head = Buffer.alloc(0);
  let checked = false;
  const checkContents = () => {
    checked = true;
    if (IMAGE_TYPES.includes(contentType) && !looksLike(contentType, head)) {
      throw new BadRequestError('This file doesn\'t look like the image type its name says it is.');
    }
  };
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > MAX_FILE_BYTES) throw new HttpError(413, TOO_LARGE);
      if (!checked) {
        head = Buffer.concat([head, chunk]);
        if (head.length >= 12) checkContents();
      }
      await upload.write(chunk);
    }
    if (size === 0) throw new BadRequestError('This file is empty.');
    if (!checked) checkContents();
    await upload.finish();
  } catch (err) {
    await upload.abort();
    throw err;
  }

  const attachment = await Attachment.create({
    project: project._id, task: task._id, uploader: user._id, filename: name, contentType, size, fileId: upload.id,
  });
  await Task.updateOne({ _id: task._id }, { $inc: { attachmentCount: 1 } });
  await logActivity(project._id, user._id, `attached ${quote(name)} to ${quote(task.title)}`);
  return attachment.populate('uploader', UPLOADER_FIELDS);
}

// Always scoped to the task, which is already scoped to the verified project
export async function findAttachment(task, attachmentId) {
  if (!isObjectId(attachmentId)) throw new NotFoundError();
  const attachment = await Attachment.findOne({ _id: attachmentId, task: task._id });
  if (!attachment) throw new NotFoundError();
  return attachment;
}

export const openAttachment = (attachment) => openDownload(attachment.fileId);

// The uploader, the task's creator or the project owner
export async function deleteAttachment({ project, role, user, task }, attachmentId) {
  const attachment = await findAttachment(task, attachmentId);
  const allowed = role === 'owner' || task.createdBy.equals(user._id) || attachment.uploader.equals(user._id);
  if (!allowed) throw new ForbiddenError('Not allowed');
  await attachment.deleteOne();
  await deleteFile(attachment.fileId);
  await Task.updateOne({ _id: task._id }, { $inc: { attachmentCount: -1 } });
  await logActivity(project._id, user._id, `removed ${quote(attachment.filename)} from ${quote(task.title)}`);
}

async function deleteMatching(match) {
  const rows = await Attachment.find(match).select('fileId').lean();
  await Attachment.deleteMany(match);
  await Promise.all(rows.map((r) => deleteFile(r.fileId)));
}

export const deleteTaskAttachments = (taskId) => deleteMatching({ task: taskId });
export const deleteProjectAttachments = (projectId) => deleteMatching({ project: projectId });
