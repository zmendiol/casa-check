/**
 * Whole-record backup as a single self-contained JSON file.
 *
 * Everything Casa Check knows lives in one browser profile. Clearing site data,
 * losing the laptop, or switching to a phone loses the evidence — which is a
 * poor property for an app whose entire job is preserving it. The PDF is a
 * human-readable artifact; this is the restorable one.
 *
 * Photos are inlined as data URLs so the file stands alone.
 */

import { MODE_KEYS } from "./constants.js";
import { blobToDataUrl } from "./images.js";
import { saveFile } from "./download.js";
import { dataUrlToBlob, getPhotoBlob, putPhotoBlob } from "../state/storage.js";

const FORMAT = "casa-check-backup";
const VERSION = 1;

/**
 * @param {{property: object, rooms: Array}} record
 * @param {(p: {done: number, total: number}) => void} [onProgress]
 */
export async function exportBackup(record, onProgress = () => {}) {
  const total = record.rooms.reduce(
    (sum, room) => sum + room.moveIn.length + room.moveOut.length,
    0
  );
  let done = 0;
  const missing = [];

  const rooms = [];
  for (const room of record.rooms) {
    const out = { id: room.id, name: room.name };
    for (const mode of MODE_KEYS) {
      out[mode] = [];
      for (const photo of room[mode]) {
        done += 1;
        onProgress({ done, total });

        let dataUrl = null;
        try {
          const blob = await getPhotoBlob(photo.id);
          if (blob) dataUrl = await blobToDataUrl(blob);
          else missing.push(photo.id);
        } catch {
          missing.push(photo.id);
        }

        // A photo whose bytes are gone is still worth carrying as a record of
        // what existed; the import side tolerates a null dataUrl.
        out[mode].push({
          id: photo.id,
          timestamp: photo.timestamp,
          timestampSource: photo.timestampSource || "upload",
          note: photo.note || "",
          dataUrl,
        });
      }
    }
    rooms.push(out);
  }

  const payload = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    property: record.property,
    rooms,
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const filename = `casa-check-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const { status } = await saveFile(filename, blob);

  return { filename, photoCount: total, missing: missing.length, status };
}

/**
 * Reads a backup file and writes its photos back into IndexedDB.
 * Returns the record for the caller to put into the store — this function
 * deliberately does not touch app state itself.
 */
export async function importBackup(file) {
  const text = await file.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!payload || payload.format !== FORMAT) {
    throw new Error("That doesn't look like a Casa Check backup.");
  }
  if (payload.version > VERSION) {
    throw new Error("That backup was made by a newer version of Casa Check.");
  }
  if (!Array.isArray(payload.rooms)) {
    throw new Error("That backup is missing its room data.");
  }

  let restored = 0;
  const rooms = [];

  for (const room of payload.rooms) {
    const out = { id: room.id, name: room.name || "Room" };
    for (const mode of MODE_KEYS) {
      out[mode] = [];
      for (const photo of room[mode] || []) {
        if (photo.dataUrl) {
          try {
            await putPhotoBlob(photo.id, await dataUrlToBlob(photo.dataUrl));
            restored += 1;
          } catch {
            // Keep going: one unreadable photo shouldn't abort the restore.
          }
        }
        out[mode].push({
          id: photo.id,
          timestamp: photo.timestamp,
          timestampSource: photo.timestampSource || "upload",
          note: photo.note || "",
        });
      }
    }
    rooms.push(out);
  }

  return {
    record: { property: payload.property || {}, rooms },
    restored,
    exportedAt: payload.exportedAt || null,
  };
}

