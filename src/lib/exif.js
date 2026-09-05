/**
 * Minimal EXIF reader: pulls the original capture time out of a JPEG.
 *
 * This matters more than it looks. The app tells users their photos are
 * "timestamped automatically" and sells that as evidence — but stamping the
 * moment a file was *uploaded* is worthless if someone shoots their
 * walkthrough on Saturday and uploads it on Monday. The camera's own
 * DateTimeOriginal is the defensible number.
 *
 * Only the tags needed for a capture time are decoded; this is not a general
 * EXIF library.
 */

const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TAG_DATE_TIME = 0x0132;

/** EXIF lives in the first APP1 segment, so reading the head of the file is enough. */
const HEAD_BYTES = 256 * 1024;

/**
 * @returns {Promise<{date: Date, offset: string|null} | null>}
 */
export async function readCaptureTime(file) {
  try {
    const buf = await file.slice(0, HEAD_BYTES).arrayBuffer();
    return parseCaptureTime(new DataView(buf));
  } catch {
    // A malformed header must never block adding a photo.
    return null;
  }
}

/**
 * Same, but for a file already read into memory. Photo import reads each file
 * exactly once — on iOS a read can trigger an OS-level HEIC transcode, so
 * reading it a second time just for the timestamp is expensive.
 *
 * @returns {{date: Date, offset: string|null} | null}
 */
export function parseCaptureTime(view) {
  try {
    const app1 = findApp1(view);
    if (app1 == null) return null;
    return readFromTiff(view, app1);
  } catch {
    return null;
  }
}

/**
 * Reads a JPEG's pixel dimensions straight out of its Start-Of-Frame header,
 * without decoding a single pixel.
 *
 * This is what makes fast import possible: knowing the source size up front
 * lets `createImageBitmap` decode DIRECTLY to the size we want, so a 48MP
 * photo never has to exist as a ~190MB bitmap on its way to a 1000px one.
 *
 * @returns {{width: number, height: number} | null}
 */
export function readJpegDimensions(view) {
  try {
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);

      // Standalone markers carry no length payload.
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      // Start of scan / end of image: past every header we care about.
      if (marker === 0xda || marker === 0xd9) return null;

      const size = view.getUint16(offset + 2);
      if (size < 2) return null;

      // SOF0..SOF15 carry the frame size. C4 (DHT), C8 (JPG) and CC (DAC)
      // share the range but are not frame headers.
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

      if (isSof) {
        if (offset + 9 > view.byteLength) return null;
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        if (!width || !height) return null;
        return { width, height };
      }

      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

/** Walks JPEG marker segments looking for APP1 with an "Exif\0\0" preamble. */
function findApp1(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;

    const marker = view.getUint8(offset + 1);
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end of image

    const size = view.getUint16(offset + 2);
    if (size < 2) return null;

    if (marker === 0xe1 && offset + 4 + 6 <= view.byteLength) {
      let preamble = "";
      for (let i = 0; i < 4; i += 1) preamble += String.fromCharCode(view.getUint8(offset + 4 + i));
      if (preamble === "Exif") return offset + 10; // skip "Exif\0\0" to the TIFF header
    }

    offset += 2 + size;
  }
  return null;
}

function readFromTiff(view, tiffStart) {
  if (tiffStart + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiffStart);
  let little;
  if (byteOrder === 0x4949) little = true; // "II"
  else if (byteOrder === 0x4d4d) little = false; // "MM"
  else return null;

  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  const ifd0Tags = readIfd(view, tiffStart, ifd0, little);
  if (!ifd0Tags) return null;

  // DateTimeOriginal lives in the Exif sub-IFD; DateTime in IFD0 is the
  // last-modified time and is only a fallback.
  let raw = null;
  let offsetTag = null;

  const subPointer = ifd0Tags.get(TAG_EXIF_IFD_POINTER);
  if (subPointer != null) {
    const subTags = readIfd(view, tiffStart, tiffStart + subPointer.value, little);
    if (subTags) {
      raw = readAscii(view, tiffStart, subTags.get(TAG_DATE_TIME_ORIGINAL), little);
      offsetTag = readAscii(view, tiffStart, subTags.get(TAG_OFFSET_TIME_ORIGINAL), little);
    }
  }
  if (!raw) raw = readAscii(view, tiffStart, ifd0Tags.get(TAG_DATE_TIME), little);
  if (!raw) return null;

  const date = parseExifDate(raw, offsetTag);
  return date ? { date, offset: offsetTag } : null;
}

function readIfd(view, tiffStart, ifdOffset, little) {
  if (ifdOffset + 2 > view.byteLength) return null;

  const count = view.getUint16(ifdOffset, little);
  // A plausibility check: a corrupt count would otherwise drive a huge loop.
  if (count > 512) return null;

  const tags = new Map();
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    tags.set(view.getUint16(entry, little), {
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      value: view.getUint32(entry + 8, little),
      valueOffset: entry + 8,
    });
  }
  return tags;
}

function readAscii(view, tiffStart, tag, little) {
  if (!tag || tag.type !== 2 || tag.count === 0 || tag.count > 64) return null;

  // Values of 4 bytes or fewer are stored inline rather than at an offset.
  const start = tag.count <= 4 ? tag.valueOffset : tiffStart + tag.value;
  if (start + tag.count > view.byteLength) return null;

  let out = "";
  for (let i = 0; i < tag.count; i += 1) {
    const code = view.getUint8(start + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim() || null;
}

/** EXIF dates look like "2026:09:04 10:45:12", with no timezone of their own. */
function parseExifDate(raw, offset) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;

  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;

  // OffsetTimeOriginal ("+02:00") is optional; without it the only sane
  // reading is the phone's local time, which is what the renter experienced.
  const zone = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : "";
  const date = new Date(zone ? `${iso}${zone}` : iso);

  if (Number.isNaN(date.getTime())) return null;
  // Guard against absurd clocks — a camera reset to 1980 helps nobody.
  const year = date.getFullYear();
  if (year < 1995 || year > new Date().getFullYear() + 1) return null;

  return date;
}
