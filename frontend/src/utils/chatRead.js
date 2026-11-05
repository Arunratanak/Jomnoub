// Remembers, per project and in this browser only, the newest chat message seen.
// Message ids sort by time, so comparing the id strings tells which is newer.
const key = (projectId) => `jomnoub-chat-read-${projectId}`;

export function getLastRead(projectId) {
  try {
    return localStorage.getItem(key(projectId)) || '';
  } catch {
    return '';
  }
}

export function setLastRead(projectId, messageId) {
  try {
    localStorage.setItem(key(projectId), messageId);
  } catch {
    // private mode: unread dot may reappear, nothing else breaks
  }
}
