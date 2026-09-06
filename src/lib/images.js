import { encodeInWorker } from "./encodeWorker.js";
import { parseCaptureTime, readCaptureTime, readJpegDimensions } from "./exif.js";
import { MAX_PHOTO_EDGE, PHOTO_QUALITY } from "./constants.js";

/**
 * Turns a picked file into everything a stored photo needs: the downscaled
 * JPEG bytes, when it was taken, and how trustworthy that time is.
 *
 * Speed is the point of this function, and the cost was not where it looked.
 * Measured on a 12MP (4032x3024) photo: reading it 2ms, decoding 36ms, drawing
 * 0ms — and `canvas.toBlob` 1032ms. The identical encode through the
 * synchronous `toDataURL` takes 19ms. That holds whether or not the page is in
 * the foreground, so it is a property of `toBlob` itself, not of throttling.
 *
 * Four things keep this fast on any device:
 *
 *   1. Encoding happens in a worker where possible, so no amount of device
 *      slowness can freeze the interface, and several photos genuinely run at
 *      once across cores. `encodeJpeg` is the main-thread fallback.
 *   2. Neither path uses `canvas.toBlob`.
 *   3. The file is read ONCE. Both the EXIF timestamp and the pixel dimensions
 *      come out of that single buffer's header. On iOS a read of a photo from
 *      the library can trigger an OS-level HEIC transcode, so a second read
 *      costs as much as the first.
 *   4. The dimensions from the header let the decoder scale during decode, so a
 *      48MP photo never has to exist as a ~190MB bitmap on a phone — the
 *      difference between slow and out-of-memory.
 */
export async function preparePhoto(file, options = {}) {
  const { maxEdge = MAX_PHOTO_EDGE, quality = PHOTO_QUALITY } = options;

  if (!file) throw new Error("No file was selected.");
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not an image file.`);
  }

  // The single read. Timed, because on a phone this is the step most likely
  // to dominate — iOS may transcode HEIC here, or fetch the original down
  // from iCloud, neither of which any amount of decoding cleverness avoids.
  const readStart = now();
  const buffer = await file.arrayBuffer();
  const readMs = now() - readStart;

  const view = new DataView(buffer);
  const type = file.type || "image/jpeg";

  const when = resolveCaptureTimeFromView(view, file);
  const size = readJpegDimensions(view);
  const target = targetSize(size, maxEdge);

  // Preferred path: hand the bytes to a worker and keep the main thread free.
  // The buffer is transferred, so everything below re-reads the file instead.
  const encodeStart = now();
  try {
    const encoded = await encodeInWorker({
      buffer,
      type,
      targetWidth: target?.width,
      targetHeight: target?.height,
      quality,
    });
    if (encoded) {
      return {
        blob: encoded,
        ...when,
        timing: { readMs, encodeMs: now() - encodeStart, path: "worker", bytes: file.size },
      };
    }
  } catch {
    /* Worker unavailable or failed; fall through to the main thread. */
  }

  // If the worker never took the buffer it is still intact, so reuse it —
  // re-reading is exactly the cost this function exists to avoid, and the
  // devices without workers are the ones that can least afford it.
  return prepareOnMainThread(file, { maxEdge, quality, when, buffer, readMs });
}

/** Target dimensions for a known source size, or null when it is unknown. */
function targetSize(size, maxEdge) {
  if (!size) return null;
  const longest = Math.max(size.width, size.height);
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * The fallback: same work, on the main thread. Used when workers or
 * OffscreenCanvas are unavailable (older Safari), or when a worker fails.
 */
function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function prepareOnMainThread(file, { maxEdge, quality, when, buffer, readMs = 0 }) {
  const encodeStart = now();
  // A transferred ArrayBuffer is detached and reports zero length.
  const bytes = buffer && buffer.byteLength > 0 ? buffer : await file.arrayBuffer();
  const view = new DataView(bytes);
  const type = file.type || "image/jpeg";
  const blob = new Blob([bytes], { type });
  const source = await decodeToFit(blob, readJpegDimensions(view), maxEdge);

  try {
    // Usually already the target size, so this is a straight copy. The clamp
    // matters only on the fallback paths, where the decoder ignored our size.
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

    const blob = await encodeJpeg(canvas, quality);
    return {
      blob,
      ...when,
      timing: { readMs, encodeMs: now() - encodeStart, path: "main", bytes: file.size },
    };
  } finally {
    if (typeof source.close === "function") source.close();
    if (source.__objectUrl) URL.revokeObjectURL(source.__objectUrl);
  }
}

/**
 * Decodes at (or near) the size we actually want.
 *
 * `resizeWidth`/`resizeHeight` are honoured during decode, so the decoder never
 * allocates the full-resolution bitmap. Aspect ratio is preserved because both
 * values are derived from the source's own ratio; EXIF rotation is applied
 * after scaling, which swaps the two but keeps the longest edge within bounds.
 */
async function decodeToFit(blob, size, maxEdge) {
  const oriented = { imageOrientation: "from-image" };

  if (typeof createImageBitmap === "function") {
    if (size) {
      const longest = Math.max(size.width, size.height);
      const scale = Math.min(1, maxEdge / longest);
      if (scale < 1) {
        const resizeWidth = Math.max(1, Math.round(size.width * scale));
        const resizeHeight = Math.max(1, Math.round(size.height * scale));
        try {
          return await createImageBitmap(blob, {
            ...oriented,
            resizeWidth,
            resizeHeight,
            resizeQuality: "high",
          });
        } catch {
          /* Older engines reject the resize options; fall through. */
        }
      }
    }

    try {
      return await createImageBitmap(blob, oriented);
    } catch {
      try {
        return await createImageBitmap(blob);
      } catch {
        /* Fall through to the <img> path. */
      }
    }
  }

  return decodeViaImageElement(blob);
}

function decodeViaImageElement(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      img.__objectUrl = url;
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };

    img.src = url;
  });
}

/**
 * Encodes the canvas as a JPEG Blob.
 *
 * Deliberately uses the SYNCHRONOUS `toDataURL` rather than `toBlob`. They do
 * identical work, but `toBlob` delivers its result through a callback that the
 * browser defers whenever the page is not in the foreground — measured at
 * ~1024ms per photo against ~13ms for the same encode done synchronously, and
 * it stops arriving altogether once the tab is backgrounded. That single
 * callback was the whole reason importing photos crawled, and the reason it
 * appeared to stop when you switched away.
 *
 * The canvas here is never larger than MAX_PHOTO_EDGE, so blocking the main
 * thread for ~13ms is a good trade for losing a one-second stall.
 */
function encodeJpeg(canvas, quality) {
  try {
    return dataUrlToBlobSync(canvas.toDataURL("image/jpeg", quality));
  } catch {
    // Only reachable if toDataURL is unavailable or the canvas is tainted.
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded."))),
        "image/jpeg",
        quality
      );
    });
  }
}

/** base64 data URL -> Blob, without a network round-trip or a callback. */
function dataUrlToBlobSync(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("The image could not be encoded.");

  const meta = dataUrl.slice(5, comma); // strip "data:"
  const isBase64 = meta.endsWith(";base64");
  const type = (isBase64 ? meta.slice(0, -7) : meta) || "image/jpeg";
  const payload = dataUrl.slice(comma + 1);

  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return new Blob([bytes], { type });
}

/**
 * Works out when a photo was actually taken, and says how confident that is.
 *
 * Order of preference:
 *   camera  - EXIF DateTimeOriginal, written by the device at capture
 *   file    - the file's own modified date, when it clearly predates upload
 *   upload  - fallback: the moment it was added here
 *
 * The source travels with the photo so the PDF can state it plainly rather
 * than implying a precision the data doesn't have.
 */
function resolveCaptureTimeFromView(view, file) {
  const exif = parseCaptureTime(view);
  if (exif) {
    return { timestamp: exif.date.toISOString(), timestampSource: "camera" };
  }

  // A photo picked from the gallery usually keeps its original file date; one
  // taken through the camera has a date of "just now", which tells us nothing
  // extra, so only treat a clearly older date as meaningful.
  const modified = file.lastModified;
  if (modified && Number.isFinite(modified)) {
    const age = Date.now() - modified;
    const date = new Date(modified);
    if (age > 2 * 60 * 1000 && date.getFullYear() >= 1995) {
      return { timestamp: date.toISOString(), timestampSource: "file" };
    }
  }

  return { timestamp: new Date().toISOString(), timestampSource: "upload" };
}

/** Kept for callers holding only a File they have not read yet. */
export async function resolveCaptureTime(file) {
  const exif = await readCaptureTime(file);
  if (exif) return { timestamp: exif.date.toISOString(), timestampSource: "camera" };

  const modified = file.lastModified;
  if (modified && Number.isFinite(modified)) {
    const age = Date.now() - modified;
    const date = new Date(modified);
    if (age > 2 * 60 * 1000 && date.getFullYear() >= 1995) {
      return { timestamp: date.toISOString(), timestampSource: "file" };
    }
  }
  return { timestamp: new Date().toISOString(), timestampSource: "upload" };
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

/** Human-readable provenance, used in the UI and the PDF. */
export const TIMESTAMP_SOURCES = {
  camera: { short: "from camera", long: "recorded by the camera at capture" },
  file: { short: "file date", long: "taken from the photo file's own date" },
  upload: { short: "added here", long: "the time the photo was added to Casa Check" },
};
