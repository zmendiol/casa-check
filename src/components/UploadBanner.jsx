import { useStore } from "../state/store.jsx";

/**
 * Import progress, shown on every step.
 *
 * Adding photos used to be reported only by the button inside the room card,
 * so navigating to another step while waiting made it look like the import had
 * stopped. It had not — the work continues regardless of which screen is open —
 * but there was nothing left on screen saying so.
 */
export function UploadBanner() {
  const { state } = useStore();
  const upload = state.upload;
  if (!upload) return null;

  const { done, total, roomName } = upload;
  // `done` counts photos finished; show the one in flight as the current item.
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
      <p className="upload-banner-note">
        Keep this tab open — you can move between steps while it finishes.
      </p>
    </div>
  );
}
