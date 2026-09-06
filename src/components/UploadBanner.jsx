import { useStore } from "../state/store.jsx";

/** "1.4s" / "820ms" */
function ms(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

/**
 * Import progress, and — when an import was slow — where the time went.
 *
 * The breakdown is not decoration. Import speed depends heavily on the device
 * and on how the photo reached it (a picture still in iCloud has to come down
 * the wire first, and iOS may transcode HEIC on read). Those costs are
 * invisible from a developer's machine, so the app measures them where they
 * actually happen and says so.
 */
export function UploadBanner() {
  const { state } = useStore();
  const upload = state.upload;
  const last = state.lastImport;

  if (upload) {
    const { done, total, roomName } = upload;
    const current = Math.min(done + 1, total);
    const pct = Math.round((done / total) * 100);

    return (
      <div className="upload-banner" role="status" aria-live="polite">
        <div className="upload-banner-head">
          <span>
            Adding {current} of {total} to {roomName}…
          </span>
          <span className="upload-banner-pct">{pct}%</span>
        </div>
        <div className="upload-bar">
          <div className="upload-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // Only worth showing when it was slow enough to notice.
  if (!last || last.totalMs < 1500) return null;

  // Per photo, not summed: the stages overlap across lanes, so totals would
  // add up to more than the elapsed time and read as nonsense.
  const per = (total) => ms(total / last.count);
  const slowest =
    last.readMs >= last.encodeMs && last.readMs >= last.storeMs
      ? "read"
      : last.encodeMs >= last.storeMs
        ? "resize"
        : "save";

  return (
    <div className="upload-banner upload-banner-report" role="status">
      <div className="upload-banner-head">
        <span>
          {last.count} photo{last.count === 1 ? "" : "s"} ({last.megabytes} MB) in {ms(last.totalMs)}
        </span>
      </div>
      <p className="upload-banner-note">
        Per photo: reading {per(last.readMs)} · resizing {per(last.encodeMs)} · saving{" "}
        {per(last.storeMs)} · {last.worker ? "background thread" : "main thread"} · {last.lanes} at
        a time
      </p>
      <p className="upload-banner-note">
        {slowest === "read"
          ? "Most of the time went to your phone handing over the photo, which Casa Check cannot speed up. Photos already downloaded to the device (not still in iCloud) import fastest."
          : slowest === "resize"
            ? "Most of the time went to resizing, which is limited by this device's processor."
            : "Most of the time went to saving to this browser's storage."}
      </p>
    </div>
  );
}
