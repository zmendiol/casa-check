import { useState } from "react";
import { BackupNudge } from "../components/BackupNudge.jsx";
import { RoomCard } from "../components/RoomCard.jsx";
import { MODES, MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

/**
 * "Bathroom", "Bedroom and Bathroom", "Living Room, Bedroom and Bathroom".
 *
 * Rooms are user-named and unbounded in number, so a long list is truncated
 * rather than allowed to run down the page.
 */
function listNames(names) {
  if (names.length > 4) return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function PhotoWalkthrough() {
  const { state, dispatch } = useStore();
  const [newRoom, setNewRoom] = useState("");

  // True until this pass has its first photo. Guidance belongs where someone
  // is about to act, but only while they still need it.
  const passIsEmpty = state.rooms.every((room) => room[state.mode].length === 0);

  // A half-documented apartment is worth very little, and the only place that
  // currently says so is the report screen — which someone standing in a
  // bedroom never opens. So the walkthrough states its own coverage: how many
  // rooms are done, and which ones are not.
  const remaining = state.rooms.filter((room) => room[state.mode].length === 0);
  const covered = state.rooms.length - remaining.length;

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

      {/* Not shown before the first photo: "0 of 4" tells someone who has only
          just arrived nothing they do not know, and the capture hint below is
          already doing the work at that point. One line, naming the rooms, in
          place of an empty-state note repeated inside every empty card. */}
      {!passIsEmpty && (
        <p className="pass-progress" role="status">
          {remaining.length === 0 ? (
            <>
              <strong>
                {MODES[state.mode].label} walkthrough complete — all{" "}
                {state.rooms.length === 1 ? "1 room" : `${state.rooms.length} rooms`}.
              </strong>{" "}
              {state.mode === "moveIn"
                ? "Export a PDF from Generate report to keep a dated copy off this device, then come back when you move out."
                : "Compare rooms puts the two passes side by side, and Generate report exports both."}
            </>
          ) : (
            <>
              <strong>
                {covered} of {state.rooms.length} rooms
              </strong>{" "}
              photographed for {MODES[state.mode].label.toLowerCase()}. Nothing yet in{" "}
              {listNames(remaining.map((room) => room.name))}.
            </>
          )}
        </p>
      )}

      <BackupNudge />

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
