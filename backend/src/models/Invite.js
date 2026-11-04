import crypto from 'node:crypto';
import mongoose from 'mongoose';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Only a SHA-256 hash of the token is stored, so someone reading the database
// can't use it to join projects. The raw token only ever exists in the link.
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('base64url'); // 256 bits

const inviteSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB deletes expired invites automatically (runs about once a minute,
// so routes also check expiresAt themselves)
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Invite', inviteSchema);
