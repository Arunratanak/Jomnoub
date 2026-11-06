import { once } from 'node:events';
import { Readable } from 'node:stream';
import { AwsClient } from 'aws4fetch';
import mongoose from 'mongoose';
import { NotFoundError } from '../exceptions/HttpError.js';

// Where file contents are kept. Everything else only uses the three functions at the
// bottom. Cloudflare R2 is used when configured; otherwise files go in the database
// (GridFS), so local development and tests work without any keys.
//
// The bucket stays private: downloads always go through our API and its membership
// checks, and object names are random ids, never the user's filename.

export const R2_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
export const missingR2Vars = () => R2_VARS.filter((name) => !process.env[name]);
export const usingR2 = () => missingR2Vars().length === 0;

// ---------- Cloudflare R2 ----------
function r2Request(fileId, init = {}) {
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 2,
  });
  const host = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return client.fetch(`${host}/${process.env.R2_BUCKET}/attachments/${fileId}`, init);
}

const r2 = {
  // Holds the file in memory until it's complete. That's at most the 10 MB file limit,
  // which the caller enforces before each write.
  createUpload(contentType) {
    const id = new mongoose.Types.ObjectId();
    let chunks = [];
    return {
      id,
      async write(chunk) {
        chunks.push(chunk);
      },
      async finish() {
        const body = Buffer.concat(chunks);
        chunks = [];
        const res = await r2Request(id, {
          method: 'PUT',
          body,
          headers: { 'Content-Type': contentType, 'Content-Length': String(body.length) },
        });
        if (!res.ok) throw new Error(`File storage rejected the upload (status ${res.status})`);
      },
      async abort() {
        chunks = []; // nothing was sent yet
      },
    };
  },

  async openDownload(fileId) {
    const res = await r2Request(fileId);
    if (res.status === 404) throw new NotFoundError();
    if (!res.ok) throw new Error(`File storage rejected the download (status ${res.status})`);
    return Readable.fromWeb(res.body);
  },

  async deleteFile(fileId) {
    const res = await r2Request(fileId, { method: 'DELETE' });
    // Already gone is fine
    if (!res.ok && res.status !== 404) throw new Error(`File storage rejected the delete (status ${res.status})`);
  },
};

// ---------- Database (GridFS) ----------
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });

const gridfs = {
  createUpload(contentType, filename) {
    const stream = bucket().openUploadStream(filename, { metadata: { contentType } });
    let failure = null;
    stream.on('error', (err) => { failure = err; });
    return {
      id: stream.id,
      async write(chunk) {
        if (failure) throw failure;
        if (!stream.write(chunk)) await once(stream, 'drain');
      },
      async finish() {
        if (failure) throw failure;
        stream.end();
        await once(stream, 'finish');
      },
      async abort() {
        await stream.abort().catch(() => {});
      },
    };
  },

  async openDownload(fileId) {
    return bucket().openDownloadStream(fileId);
  },

  async deleteFile(fileId) {
    await bucket().delete(fileId).catch((err) => {
      if (!/not found/i.test(err.message)) throw err; // already gone is fine
    });
  },
};

const store = () => (usingR2() ? r2 : gridfs);

// ---------- What the rest of the app uses ----------
// Returns { id, write(chunk), finish(), abort() }
export const createUpload = (filename, contentType) => store().createUpload(contentType, filename);

export const openDownload = (fileId) => store().openDownload(fileId);

// Never fails the request: the record is already gone, so log it and move on
export async function deleteFile(fileId) {
  try {
    await store().deleteFile(fileId);
  } catch (err) {
    console.error('File delete failed:', err.message);
  }
}
