import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { DEFAULT_ROOM_NAMES, MODE_KEYS, STEPS } from "../lib/constants.js";
import { uid } from "../lib/uid.js";
import {
  clearLegacyRecord,
  dataUrlToBlob,
  loadRecord,
  loadUi,
  pruneOrphanPhotos,
  requestPersistentStorage,
  putPhotoBlob,
  saveRecord,
  saveUi,
} from "./storage.js";

/* ------------------------------------------------------------------ *
 * Shape
 *
 * property : cover-page details
 * rooms    : [{ id, name, moveIn: [photo], moveOut: [photo] }]
 * photo    : { id, timestamp, timestampSource, note }
 *            bytes live in IndexedDB under id; timestampSource records where
 *            the timestamp came from (camera EXIF / file date / upload time)
 * ------------------------------------------------------------------ */

const EMPTY_PROPERTY = {
  school: "",
  communityName: "",
  address: "",
  stateName: "Arizona",
  moveInDate: "",
  moveOutDate: "",
  rules: "",
};

function makeRoom(name) {
  return { id: uid(), name, moveIn: [], moveOut: [] };
}

function defaultRooms() {
  return DEFAULT_ROOM_NAMES.map(makeRoom);
}

/**
 * Accepts whatever is in storage — including records written by the original
 * prototype, where rooms had no ids and photos carried an inline `dataUrl` —
 * and returns the current shape. Legacy photo bytes are tagged so the provider
 * can move them into IndexedDB after mount.
 */
function normalize(record) {
  const property = { ...EMPTY_PROPERTY, ...(record?.property || {}) };

  const rawRooms = Array.isArray(record?.rooms) ? record.rooms : null;
  if (!rawRooms || rawRooms.length === 0) {
    return { property, rooms: defaultRooms() };
  }

  const rooms = rawRooms.map((room) => {
    const next = { id: room.id || uid(), name: room.name || "Room" };
    for (const mode of MODE_KEYS) {
      next[mode] = (Array.isArray(room[mode]) ? room[mode] : []).map((photo) => ({
        id: photo.id || uid(),
        timestamp: photo.timestamp || new Date().toISOString(),
        timestampSource: photo.timestampSource || "upload",
        note: photo.note || "",
        // Present only on records from the pre-IndexedDB build.
        ...(photo.dataUrl ? { legacyDataUrl: photo.dataUrl } : {}),
      }));
    }
    return next;
  });

  return { property, rooms };
}

function createInitialState() {
  const { property, rooms } = normalize(loadRecord());
  const ui = loadUi() || {};
  const step = STEPS.some((s) => s.id === ui.step) ? ui.step : "setup";
  const mode = MODE_KEYS.includes(ui.mode) ? ui.mode : "moveIn";
  // `upload` is transient and deliberately not persisted. It lives here rather
  // than in RoomCard so an import stays visible — and keeps running — when the
  // user wanders off to another step while waiting.
  return { property, rooms, step, mode, upload: null, lastImport: null };
}

/* ------------------------------------------------------------------ *
 * Reducer — pure. All IndexedDB work happens in the action creators.
 * ------------------------------------------------------------------ */

function mapRoom(state, roomId, fn) {
  return { ...state, rooms: state.rooms.map((r) => (r.id === roomId ? fn(r) : r)) };
}

export function reducer(state, action) {
  switch (action.type) {
    case "UPLOAD_START":
      return {
        ...state,
        upload: { done: 0, total: action.total, roomId: action.roomId, roomName: action.roomName },
      };

    case "UPLOAD_PROGRESS":
      // A late progress event from a finished import must not revive the bar.
      return state.upload ? { ...state, upload: { ...state.upload, done: action.done } } : state;

    case "UPLOAD_END":
      return { ...state, upload: null, lastImport: action.stats || null };

    case "SET_STEP":
      // Navigation is blocked while photos import; see Sidebar.
      if (state.upload) return state;
      return { ...state, step: action.step };

    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_PROPERTY_FIELD":
      return { ...state, property: { ...state.property, [action.field]: action.value } };

    case "ADD_ROOM":
      return { ...state, rooms: [...state.rooms, makeRoom(action.name)] };

    case "RENAME_ROOM":
      return mapRoom(state, action.roomId, (room) => ({ ...room, name: action.name }));

    case "REMOVE_ROOM":
      return { ...state, rooms: state.rooms.filter((r) => r.id !== action.roomId) };

    case "ADD_PHOTO":
      return mapRoom(state, action.roomId, (room) => ({
        ...room,
        [action.mode]: [...room[action.mode], action.photo],
      }));

    case "REMOVE_PHOTO":
      return mapRoom(state, action.roomId, (room) => ({
        ...room,
        [action.mode]: room[action.mode].filter((p) => p.id !== action.photoId),
      }));

    case "SET_PHOTO_NOTE":
      return mapRoom(state, action.roomId, (room) => ({
        ...room,
        [action.mode]: room[action.mode].map((p) =>
          p.id === action.photoId ? { ...p, note: action.note } : p
        ),
      }));

    /* Legacy bytes have been written to IndexedDB; drop the inline copy. */
    case "CLEAR_LEGACY_URLS":
      return {
        ...state,
        rooms: state.rooms.map((room) => {
          const next = { ...room };
          for (const mode of MODE_KEYS) {
            next[mode] = room[mode].map(({ legacyDataUrl, ...rest }) => rest);
          }
          return next;
        }),
      };

    /* Wholesale replacement, used when restoring a backup. */
    case "REPLACE_RECORD": {
      const { property, rooms } = normalize(action.record);
      return { ...state, property, rooms };
    }

    case "RESET":
      return {
        property: { ...EMPTY_PROPERTY },
        rooms: defaultRooms(),
        step: "setup",
        mode: "moveIn",
        upload: null,
      };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Provider
 * ------------------------------------------------------------------ */

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const saveTimer = useRef(null);

  // Always the current rooms. The mount-only migration effect below must not
  // prune against a stale snapshot, or a photo added while it runs looks like
  // an orphan and loses its bytes.
  const roomsRef = useRef(state.rooms);
  roomsRef.current = state.rooms;

  // Persist metadata. Debounced because the setup form dispatches per
  // keystroke — which is what stops the original's "navigate away and lose
  // everything you typed" behaviour.
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const rooms = state.rooms.map((room) => {
        const next = { id: room.id, name: room.name };
        for (const mode of MODE_KEYS) {
          next[mode] = room[mode].map(({ legacyDataUrl, ...photo }) => photo);
        }
        return next;
      });
      saveRecord({ property: state.property, rooms });
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [state.property, state.rooms]);

  useEffect(() => {
    saveUi({ step: state.step, mode: state.mode });
  }, [state.step, state.mode]);

  // One-time: move any pre-IndexedDB photo bytes into the blob store, then
  // sweep blobs no room references any more.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;

    (async () => {
      const legacy = [];
      for (const room of state.rooms) {
        for (const mode of MODE_KEYS) {
          for (const photo of room[mode]) {
            if (photo.legacyDataUrl) legacy.push(photo);
          }
        }
      }

      if (legacy.length > 0) {
        try {
          await Promise.all(
            legacy.map(async (photo) => {
              const blob = await dataUrlToBlob(photo.legacyDataUrl);
              await putPhotoBlob(photo.id, blob);
            })
          );
          clearLegacyRecord();
          dispatch({ type: "CLEAR_LEGACY_URLS" });
        } catch (err) {
          console.error("Could not migrate photos from the previous version.", err);
          return;
        }
      }

      await pruneOrphanPhotos(() => roomsRef.current);

      // Ask the browser not to evict this data under storage pressure. A
      // deposit dispute can surface months after move-out.
      const persistence = await requestPersistentStorage();
      if (persistence.supported && !persistence.persisted) {
        console.info("Storage is not marked persistent; the browser may evict photos under pressure.");
      }
    })();
    // Intentionally mount-only; `state.rooms` is read once as a starting point.
    // The ref guard keeps StrictMode's double-invoke from running it twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>.");
  return ctx;
}

/** Total photo count across every room and both passes. */
export function countPhotos(rooms) {
  return rooms.reduce((sum, room) => sum + room.moveIn.length + room.moveOut.length, 0);
}
