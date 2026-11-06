import api from './client';

// Uploads one file to a task and returns the new attachment. The name goes in a
// header so it stays out of URLs and request logs.
export async function uploadTaskFile(projectId, taskId, file, onPercent) {
  const res = await api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, file, {
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    onUploadProgress: (e) => onPercent?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
  });
  return res.data.attachment;
}
