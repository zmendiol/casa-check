import { PhotoTile } from "../components/PhotoTile.jsx";
import { MODES, MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

export function CompareRooms() {
  const { state } = useStore();

  return (
    <>
      <h1 className="page-title">Compare rooms</h1>
      <p className="page-sub">Move-in vs. move-out, side by side, room by room.</p>

      {state.rooms.map((room) => (
        <section className="room-section" key={room.id}>
          <h3 className="room-heading">{room.name}</h3>
          <div className="compare-grid">
            {MODE_KEYS.map((mode) => {
              const photos = room[mode];
              return (
                <div className="compare-col" key={mode}>
                  <h4>
                    {MODES[mode].label.toUpperCase()} ({photos.length})
                  </h4>
                  {photos.length > 0 ? (
                    <div className="photo-grid">
                      {photos.map((photo) => (
                        <PhotoTile key={photo.id} photo={photo} roomName={room.name} />
                      ))}
                    </div>
                  ) : (
                    <p className="empty-note">No photos yet</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
