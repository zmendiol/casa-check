import { useEffect, useState } from "react";
import { checkStorageAvailable } from "../state/storage.js";

/**
 * Shown only when photo storage is genuinely unusable — most often because the
 * page was opened from a file:// path, where browsers refuse IndexedDB.
 */
export function StorageWarning() {
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    let active = true;
    checkStorageAvailable().then((result) => {
      if (active && !result.ok) setProblem(result.reason);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!problem) return null;

  return (
    <div className="storage-warning" role="alert">
      <strong>Photos can’t be saved here.</strong> {problem}
    </div>
  );
}
