import { useCallback, useEffect } from "react";
import { usePhotoUrl } from "../hooks/usePhotoUrl.js";
import { TIMESTAMP_SOURCES } from "../lib/images.js";

/**
 * Full-size photo overlay.
 *
 * The grid crops thumbnails to a 92px square-ish tile, which is fine for
 * counting photos and useless for checking whether the scratch you meant to
 * document is actually in frame. This is the "did I get the shot" view.
 */
export function PhotoViewer({ photos, index, roomName, onIndexChange, onClose }) {
  const photo = photos[index];
  const url = usePhotoUrl(photo.id);

  const go = useCallback(
    (delta) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    // Stop the page behind the overlay from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const source = TIMESTAMP_SOURCES[photo.timestampSource] || TIMESTAMP_SOURCES.upload;

  return (
    <div
      className="viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${roomName} photo ${index + 1} of ${photos.length}`}
      onClick={onClose}
    >
      {/* Clicks inside the frame shouldn't dismiss it. */}
      <div className="viewer-frame" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-bar">
          <span>
            {roomName} · {index + 1} of {photos.length}
          </span>
          <button type="button" className="viewer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="viewer-stage">
          {index > 0 && (
            <button
              type="button"
              className="viewer-nav viewer-prev"
              onClick={() => go(-1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          {url ? (
            <img src={url} alt={`${roomName}, full size`} />
          ) : (
            <p className="viewer-loading">Loading…</p>
          )}

          {index < photos.length - 1 && (
            <button
              type="button"
              className="viewer-nav viewer-next"
              onClick={() => go(1)}
              aria-label="Next photo"
            >
              ›
            </button>
          )}
        </div>

        <div className="viewer-caption">
          <strong>{new Date(photo.timestamp).toLocaleString()}</strong>
          <span className="viewer-source">{source.long}</span>
          {photo.note && <p>{photo.note}</p>}
        </div>
      </div>
    </div>
  );
}
