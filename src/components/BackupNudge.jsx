import { backupNudgeVisible, countPhotos, useStore } from "../state/store.jsx";

/**
 * Asks for a backup at the moment the record is worth the most and is most
 * fragile: just after a walkthrough, while the person is still holding their
 * phone and thinking about it.
 *
 * Backup is otherwise opt-in and lives behind a button on the report screen,
 * which nobody visits until they already need the record. That is the single
 * failure mode that can leave someone worse off than if they had never used
 * the app, so this is the one place nagging is justified — but only once per
 * walkthrough's worth of new work, never on an empty record.
 */
export function BackupNudge() {
  const { state, dispatch } = useStore();
  const total = countPhotos(state.rooms);

  if (!backupNudgeVisible(state.backup, total)) return null;

  const first = state.backup.atPhotoCount === null;

  return (
    <div className="backup-nudge" role="status">
      <div className="backup-nudge-text">
        <strong>{first ? "Back this up now." : "Back up again."}</strong>{" "}
        {first
          ? `Your ${total} photo${total === 1 ? " lives" : "s live"} only in this browser. If it is
             cleared, or this device is lost, the record goes with it.`
          : `You have added photos since your last backup, so the file you saved is already out of
             date.`}
      </div>
      <div className="backup-nudge-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: "SET_STEP", step: "report" })}
        >
          Export a backup
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => dispatch({ type: "BACKUP_NUDGE_DISMISSED", photoCount: total })}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
