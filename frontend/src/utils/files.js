// Must match backend/src/config/uploads.js. The server is what actually enforces these;
// checking here just gives a faster, clearer message.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'md', 'zip',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
];
export const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

export const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Returns a message if the file can't be uploaded, otherwise null
export function fileProblem(file) {
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) return `"${file.name}" isn't an allowed file type.`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is over the 10 MB limit.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}
