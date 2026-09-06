/**
 * Off-main-thread photo encoding.
 *
 * Decoding and re-encoding a phone photo is the only genuinely expensive thing
 * this app does, and how expensive depends entirely on the device. Doing it on
 * the main thread means the interface freezes for however long that takes — a
 * few milliseconds on a laptop, potentially a few hundred per photo on an
 * older phone. Moving it into workers makes the cost invisible regardless of
 * hardware, and lets several photos genuinely run at once across cores rather
 * than merely interleaving on one.
 *
 * The worker body is kept dependency-free on purpose: the caller does the
 * cheap header parsing and hands over finished numbers, so this can be shipped
 * as a Blob URL. That keeps it working identically in the normal build and in
 * the single-file build, with no bundler-specific worker plumbing.
 */

/* eslint-disable no-restricted-globals */
function workerBody() {
  self.onmessage = async (event) => {
    const { id, buffer, type, targetWidth, targetHeight, quality } = event.data;
    try {
      const blob = new Blob([buffer], { type });

      const options = { imageOrientation: "from-image" };
      if (targetWidth && targetHeight) {
        options.resizeWidth = targetWidth;
        options.resizeHeight = targetHeight;
        options.resizeQuality = "high";
      }

      let bitmap;
      try {
        bitmap = await createImageBitmap(blob, options);
      } catch {
        // Some engines reject the resize options; a plain decode still works.
        bitmap = await createImageBitmap(blob);
      }

      const width = targetWidth || bitmap.width;
      const height = targetHeight || bitmap.height;

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
      self.postMessage({ id, ok: true, blob: out });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
    }
  };
}
/* eslint-enable no-restricted-globals */

/** How many photos to process at once, scaled to the device. */
export function recommendedLanes() {
  const cores = navigator.hardwareConcurrency || 2;
  // Leave a core for the UI; never fewer than one lane, never more than four
  // (beyond that the photo library read, not the CPU, is the limit).
  return Math.min(4, Math.max(1, cores - 1));
}

const supported =
  typeof Worker === "function" &&
  typeof OffscreenCanvas === "function" &&
  typeof createImageBitmap === "function";

let pool = null;

function getPool() {
  if (!supported) return null;
  if (pool) return pool;

  try {
    const source = `(${workerBody.toString()})()`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

    const size = recommendedLanes();
    const workers = [];
    for (let i = 0; i < size; i += 1) workers.push(new Worker(url));

    // The URL stays valid for already-constructed workers.
    URL.revokeObjectURL(url);

    pool = { workers, next: 0, pending: new Map(), seq: 0, broken: false };

    for (const worker of workers) {
      worker.onmessage = (event) => {
        const { id, ok, blob, error } = event.data;
        const entry = pool.pending.get(id);
        if (!entry) return;
        pool.pending.delete(id);
        if (ok) entry.resolve(blob);
        else entry.reject(new Error(error || "worker failed"));
      };
      worker.onerror = () => {
        // One broken worker means the whole approach is unavailable here;
        // callers fall back to the main thread rather than hanging.
        pool.broken = true;
        for (const { reject } of pool.pending.values()) reject(new Error("worker failed"));
        pool.pending.clear();
      };
    }

    return pool;
  } catch {
    pool = null;
    return null;
  }
}

/**
 * Encodes in a worker. Resolves to `null` when workers are unavailable here,
 * which tells the caller to do it on the main thread instead.
 *
 * `buffer` is transferred, so the caller must not use it afterwards.
 *
 * @returns {Promise<Blob|null>}
 */
export async function encodeInWorker({ buffer, type, targetWidth, targetHeight, quality }) {
  const active = getPool();
  if (!active || active.broken) return null;

  const id = active.seq;
  active.seq += 1;

  const worker = active.workers[active.next % active.workers.length];
  active.next += 1;

  return new Promise((resolve, reject) => {
    active.pending.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, buffer, type, targetWidth, targetHeight, quality }, [buffer]);
    } catch (err) {
      active.pending.delete(id);
      reject(err);
    }
  });
}

/** True when the worker path is usable, for callers that want to log it. */
export function workersAvailable() {
  return Boolean(getPool());
}
