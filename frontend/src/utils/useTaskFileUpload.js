import { useState } from 'react';
import { uploadTaskFile } from '../api/attachments';
import { toast } from './feedback';
import { fileProblem } from './files';

// Uploads files straight to a task, used by task cards and the timeline. One at a time,
// so several large files don't compete on a slow connection. Any member can do this.
export default function useTaskFileUpload(projectId, taskId, onFileAdded) {
  const [uploading, setUploading] = useState(null); // { name, percent }

  const addFiles = async (fileList) => {
    for (const file of Array.from(fileList)) {
      const problem = fileProblem(file);
      if (problem) {
        toast(problem, 'error');
        continue;
      }
      setUploading({ name: file.name, percent: 0 });
      try {
        await uploadTaskFile(projectId, taskId, file, (percent) => setUploading({ name: file.name, percent }));
        onFileAdded(taskId);
        toast(`"${file.name}" attached.`);
      } catch (err) {
        toast(err.response?.data?.error || `Could not upload "${file.name}".`, 'error');
      }
    }
    setUploading(null);
  };

  return { uploading, addFiles };
}
