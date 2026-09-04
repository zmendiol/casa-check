import { useEffect, useState } from "react";
import { getPhotoUrl } from "../state/storage.js";

/**
 * Resolves a stored photo id to a displayable object URL.
 *
 * URLs are cached and revoked centrally in storage.js rather than per-render,
 * so mounting the same photo in both the walkthrough and the compare view
 * reuses one URL instead of leaking a second.
 */
export function usePhotoUrl(id) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    setUrl(null);

    getPhotoUrl(id)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch((err) => {
        console.warn(`Could not load photo ${id}.`, err);
        if (active) setUrl(null);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return url;
}
