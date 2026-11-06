import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Set for anyone who has signed in with Google. Having one means Google has
    // verified that this person owns the email address.
    googleId: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    // A Google address, or our own /profile/photos/... path for an uploaded photo
    picture: String,
    // Set once the person chooses their own, so signing in with Google keeps their choice
    customName: { type: Boolean, default: false },
    customPicture: { type: Boolean, default: false },
    googlePicture: String, // lets someone go back to their Google photo
    photoFileId: mongoose.Schema.Types.ObjectId, // the uploaded photo in file storage
    // Only for email + password accounts. A scrypt hash, never the password.
    // select: false keeps it out of every query unless explicitly requested.
    passwordHash: { type: String, select: false },
    // True once a password account has used a link sent to this address
    emailVerified: { type: Boolean, default: false },
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

// Verified by Google or by a link we emailed. Works on documents and lean objects.
export const hasVerifiedEmail = (user) => Boolean(user?.googleId || user?.emailVerified);
export const VERIFIED_EMAIL_FILTER = { $or: [{ googleId: { $type: 'string' } }, { emailVerified: true }] };

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.emailVerified = hasVerifiedEmail(ret);
    delete ret.googleId;
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.customName;
    delete ret.customPicture;
    delete ret.googlePicture;
    delete ret.photoFileId;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
