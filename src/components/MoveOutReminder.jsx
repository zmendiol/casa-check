import { daysUntil } from "../lib/deadline.js";
import { MODE_KEYS } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

/** Show from a month out; there is nothing useful to say before that. */
const WINDOW_DAYS = 30;

/**
 * The move-in pass is worth very little on its own — the argument is a
 * comparison, and without the second half there is nothing to compare to.
 * People do the first walkthrough diligently in August and forget the second
 * entirely in May, which wastes the whole effort.
 *
 * The app knows the move-out date, so it can say something. It only appears
 * inside the window, and only while the move-out pass is genuinely empty.
 */
export function MoveOutReminder() {
  const { state, dispatch } = useStore();
  const days = daysUntil(state.property.moveOutDate);

  if (days === null || days > WINDOW_DAYS) return null;

  const moveOutPhotos = state.rooms.reduce((n, r) => n + r.moveOut.length, 0);
  if (moveOutPhotos > 0) return null;

  const moveInPhotos = state.rooms.reduce((n, r) => n + r.moveIn.length, 0);
  if (moveInPhotos === 0) return null; // nothing to compare against anyway

  const passed = days < 0;
  const when =
    passed
      ? `Your move-out date was ${-days} day${-days === 1 ? "" : "s"} ago.`
      : days === 0
        ? "Your move-out date is today."
        : `Your move-out date is in ${days} day${days === 1 ? "" : "s"}.`;

  return (
    <div className="moveout-reminder" role="status">
      <div className="backup-nudge-text">
        <strong>{when}</strong> You have {moveInPhotos} move-in photo
        {moveInPhotos === 1 ? "" : "s"} and none from move-out. The report compares the two, so
        without the second pass there is nothing to compare against.
      </div>
      <div className="backup-nudge-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            dispatch({ type: "SET_MODE", mode: MODE_KEYS[1] });
            dispatch({ type: "SET_STEP", step: "capture" });
          }}
        >
          Start the move-out pass
        </button>
      </div>
    </div>
  );
}
