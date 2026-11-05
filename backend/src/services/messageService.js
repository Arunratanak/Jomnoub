import Message from '../models/Message.js';
import { ForbiddenError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

const AUTHOR_FIELDS = 'name picture';

// A page of messages, oldest first. hasMore says whether older messages exist.
export async function listMessages(projectId, { before, limit }) {
  const query = { project: projectId, ...(before ? { _id: { $lt: before } } : {}) };
  const rows = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', AUTHOR_FIELDS)
    .lean();
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse(), hasMore };
}

export async function createMessage(project, user, text) {
  const message = await Message.create({ project: project._id, author: user._id, text });
  return message.populate('author', AUTHOR_FIELDS);
}

// Authors can delete their own messages; the owner can delete any
export async function deleteMessage({ project, role, user }, messageId) {
  if (!isObjectId(messageId)) throw new NotFoundError();
  const message = await Message.findOne({ _id: messageId, project: project._id });
  if (!message) throw new NotFoundError();
  if (role !== 'owner' && !message.author.equals(user._id)) throw new ForbiddenError('Not allowed');
  await message.deleteOne();
}

export const deleteProjectMessages = (projectId) => Message.deleteMany({ project: projectId });
