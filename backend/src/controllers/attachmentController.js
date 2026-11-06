import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { IMAGE_TYPES } from '../config/uploads.js';
import { BadRequestError } from '../exceptions/HttpError.js';
import * as attachments from '../services/attachmentService.js';

const DRAIN_TIMEOUT_MS = 30000;

const context = (req) => ({ project: req.project, role: req.role, user: req.user, task: req.task });

// The name travels in a header, not the URL, so it stays out of request logs
function filenameFromHeader(req) {
  const raw = req.get('x-file-name');
  if (!raw || raw.length > 1000) throw new BadRequestError('The file needs a name.');
  try {
    return decodeURIComponent(raw).slice(0, 200);
  } catch {
    throw new BadRequestError('The file name isn\'t valid.');
  }
}

// RFC 5987: a plain fallback plus the exact name, so Khmer and other names survive
function contentDisposition(type, filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// GET /api/projects/:projectId/tasks/:taskId/attachments
export async function list(req, res) {
  res.json({ attachments: await attachments.listAttachments(req.task) });
}

// POST /api/projects/:projectId/tasks/:taskId/attachments (the body is the raw file)
export async function upload(req, res) {
  try {
    const attachment = await attachments.uploadAttachment(context(req), {
      filename: filenameFromHeader(req),
      declaredSize: Number(req.get('content-length')) || 0,
      stream: req,
    });
    res.status(201).json({ attachment });
  } catch (err) {
    // The file may still be arriving. Browsers show a vague network error if we answer
    // too early, so read the rest of an in-limit file first, then give the real message.
    // Anything over the limit gets cut off instead of being read.
    if (err.status === 413) res.set('Connection', 'close');
    else await drainRequest(req);
    throw err;
  }
}

async function drainRequest(req) {
  if (req.readableEnded || req.destroyed) return;
  req.resume();
  await Promise.race([
    once(req, 'end').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, DRAIN_TIMEOUT_MS)),
  ]);
}

// GET /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId/download[?preview=1]
export async function download(req, res) {
  const file = await attachments.findAttachment(req.task, req.params.attachmentId);
  // Only checked images may display in the browser. Everything else always downloads.
  const inline = req.query.preview === '1' && IMAGE_TYPES.includes(file.contentType);
  // Open it first, so a storage problem still gets a normal error response
  const contents = await attachments.openAttachment(file);
  res.set({
    'Content-Type': file.contentType,
    'Content-Length': String(file.size),
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', file.filename),
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Cache-Control': 'private, no-cache',
  });
  try {
    await pipeline(contents, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('File download failed:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Could not download this file.' });
    else res.destroy();
  }
}

// DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId
export async function remove(req, res) {
  await attachments.deleteAttachment(context(req), req.params.attachmentId);
  res.json({ ok: true });
}
