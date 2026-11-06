import Notification from '../models/Notification.js';
import { NotFoundError } from '../exceptions/HttpError.js';
import { isObjectId } from '../validations/common.js';

const LIST_LIMIT = 30;

// Creates notifications. Never throws: a failed notification must not break the request
// that caused it. Nobody is notified about their own action.
export async function notify(recipients, { actor, type, message, detail = '', project, task = null, comment = null }) {
  try {
    const actorId = String(actor);
    const unique = [...new Set(recipients.filter(Boolean).map(String))].filter((id) => id !== actorId);
    if (unique.length === 0) return;
    await Notification.insertMany(unique.map((user) => ({
      user, actor, type, message: String(message).slice(0, 200), detail: String(detail).slice(0, 140), project, task, comment,
    })));
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}

// Every query is limited to the signed-in user, so nobody can see or change another's inbox
export async function listNotifications(userId) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(LIST_LIMIT)
      .populate('actor', 'name picture')
      .populate('project', 'name')
      .lean(),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { notifications, unreadCount };
}

export async function markRead(userId, notificationId) {
  if (!isObjectId(notificationId)) throw new NotFoundError();
  const result = await Notification.updateOne({ _id: notificationId, user: userId }, { $set: { readAt: new Date() } });
  if (result.matchedCount === 0) throw new NotFoundError();
}

export const markAllRead = (userId) => Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });

export const deleteTaskNotifications = (taskId) => Notification.deleteMany({ task: taskId });
export const deleteCommentNotifications = (commentId) => Notification.deleteMany({ comment: commentId });
export const deleteProjectNotifications = (projectId) => Notification.deleteMany({ project: projectId });
// Someone removed from a project shouldn't keep links into it
export const deleteUserProjectNotifications = (userId, projectId) => Notification.deleteMany({ user: userId, project: projectId });
