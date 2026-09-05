/**
 * Persistence for Casa Check.
 *
 * Two tiers, on purpose:
 *   - Record metadata (property details, room names, photo notes/timestamps)
 *     lives in localStorage. It is small, and being able to eyeball it in
 *     DevTools is genuinely useful.
 *   - Photo bytes live in IndexedDB as Blobs. Photos as base64 in localStorage
 *     would hit the ~5MB quota after roughly 20-30 pictures, which is well
 *     short of a real two-pass walkthrough. Blobs also avoid the ~33% size
 *     penalty base64 imposes.
 *
 * Everything a backend would need to take over is in this file.
 */

const DB_NAME = "casa-check";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

const RECORD_KEY = "casa-check:record";
const UI_KEY = "casa-check:ui";
const LEGACY_KEY = "casa-check-property";

/* ------------------------------------------------------------------ *
 * IndexedDB: a minimal promise wrapper over a single key/blob store.
 * ------------------------------------------------------------------ */

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Casa Check is open in another tab; close it and reload."));
  });

  // A failed open should not be cached forever — let the next call retry.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, mode);
    const store = tx.objectStore(PHOTO_STORE);
    let result;
    try {
      result = run(store);
    } catch (err) {
      reject(err);
      return;
    }
    // `run` hands back an IDBRequest whose `.result` is only populated once the
    // transaction completes. Unwrap it here — and unwrap by type, not by
    // truthiness, so a genuine `undefined` (photo not found) stays undefined
    // instead of leaking the request object to the caller.
    tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Photo transaction aborted."));
  });
}

export function putPhotoBlob(id, blob) {
  return withStore("readwrite", (store) => store.put(blob, id));
}

export function getPhotoBlob(id) {
  return withStore("readonly", (store) => store.get(id));
}

export function deletePhotoBlob(id) {
  forgetPhotoUrl(id);
  return withStore("readwrite", (store) => store.delete(id));
}

export function listPhotoIds() {
  return withStore("readonly", (store) => store.getAllKeys());
}

/* ------------------------------------------------------------------ *
 * Object URL cache.
 *
 * Creating a fresh object URL on every render would leak one per render,
 * so URLs are created once per photo id and revoked when the photo is
 * deleted (or when the whole record is cleared).
 * ------------------------------------------------------------------ */

const urlCache = new Map();

export async function getPhotoUrl(id) {
  const cached = urlCache.get(id);
  if (cached) return cached;

  const blob = await getPhotoBlob(id);
  if (!blob) return null;

  // Another caller may have populated the cache while we awaited.
  const existing = urlCache.get(id);
  if (existing) return existing;

  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function forgetPhotoUrl(id) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/* ------------------------------------------------------------------ *
 * Record metadata in localStorage.
 * ------------------------------------------------------------------ */

export function loadRecord() {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (raw) return JSON.parse(raw);
    return migrateLegacyRecord();
  } catch (err) {
    console.warn("Could not read the saved record; starting fresh.", err);
    return null;
  }
}

export function saveRecord(record) {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));
    return { ok: true };
  } catch (err) {
    // Metadata alone should never approach the quota now that photos are in
    // IndexedDB, but report it rather than swallowing it as the original did.
    console.error("Could not save the record.", err);
    return { ok: false, error: err };
  }
}

export function loadUi() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUi(ui) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* Losing the last-viewed step is not worth surfacing. */
  }
}

/* ------------------------------------------------------------------ *
 * Migration + housekeeping.
 * ------------------------------------------------------------------ */

/**
 * Reads a record written by the original prototype, where every photo carried
 * an inline `dataUrl`. This stays synchronous so the reducer's initializer can
 * use it; the photo bytes are re-homed into IndexedDB by the migration effect
 * in store.jsx once the provider mounts.
 */
function migrateLegacyRecord() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return { property: parsed.property || {}, rooms: parsed.rooms || [] };
  } catch {
    return null;
  }
}

export function clearLegacyRecord() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* no-op */
  }
}

/** Turns a `data:` URL into a Blob without a network round-trip. */
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Deletes photo blobs that no room still references. Orphans accumulate if a
 * write is interrupted between storing a blob and saving the record, and
 * whenever a restore replaces one record with another.
 *
 * @param rooms  the current rooms, or a function returning them. Prefer the
 *               function: a stale snapshot here deletes live photos.
 */
export async function pruneOrphanPhotos(rooms) {
  try {
    // Order matters. List the stored ids FIRST, then read the room list.
    // A photo added after the listing cannot appear in `stored`, and one added
    // before it is present in the rooms read afterwards — so a photo added
    // while this runs is never mistaken for an orphan. Reading rooms first (as
    // this did) left a window where a just-added photo was in neither set and
    // had its bytes deleted.
    const stored = await listPhotoIds();
    const current = typeof rooms === "function" ? rooms() : rooms || [];

    const referenced = new Set();
    for (const room of current) {
      for (const mode of ["moveIn", "moveOut"]) {
        for (const photo of room[mode] || []) referenced.add(photo.id);
      }
    }
    const orphans = stored.filter((id) => !referenced.has(id));
    await Promise.all(orphans.map((id) => deletePhotoBlob(id)));
    return orphans.length;
  } catch (err) {
    console.warn("Orphan photo cleanup skipped.", err);
    return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Durability
 * ------------------------------------------------------------------ */

/**
 * Asks the browser to treat this origin's data as persistent.
 *
 * Without this, IndexedDB is "best effort": a browser under storage pressure
 * may evict it with no warning and no recourse. For a record someone may need
 * months later at a deposit dispute, best-effort is the wrong default.
 *
 * Chrome usually grants this silently for installed or frequently visited
 * sites; Firefox prompts. A refusal is not an error worth interrupting for.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    if (await navigator.storage.persisted()) return { supported: true, persisted: true };
    return { supported: true, persisted: await navigator.storage.persist() };
  } catch {
    return { supported: false, persisted: false };
  }
}

/**
 * Reads whether storage is already persistent WITHOUT requesting it.
 *
 * `persist()` is a permission request that prompts in some browsers, so it
 * belongs on startup only. Anything that merely displays the status uses this.
 */
export async function getPersistenceStatus() {
  try {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false };
    return { supported: true, persisted: await navigator.storage.persisted() };
  } catch {
    return { supported: false, persisted: false };
  }
}

/** Bytes used and available, when the browser will say. */
export async function estimateUsage() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage == null) return null;
    return { usage, quota: quota ?? null };
  } catch {
    return null;
  }
}

/** Wipes the record, the UI state, and every stored photo. */
export async function clearAll() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  try {
    localStorage.removeItem(RECORD_KEY);
    localStorage.removeItem(UI_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* no-op */
  }
  await withStore("readwrite", (store) => store.clear());
}

/**
 * Checks that photo storage actually works here before the user relies on it.
 *
 * Chrome refuses IndexedDB on `file://` origins, so a build opened by
 * double-clicking would accept a photo, fail to store it, and only say so
 * after the fact. Better to know on arrival.
 */
export async function checkStorageAvailable() {
  try {
    await openDb();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        location.protocol === "file:"
          ? "Browsers block photo storage for pages opened directly from a file. Serve this page over http:// or https:// — for example with `npm run dev` — and photos will save normally."
          : `Photo storage is unavailable in this browser: ${err.message}`,
    };
  }
}
