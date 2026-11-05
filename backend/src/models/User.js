import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Set for anyone who has signed in with Google. Having one means Google has
    // verified that this person owns the email address.
    googleId: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    picture: String,
    // Only for email + password accounts. A scrypt hash, never the password.
    // select: false keeps it out of every query unless explicitly requested.
    passwordHash: { type: String, select: false },
    // Part of the session JWT. Increasing it ends all of this user's sessions.
    tokenVersion: { type: Number, default: 0 },
    // Fake teammates created by scripts/seed.js. They can't sign in and the
    // reminder job never emails them.
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique only for accounts that have one, so many password accounts can have none.
// config/db.js replaces the older versions of these two indexes on startup.
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });
userSchema.index({ email: 1 }, { unique: true });

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.googleId;
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
