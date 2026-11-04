import { useState } from "react";
import { RoomCard } from "../components/RoomCard.jsx";
import { MODES, MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

export function PhotoWalkthrough() {
  const { state, dispatch } = useStore();
  const [newRoom, setNewRoom] = useState("");

  // True until this pass has its first photo. Guidance belongs where someone
  // is about to act, but only while they still need it.
  const passIsEmpty = state.rooms.every((room) => room[state.mode].length === 0);

  function addRoom() {
    const name = newRoom.trim();
    if (!name) return;
    dispatch({ type: "ADD_ROOM", name });
    setNewRoom("");
  }

  return (
    <>
      <h1 className="page-title">Photo walkthrough</h1>
      <p className="page-sub">
        Photograph each room. Every photo is timestamped automatically. Click any room name to
        rename it.
      </p>

      <div className="mode-toggle" role="tablist" aria-label="Documentation pass">
        {MODE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={state.mode === key}
            className={state.mode === key ? "active" : ""}
            onClick={() => dispatch({ type: "SET_MODE", mode: key })}
          >
            {MODES[key].label}
          </button>
        ))}
      </div>

      {/* Two notes sharing one slot, so neither competes with the other: what
          to shoot before there are photos, and what not to do once there are. */}
      {passIsEmpty ? (
        <p className="capture-hint">
          <strong>What to capture in each room:</strong> walls and paint · floors and carpet ·
          appliances · fixtures and blinds — plus a close-up of anything already damaged.
        </p>
      ) : (
        // Casa Check keeps a resized copy in this browser. The full-resolution
        // originals in the camera roll are better evidence and back themselves
        // up; deleting them to free space would leave the smaller copy as the
        // only one, in the one place that can lose it.
        <p className="capture-hint">
          <strong>Keep the originals too.</strong> Casa Check stores its own smaller copies here.
          Your phone keeps the full-resolution versions — and usually backs them up — so leave them
          in your camera roll rather than clearing them for space.
        </p>
      )}

      <div>
        {state.rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            mode={state.mode}
            canRemove={state.rooms.length > 1}
          />
        ))}
      </div>

      <div className="add-room-row">
        <input
          type="text"
          placeholder="Add a room (e.g. Patio, Garage, Common Area)"
          value={newRoom}
          aria-label="New room name"
          onChange={(e) => setNewRoom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addRoom();
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={addRoom} disabled={!newRoom.trim()}>
          + Add room
        </button>
      </div>
    </>
  );
}
