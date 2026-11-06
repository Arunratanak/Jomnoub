import * as notifications from '../services/notificationService.js';

// GET /api/notifications: my latest notifications and unread count
export async function list(req, res) {
  res.json(await notifications.listNotifications(req.user._id));
}

// POST /api/notifications/read-all
export async function readAll(req, res) {
  await notifications.markAllRead(req.user._id);
  res.json({ ok: true });
}

// POST /api/notifications/:notificationId/read
export async function read(req, res) {
  await notifications.markRead(req.user._id, req.params.notificationId);
  res.json({ ok: true });
}
