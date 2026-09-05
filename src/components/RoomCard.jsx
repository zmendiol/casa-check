import { useRef, useState } from "react";
import { PhotoTile } from "./PhotoTile.jsx";
import { PhotoViewer } from "./PhotoViewer.jsx";
import { compressImage, resolveCaptureTime } from "../lib/images.js";
import { uid } from "../lib/uid.js";
import { deletePhotoBlob, putPhotoBlob } from "../state/storage.js";
import { useStore } from "../state/store.jsx";

export function RoomCard({ room, mode, canRemove }) {
  const { dispatch } = useStore();
  const [renaming, setRenaming] = useState(false);
  // Set when Escape cancels an edit, so the blur that follows the input being
  // unmounted cannot commit the discarded text.
  const cancelledRename = useRef(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null); // index into photos

  const photos = room[mode];
  const busy = progress !== null;

  async function handleFiles(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    // Reset immediately so picking the same file twice still fires a change
    // event — in the original, re-adding a deleted photo silently did nothing.
    input.value = "";
    if (files.length === 0) return;

    setError(null);
    const failures = [];

    // Sequential rather than parallel: decoding several full-resolution photos
    // at once is a good way to make a phone run out of memory mid-walkthrough.
    for (let i = 0; i < files.length; i += 1) {
      setProgress({ done: i + 1, total: files.length });
      const file = files[i];
      try {
        const [blob, when] = await Promise.all([
          compressImage(file),
          resolveCaptureTime(file),
        ]);
        const photo = {
          id: uid(),
          timestamp: when.timestamp,
          timestampSource: when.timestampSource,
          note: "",
        };
        await putPhotoBlob(photo.id, blob);
        dispatch({ type: "ADD_PHOTO", roomId: room.id, mode, photo });
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`);
      }
    }

    setProgress(null);
    if (failures.length > 0) {
      setError(
        failures.length === 1
          ? failures[0]
          : `${failures.length} photos could not be added. ${failures[0]}`
      );
    }
  }

  async function handleDelete(photo) {
    // Photos are the whole point of the record, so deleting one asks first.
    const stamp = new Date(photo.timestamp).toLocaleString();
    if (!window.confirm(`Delete this photo from ${room.name}?\n\nTaken ${stamp}.`)) return;

    dispatch({ type: "REMOVE_PHOTO", roomId: room.id, mode, photoId: photo.id });
    setViewing(null);
    try {
      await deletePhotoBlob(photo.id);
    } catch (err) {
      console.warn("Photo removed from the record but its data lingered.", err);
    }
  }

  async function handleRemoveRoom() {
    const count = room.moveIn.length + room.moveOut.length;
    const detail = count > 0 ? ` and all ${count} of its photos` : "";
    if (!window.confirm(`Remove "${room.name}"${detail}?`)) return;

    dispatch({ type: "REMOVE_ROOM", roomId: room.id });
    const ids = [...room.moveIn, ...room.moveOut].map((p) => p.id);
    await Promise.all(ids.map((id) => deletePhotoBlob(id).catch(() => {})));
  }

  function commitRename(value) {
    const trimmed = value.trim();
    if (trimmed) dispatch({ type: "RENAME_ROOM", roomId: room.id, name: trimmed });
    setRenaming(false);
  }

  return (
    <section className="room-section">
      <div className="room-head">
        <div className="room-title-wrap">
          {renaming ? (
            <input
              className="room-title-input"
              defaultValue={room.name}
              autoFocus
              aria-label="Room name"
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                if (cancelledRename.current) {
                  cancelledRename.current = false;
                  return;
                }
                commitRename(e.target.value);
              }}
              onKeyDown={(e) => {
                // Commit directly rather than via blur(). Relying on blur meant
                // Enter silently did nothing whenever the field had not taken
                // focus, and left the editor open with the text stranded.
                if (e.key === "Enter") {
                  e.preventDefault();
                  cancelledRename.current = true;
                  commitRename(e.currentTarget.value);
                }
                if (e.key === "Escape") {
                  cancelledRename.current = true;
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="room-title"
              title="Click to rename"
              onClick={() => setRenaming(true)}
            >
              {room.name}
            </button>
          )}
        </div>

        <div className="room-actions">
          <span className="photo-count">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </span>
          {canRemove && (
            <button
              type="button"
              className="icon-btn"
              onClick={handleRemoveRoom}
              title="Remove room"
              aria-label={`Remove ${room.name}`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              roomName={room.name}
              editable
              onOpen={() => setViewing(index)}
              onDelete={() => handleDelete(photo)}
              onNoteChange={(note) =>
                dispatch({ type: "SET_PHOTO_NOTE", roomId: room.id, mode, photoId: photo.id, note })
              }
            />
          ))}
        </div>
      )}

      <label className="btn btn-ghost" style={{ cursor: busy ? "default" : "pointer" }}>
        {busy ? `Adding ${progress.done} of ${progress.total}…` : "+ Add photos"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={handleFiles}
        />
      </label>

      {error && (
        <p className="status-line" data-tone="error" role="alert">
          {error}
        </p>
      )}

      {viewing !== null && photos[viewing] && (
        <PhotoViewer
          photos={photos}
          index={viewing}
          roomName={room.name}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
