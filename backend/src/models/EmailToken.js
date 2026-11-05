import crypto from 'node:crypto';
import mongoose from 'mongoose';

// One-time links sent by email. As with invites, only a hash is stored, so someone
// reading the database can't use these to verify an email or reset a password.
export const hashEmailToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const newEmailToken = () => crypto.randomBytes(32).toString('base64url');

const emailTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['verify-email', 'reset-password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB removes expired tokens automatically (about once a minute, so the
// service also checks expiresAt itself)
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('EmailToken', emailTokenSchema);
