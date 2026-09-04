import { usePhotoUrl } from "../hooks/usePhotoUrl.js";
import { TIMESTAMP_SOURCES } from "../lib/images.js";

const FULL_STAMP = { dateStyle: "medium", timeStyle: "short" };

function stamp(timestamp, options) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return options ? date.toLocaleString([], options) : date.toLocaleDateString();
}

/**
 * One photo in a grid.
 *
 * `editable` adds the delete button and the note field; the compare view
 * renders the same tile read-only. Either way the image opens full size.
 */
export function PhotoTile({ photo, roomName, editable = false, onOpen, onDelete, onNoteChange }) {
  const url = usePhotoUrl(photo.id);

  // A timestamp taken straight from the camera needs no qualifier. A weaker
  // one does — better the renter knows before a landlord points it out.
  const source = photo.timestampSource || "upload";
  const qualifier = source === "camera" ? null : TIMESTAMP_SOURCES[source]?.short;

  const image = url ? (
    <img src={url} alt={`${roomName} condition photo taken ${stamp(photo.timestamp)}`} />
  ) : (
    <div className="photo-loading" aria-label="Loading photo" />
  );

  return (
    <div className="photo-tile">
      {onOpen ? (
        <button type="button" className="photo-open" onClick={onOpen} aria-label="View full size">
          {image}
        </button>
      ) : (
        image
      )}

      {editable && (
        <button
          type="button"
          className="photo-del"
          onClick={onDelete}
          aria-label={`Delete photo taken ${stamp(photo.timestamp, FULL_STAMP)}`}
          title="Delete photo"
        >
          ×
        </button>
      )}

      <div className="photo-meta">
        {editable ? stamp(photo.timestamp, FULL_STAMP) : stamp(photo.timestamp)}
        {qualifier && <span className="photo-source"> · {qualifier}</span>}
      </div>

      {editable ? (
        <input
          className="photo-note-input"
          placeholder="note (optional)"
          value={photo.note}
          onChange={(e) => onNoteChange(e.target.value)}
          aria-label="Photo note"
        />
      ) : (
        photo.note && <div className="photo-meta">{photo.note}</div>
      )}
    </div>
  );
}
