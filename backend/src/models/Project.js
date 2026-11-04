import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    members: [memberSchema],
    // Created by scripts/seed.js; lets `npm run seed:clear` remove only demo data
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });

export default mongoose.model('Project', projectSchema);