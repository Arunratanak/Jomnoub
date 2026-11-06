const MB = 1024 * 1024;

// These keep one person or project from filling the storage (R2's free tier is about 10 GB)
export const MAX_FILE_BYTES = 10 * MB;
export const MAX_FILES_PER_TASK = 20;
export const MAX_PROJECT_BYTES = 500 * MB;
export const MAX_USER_BYTES = 1024 * MB;

// Allowlist: extension -> the type we serve it as. The server decides the type, never
// the browser. Anything that can run in a browser (HTML, SVG, JavaScript) is left out,
// because files are served from our own domain.
export const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

// The only types ever shown in the browser, and only after their contents are checked
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
