import { useState } from "react";
import { generateReport } from "../lib/pdf.js";
import { countPhotos, useStore } from "../state/store.jsx";

export function GenerateReport() {
  const { state } = useStore();
  const [status, setStatus] = useState(null); // { tone, message }
  const [busy, setBusy] = useState(false);

  const totalPhotos = countPhotos(state.rooms);
  const summary = state.property.communityName || state.property.address || "No property set yet";

  async function handleGenerate() {
    setBusy(true);
    setStatus({ tone: "muted", message: "Preparing report…" });

    try {
      const { filename, failed } = await generateReport(
        { property: state.property, rooms: state.rooms },
        ({ done, total, label }) =>
          setStatus({ tone: "muted", message: `Adding photo ${done} of ${total} — ${label}` })
      );

      // The original swallowed embedding errors, so photos could vanish from a
      // report with no indication. Say so instead.
      if (failed.length > 0) {
        setStatus({
          tone: "error",
          message: `Saved ${filename}, but ${failed.length} photo${
            failed.length === 1 ? "" : "s"
          } could not be embedded (${failed[0].reason}). The rest of the report is complete.`,
        });
      } else {
        setStatus({ tone: "success", message: `Saved ${filename}.` });
      }
    } catch (err) {
      console.error("Report generation failed.", err);
      setStatus({ tone: "error", message: `Could not generate the report: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Generate your report</h1>
      <p className="page-sub">
        Compiles your property info, community rules, photos, timestamps, and notes into one PDF you
        can send to a landlord or bring to small claims court.
      </p>

      <div className="report-cta">
        <h3>Ready to export</h3>
        <p>
          {summary} · {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} across {state.rooms.length}{" "}
          room{state.rooms.length === 1 ? "" : "s"}
        </p>

        <button type="button" className="btn btn-amber" onClick={handleGenerate} disabled={busy}>
          {busy ? "Building PDF…" : "Download PDF report"}
        </button>

        {status && (
          <p className="status-line" data-tone={status.tone} role="status" aria-live="polite">
            {status.message}
          </p>
        )}

        <p className="save-note">
          Your photos are saved in this browser as you go. Export a PDF as a permanent backup.
        </p>
      </div>

      {state.property.rules && (
        <>
          <div className="section-label">Property rules on file</div>
          <div className="rules-preview">{state.property.rules}</div>
        </>
      )}
    </>
  );
}
