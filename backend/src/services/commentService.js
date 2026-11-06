import Comment from '../models/Comment.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { ForbiddenError, NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';
import { logActivity, quote } from './activityService.js';
import { deleteCommentNotifications, deleteTaskNotifications, notify } from './notificationService.js';

const AUTHOR_FIELDS = 'name picture';

const populateComment = (query) => query.populate('author', AUTHOR_FIELDS).populate('mentions', 'name');

// True if "@name" is in the text as a whole name, so "@Sam" doesn't match "@Samantha".
// Works for any language, including Khmer, and names with spaces.
function mentionsName(text, name) {
  const haystack = text.toLowerCase();
  const needle = `@${name.toLowerCase()}`;
  const isWordChar = (ch) => Boolean(ch) && /[\p{L}\p{M}\p{N}_]/u.test(ch);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    if (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[at + needle.length])) return true;
    from = at + 1;
  }
}

// Only current members of this project can ever be mentioned
function findMentions(text, members) {
  return members.filter((m) => mentionsName(text, m.name)).map((m) => m._id);
}

export function listComments(task) {
  return populateComment(Comment.find({ task: task._id }).sort({ createdAt: 1 })).lean();
}

export async function addComment({ project, user, task }, text) {
  const memberIds = project.members.map((m) => m.user);
  const members = await User.find({ _id: { $in: memberIds } }).select('name').lean();
  const mentions = findMentions(text, members);

  const comment = await Comment.create({ project: project._id, task: task._id, author: user._id, text, mentions });
  await Task.updateOne({ _id: task._id }, { $inc: { commentCount: 1 } });
  await logActivity(project._id, user._id, `commented on ${quote(task.title)}`);

  const title = quote(task.title);
  const base = { actor: user._id, project: project._id, task: task._id, comment: comment._id, detail: text };
  await notify(mentions, { ...base, type: 'mention', message: `mentioned you on ${title}` });

  // Everyone already involved hears about it too, if they're still in the project
  const earlier = await Comment.distinct('author', { task: task._id });
  const stillMembers = new Set(memberIds.map(String));
  const mentioned = new Set(mentions.map(String));
  const involved = [task.assignee, task.createdBy, ...earlier]
    .filter(Boolean)
    .map(String)
    .filter((id) => stillMembers.has(id) && !mentioned.has(id));
  await notify(involved, { ...base, type: 'comment', message: `commented on ${title}` });

  return populateComment(Comment.findById(comment._id)).lean();
}

// The author or the project owner
export async function deleteComment({ project, role, user, task }, commentId) {
  if (!isObjectId(commentId)) throw new NotFoundError();
  const comment = await Comment.findOne({ _id: commentId, task: task._id });
  if (!comment) throw new NotFoundError();
  if (role !== 'owner' && !comment.author.equals(user._id)) throw new ForbiddenError('Not allowed');
  await comment.deleteOne();
  await deleteCommentNotifications(comment._id);
  await Task.updateOne({ _id: task._id }, { $inc: { commentCount: -1 } });
  await logActivity(project._id, user._id, `deleted a comment on ${quote(task.title)}`);
}

export async function deleteTaskComments(taskId) {
  await Comment.deleteMany({ task: taskId });
  await deleteTaskNotifications(taskId);
}

export const deleteProjectComments = (projectId) => Comment.deleteMany({ project: projectId });
