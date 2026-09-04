import { useState } from "react";
import { RoomCard } from "../components/RoomCard.jsx";
import { MODES, MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

export function PhotoWalkthrough() {
  const { state, dispatch } = useStore();
  const [newRoom, setNewRoom] = useState("");

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
