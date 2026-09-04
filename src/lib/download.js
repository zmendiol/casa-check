/**
 * Hands a generated file to the user.
 *
 * Two very different environments:
 *   - A normal page (npm run dev, or self-hosted): an anchor with `download`.
 *   - Inside the claude.ai artifact viewer: the frame is not permitted to
 *     start a download at all, so an anchor is silently inert. The host
 *     mediates saves through the `downloads` capability instead, and shows
 *     the viewer a confirmation they can decline.
 *
 * The PDF report is the whole point of this app, so a save that quietly does
 * nothing is not an acceptable failure mode in either environment.
 */

const MESSAGES = {
  declined: "Save cancelled.",
  rate_limited: "A save prompt is already open — finish that one first.",
  too_large: "That file is too large for the destination you chose.",
  rejected_extension: "This viewer won't accept that file type.",
};

/**
 * @returns {Promise<{status: "saved" | "declined", filename: string}>}
 */
export async function saveFile(filename, blob) {
  const host = typeof window !== "undefined" ? window.claude : undefined;

  if (host && typeof host.use === "function") {
    const downloads = await host.use("downloads");
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        return { status: "saved", filename };
      } catch (err) {
        if (err?.code === "declined") return { status: "declined", filename };
        // Falling back to an anchor here would be worse than useless: it
        // cannot work in this environment and would report a false success.
        throw new Error(MESSAGES[err?.code] || err?.message || "The file could not be saved.");
      }
    }
    // `use` resolved null: capability unavailable in this view. An anchor is
    // inert here too, so say so rather than pretending the file was saved.
    throw new Error("This viewer does not allow saving files. Open the app directly to export.");
  }

  anchorDownload(filename, blob);
  return { status: "saved", filename };
}

function anchorDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
