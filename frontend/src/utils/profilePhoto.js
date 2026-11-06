const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 0.85;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ACCEPT = ALLOWED_TYPES.join(',');

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be opened. Try a different one.'));
    image.src = url;
  });
}

// Crops the middle to a small square JPEG. Redrawing it also leaves behind anything
// stored in the original file, such as the location a phone photo was taken.
export async function makeProfilePhoto(file) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image under 20 MB.');

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#fff'; // JPEG has no transparency
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', OUTPUT_QUALITY));
    if (!blob) throw new Error('That image could not be opened. Try a different one.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
