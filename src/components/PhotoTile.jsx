import { usePhotoUrl } from "../hooks/usePhotoUrl.js";

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
 * renders the same tile read-only.
 */
export function PhotoTile({ photo, roomName, editable = false, onDelete, onNoteChange }) {
  const url = usePhotoUrl(photo.id);

  return (
    <div className="photo-tile">
      {url ? (
        <img src={url} alt={`${roomName} condition photo taken ${stamp(photo.timestamp)}`} />
      ) : (
        <div className="photo-loading" aria-label="Loading photo" />
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
