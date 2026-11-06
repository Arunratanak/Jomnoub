import mongoose from 'mongoose';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

// One entry in a person's notification inbox. "message" reads after the actor's name,
// e.g. Alex + 'mentioned you on "Write report"'.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['assigned', 'mention', 'comment', 'task-done', 'suggestion-accepted', 'suggestion-declined', 'member-joined', 'member-left', 'added', 'removed'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 200 },
    detail: { type: String, maxlength: 140, default: '' }, // e.g. the start of a comment
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ task: 1 });
notificationSchema.index({ project: 1, user: 1 });
// Old notifications clean themselves up
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_SECONDS });

export default mongoose.model('Notification', notificationSchema);
