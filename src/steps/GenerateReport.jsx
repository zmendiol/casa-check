import { useState } from "react";
import { DataPanel } from "../components/DataPanel.jsx";
import { MODE_KEYS } from "../lib/constants.js";
import { generateReport } from "../lib/pdf.js";
import { countPhotos, useStore } from "../state/store.jsx";

/** How many photos carry a timestamp weaker than a camera-recorded one. */
function countWeakTimestamps(rooms) {
  let weak = 0;
  for (const room of rooms) {
    for (const mode of MODE_KEYS) {
      for (const photo of room[mode]) {
        if (photo.timestampSource !== "camera") weak += 1;
      }
    }
  }
  return weak;
}

/**
 * What the PDF will actually contain, and what is missing from it.
 *
 * This screen is the deliverable — the thing handed to a landlord or taken to
 * small claims — so the useful question here is not "can I export" but "is
 * what I am about to export complete". A gap found now is fixable; the same
 * gap found during a dispute is not.
 */
function buildManifest(property, rooms) {
  const count = (mode) => rooms.reduce((n, r) => n + r[mode].length, 0);
  const notes = rooms.reduce(
    (n, r) => n + [...r.moveIn, ...r.moveOut].filter((p) => p.note.trim()).length,
    0
  );
  const moveIn = count("moveIn");
  const moveOut = count("moveOut");
  const roomsWithMoveIn = rooms.filter((r) => r.moveIn.length > 0).length;

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // Date inputs hand back yyyy-mm-dd; show it the way the rest of the screen
  // reads. Built locally rather than parsed as UTC, which slips a day west of
  // Greenwich.
  const readableDate = (value) => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return value;
    return new Date(y, m - 1, d).toLocaleDateString([], { dateStyle: "long" });
  };

  return [
    {
      label: "Property",
      value: property.communityName || property.address || null,
      missing: "Name or address not set",
      step: "setup",
    },
    {
      label: "Move-in date",
      value: readableDate(property.moveInDate),
      missing: "Not set",
      step: "setup",
    },
    {
      label: "Move-out date",
      value: readableDate(property.moveOutDate),
      // Genuinely not needed yet during the move-in pass.
      missing: "Not set yet",
      step: "setup",
      optional: true,
    },
    {
      label: "Move-in photos",
      value: moveIn ? `${plural(moveIn, "photo")} across ${plural(roomsWithMoveIn, "room")}` : null,
      missing: "None yet — this is the evidence the report rests on",
      step: "capture",
    },
    {
      label: "Move-out photos",
      value: moveOut ? plural(moveOut, "photo") : null,
      missing: "None yet — add these when you move out",
      step: "capture",
      optional: true,
    },
    {
      label: "Photo notes",
      value: notes ? plural(notes, "note") : null,
      missing: "None — optional, but they explain what a photo shows",
      step: "capture",
      optional: true,
    },
    {
      label: "Property rules",
      value: property.rules ? "On file" : null,
      missing: "None on file — optional",
      step: "setup",
      optional: true,
    },
  ];
}

export function GenerateReport() {
  const { state, dispatch } = useStore();
  const [status, setStatus] = useState(null); // { tone, message }
  const [busy, setBusy] = useState(false);

  const totalPhotos = countPhotos(state.rooms);
  const weak = countWeakTimestamps(state.rooms);
  const manifest = buildManifest(state.property, state.rooms);
  const gaps = manifest.filter((row) => !row.value && !row.optional).length;

  async function handleGenerate() {
    setBusy(true);
    setStatus({ tone: "muted", message: "Preparing report…" });

    try {
      const { filename, failed, status } = await generateReport(
        { property: state.property, rooms: state.rooms },
        ({ done, total, label }) =>
          setStatus({ tone: "muted", message: `Adding photo ${done} of ${total} — ${label}` })
      );

      if (status === "declined") {
        setStatus({ tone: "muted", message: "Save cancelled — the report was not downloaded." });
        return;
      }

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
        <h3>{gaps > 0 ? "Almost ready" : "Ready to export"}</h3>
        <p>
          {gaps > 0
            ? `${gaps} thing${gaps === 1 ? "" : "s"} still missing from the report. You can export
               anyway, but it will be stronger with ${gaps === 1 ? "it" : "them"}.`
            : "Everything below goes into the PDF."}
        </p>

        <dl className="manifest">
          {manifest.map((row) => (
            <div key={row.label} className="manifest-row">
              <dt>{row.label}</dt>
              <dd>
                {row.value ? (
                  row.value
                ) : (
                  // Missing entries jump to the screen that fixes them —
                  // naming a gap without offering the fix is just nagging.
                  <button
                    type="button"
                    className="manifest-gap"
                    data-optional={row.optional ? "" : undefined}
                    onClick={() => dispatch({ type: "SET_STEP", step: row.step })}
                  >
                    {row.missing}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>

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

      {/* Provenance is the difference between evidence and an assertion, so say
          plainly when some timestamps are weaker than others. */}
      {weak > 0 && (
        <p className="status-line" data-tone="muted" style={{ marginTop: 14 }}>
          {weak} of {totalPhotos} photo{totalPhotos === 1 ? "" : "s"}{weak === 1 ? " has" : " have"}{" "}
          no camera timestamp, so the report will show when it was added here instead of when it was
          taken. Photos straight from a phone camera normally carry their own date.
        </p>
      )}

      {state.property.rules && (
        <>
          <div className="section-label">Property rules on file</div>
          <div className="rules-preview">{state.property.rules}</div>
        </>
      )}

      <div className="section-label">Backup &amp; data</div>
      <DataPanel />
    </>
  );
}
