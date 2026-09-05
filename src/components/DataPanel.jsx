import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup } from "../lib/backup.js";
import {
  clearAll,
  estimateUsage,
  getPersistenceStatus,
  pruneOrphanPhotos,
} from "../state/storage.js";
import { countPhotos, useStore } from "../state/store.jsx";

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Backup, restore, and reset.
 *
 * Everything Casa Check holds lives in one browser profile, which is a fragile
 * place for something you may need at a deposit dispute months later. The PDF
 * is the readable artifact; the JSON backup is the restorable one.
 */
export function DataPanel() {
  const { state, dispatch } = useStore();
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Read the status; never re-request it. persist() is a permission
      // prompt in some browsers, and this effect reruns on every photo added.
      // The one actual request happens once, at store startup.
      const [usage, persistence] = await Promise.all([
        estimateUsage(),
        getPersistenceStatus(),
      ]);
      if (active) setStorage({ usage, persistence });
    })();
    return () => {
      active = false;
    };
  }, [state.rooms]);

  const record = { property: state.property, rooms: state.rooms };
  const total = countPhotos(state.rooms);

  async function handleExport() {
    setBusy(true);
    setStatus({ tone: "muted", message: "Packaging photos…" });
    try {
      const { filename, missing, status: saveStatus } = await exportBackup(record, ({ done, total: n }) =>
        setStatus({ tone: "muted", message: `Packaging photo ${done} of ${n}…` })
      );
      if (saveStatus === "declined") {
        setStatus({ tone: "muted", message: "Save cancelled — no backup was written." });
        return;
      }
      setStatus({
        tone: missing > 0 ? "error" : "success",
        message:
          missing > 0
            ? `Saved ${filename}, but ${missing} photo${missing === 1 ? "" : "s"} had no stored image data.`
            : `Saved ${filename}. Keep it somewhere outside this browser.`,
      });
    } catch (err) {
      setStatus({ tone: "error", message: `Backup failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (total > 0 && !window.confirm(
      `Restoring replaces the record currently open (${total} photo${total === 1 ? "" : "s"}). Continue?`
    )) {
      return;
    }

    setBusy(true);
    setStatus({ tone: "muted", message: "Restoring…" });
    try {
      const { record: restored, restored: count, exportedAt } = await importBackup(file);
      dispatch({ type: "REPLACE_RECORD", record: restored });

      // The replaced record's photos are now unreferenced. Without this they
      // sit in IndexedDB forever, eating quota that the new record needs.
      await pruneOrphanPhotos(restored.rooms);
      const when = exportedAt ? ` from ${new Date(exportedAt).toLocaleDateString()}` : "";
      setStatus({
        tone: "success",
        message: `Restored ${count} photo${count === 1 ? "" : "s"}${when}.`,
      });
    } catch (err) {
      setStatus({ tone: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!window.confirm(
      "Start a new property?\n\nThis permanently deletes the current record and every photo in it. Export a backup first if you might need it."
    )) {
      return;
    }
    if (!window.confirm("Last check — this cannot be undone. Delete everything?")) return;

    setBusy(true);
    try {
      await clearAll();
      dispatch({ type: "RESET" });
      setStatus({ tone: "success", message: "Cleared. Ready for a new property." });
    } catch (err) {
      setStatus({ tone: "error", message: `Could not clear storage: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="data-panel">
      <h3>Your data</h3>
      <p>
        Everything is stored in this browser only. If you clear your browsing data or lose this
        device, the record goes with it — export a backup you can keep somewhere else.
      </p>

      <div className="data-actions">
        <button type="button" className="btn btn-primary" onClick={handleExport} disabled={busy}>
          Export backup
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Restore from backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />
        <button type="button" className="btn btn-danger" onClick={handleReset} disabled={busy}>
          Start a new property
        </button>
      </div>

      {status && (
        <p className="status-line" data-tone={status.tone} role="status" aria-live="polite">
          {status.message}
        </p>
      )}

      {storage?.usage && (
        <p className="storage-note">
          Using {formatBytes(storage.usage.usage)}
          {storage.usage.quota ? ` of about ${formatBytes(storage.usage.quota)} available` : ""}.{" "}
          {storage.persistence.persisted
            ? "This browser has marked your data as persistent, so it won't be cleared automatically."
            : "Your browser has not marked this data as persistent, so it could be cleared if storage runs low. A backup is the safe answer."}
        </p>
      )}
    </div>
  );
}
