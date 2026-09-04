import { MAX_PHOTO_EDGE, PHOTO_QUALITY } from "./constants.js";

/**
 * Decodes an image file, downscales it so its longest edge is at most
 * `maxEdge`, and re-encodes it as a JPEG Blob.
 *
 * Unlike the original prototype's version this *rejects* on failure rather
 * than leaving the promise permanently pending, so a corrupt or unsupported
 * file surfaces an error instead of silently doing nothing forever.
 */
export async function compressImage(file, options = {}) {
  const { maxEdge = MAX_PHOTO_EDGE, quality = PHOTO_QUALITY } = options;

  if (!file) throw new Error("No file was selected.");
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not an image file.`);
  }

  const source = await decode(file);
  try {
    // Scale by the longest edge; the original only ever considered width, so
    // a tall portrait photo came through larger than intended.
    const longest = Math.max(source.width, source.height);
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not process the image.");
    ctx.drawImage(source, 0, 0, width, height);

    return await toBlob(canvas, quality);
  } finally {
    if (typeof source.close === "function") source.close();
    if (source.__objectUrl) URL.revokeObjectURL(source.__objectUrl);
  }
}

/**
 * Returns something drawable with a width/height. Prefers createImageBitmap,
 * which decodes off the main thread and can apply EXIF orientation — phone
 * photos taken in portrait used to land sideways without it.
 */
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options bag; try again without it.
      try {
        return await createImageBitmap(file);
      } catch {
        /* Fall through to the <img> path. */
      }
    }
  }
  return decodeViaImageElement(file);
}

function decodeViaImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      img.__objectUrl = url;
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name || "That file"}" could not be read as an image.`));
    };

    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The image could not be encoded."));
      },
      "image/jpeg",
      quality
    );
  });
}

/** jsPDF needs a data URL, so blobs are converted at export time only. */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read the photo."));
    reader.readAsDataURL(blob);
  });
}
