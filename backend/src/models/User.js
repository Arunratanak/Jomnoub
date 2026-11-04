import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, index: true },
    name: { type: String, required: true },
    picture: String,
    // Fake teammates created by scripts/seed.js. They can't sign in (no real
    // Google account) and the reminder job never emails them.
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.googleId;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);