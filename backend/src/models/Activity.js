import mongoose from 'mongoose';

// A short, human-readable history line for a project, e.g. "created task "Write report"".
// The actor's name is shown separately, so messages are written without it.
const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
