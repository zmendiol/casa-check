import { useState } from "react";
import { PhotoTile } from "../components/PhotoTile.jsx";
import { PhotoViewer } from "../components/PhotoViewer.jsx";
import { MODES, MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

export function CompareRooms() {
  const { state } = useStore();
  // { photos, index, roomName } — comparing at thumbnail size is guesswork,
  // so this screen opens full size too.
  const [viewing, setViewing] = useState(null);

  // During the move-in pass every right-hand column is empty, which is correct
  // and reads like failure. Say once, at the top, that the blank half is the
  // part that has not happened yet rather than the part that went wrong.
  const noMoveOutYet = state.rooms.every((room) => room.moveOut.length === 0);

  return (
    <>
      <h1 className="page-title">Compare rooms</h1>
      <p className="page-sub">
        Move-in vs. move-out, side by side, room by room.
        {noMoveOutYet &&
          " The move-out column fills in during your second walkthrough — that pairing is what the report argues from."}
      </p>

      {state.rooms.map((room) => (
        <section className="room-section" key={room.id}>
          <h3 className="room-heading">{room.name}</h3>
          <div className="compare-grid">
            {MODE_KEYS.map((mode) => {
              const photos = room[mode];
              return (
                <div className={`compare-col compare-${mode}`} key={mode}>
                  <h4>
                    <span className="pass-dot" aria-hidden="true" />
                    {MODES[mode].label.toUpperCase()} ({photos.length})
                  </h4>
                  {photos.length > 0 ? (
                    <div className="photo-grid">
                      {photos.map((photo, index) => (
                        <PhotoTile
                          key={photo.id}
                          photo={photo}
                          roomName={`${room.name} — ${MODES[mode].label}`}
                          onOpen={() =>
                            setViewing({
                              photos,
                              index,
                              roomName: `${room.name} — ${MODES[mode].label}`,
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="empty-note">
                      No {MODES[mode].label.toLowerCase()} photos yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {viewing && (
        <PhotoViewer
          photos={viewing.photos}
          index={viewing.index}
          roomName={viewing.roomName}
          onIndexChange={(index) => setViewing((v) => ({ ...v, index }))}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
