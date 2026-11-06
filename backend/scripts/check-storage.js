// Checks the file storage settings: npm run check:storage
// Uploads a small test file, reads it back and deletes it. Prints no keys.
import 'dotenv/config';
import { createUpload, deleteFile, missingR2Vars, openDownload, usingR2 } from '../src/services/storageService.js';

if (!usingR2()) {
  console.error(`Cloudflare R2 isn't configured. Add these to backend/.env: ${missingR2Vars().join(', ')}`);
  process.exit(1);
}

const message = `Jomnoub storage check ${new Date().toISOString()}`;

try {
  const upload = createUpload('storage-check.txt', 'text/plain');
  await upload.write(Buffer.from(message));
  await upload.finish();
  console.log('1. Upload: OK');

  let received = '';
  for await (const chunk of await openDownload(upload.id)) received += chunk.toString();
  if (received !== message) throw new Error('The downloaded file did not match what was uploaded');
  console.log('2. Download: OK');

  await deleteFile(upload.id);
  let stillThere = true;
  try {
    await openDownload(upload.id);
  } catch {
    stillThere = false;
  }
  if (stillThere) throw new Error('The test file was still there after deleting it');
  console.log('3. Delete: OK');
  console.log('File storage works.');
} catch (err) {
  console.error('File storage check failed:', err.message);
  console.error('Check the R2 values in backend/.env, and that the API token has Object Read & Write on this bucket.');
  process.exitCode = 1;
}
