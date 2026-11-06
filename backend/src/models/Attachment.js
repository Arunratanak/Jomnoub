import mongoose from 'mongoose';

// Details about an uploaded file. The contents live in services/storageService.js.
const attachmentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true, trim: true, maxlength: 200 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attachmentSchema.index({ task: 1, createdAt: 1 });
attachmentSchema.index({ project: 1 });
attachmentSchema.index({ uploader: 1 });

export default mongoose.model('Attachment', attachmentSchema);
