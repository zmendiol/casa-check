import { useState } from "react";
import { PhotoTile } from "./PhotoTile.jsx";
import { compressImage } from "../lib/images.js";
import { uid } from "../lib/uid.js";
import { deletePhotoBlob, putPhotoBlob } from "../state/storage.js";
import { useStore } from "../state/store.jsx";

export function RoomCard({ room, mode, canRemove }) {
  const { dispatch } = useStore();
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const photos = room[mode];

  async function handleFile(event) {
    const input = event.target;
    const file = input.files?.[0];
    // Reset immediately so picking the same file twice still fires a change
    // event — in the original, re-adding a deleted photo silently did nothing.
    input.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file);
      const photo = { id: uid(), timestamp: new Date().toISOString(), note: "" };
      await putPhotoBlob(photo.id, blob);
      dispatch({ type: "ADD_PHOTO", roomId: room.id, mode, photo });
    } catch (err) {
      setError(err.message || "That photo could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photo) {
    dispatch({ type: "REMOVE_PHOTO", roomId: room.id, mode, photoId: photo.id });
    try {
      await deletePhotoBlob(photo.id);
    } catch (err) {
      console.warn("Photo removed from the record but its data lingered.", err);
    }
  }

  async function handleRemoveRoom() {
    const confirmed = window.confirm(`Remove "${room.name}" and all its photos?`);
    if (!confirmed) return;

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
              onBlur={(e) => commitRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
                if (e.key === "Escape") setRenaming(false);
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
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              roomName={room.name}
              editable
              onDelete={() => handleDelete(photo)}
              onNoteChange={(note) =>
                dispatch({ type: "SET_PHOTO_NOTE", roomId: room.id, mode, photoId: photo.id, note })
              }
            />
          ))}
        </div>
      )}

      <label className="btn btn-ghost" style={{ cursor: busy ? "default" : "pointer" }}>
        {busy ? "Adding…" : "+ Add photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={handleFile}
        />
      </label>

      {error && (
        <p className="status-line" data-tone="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
