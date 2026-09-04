import { MODE_KEYS } from "./constants.js";
import { blobToDataUrl } from "./images.js";
import { getPhotoBlob } from "../state/storage.js";

const MARGIN = 48;
const IMG_BOX_W = 220;
const IMG_BOX_H = 165;
const GUTTER = 16;
const ROW_GAP = 20;
const LINE = 16;

const MODE_LABEL = { moveIn: "Move-In", moveOut: "Move-Out" };

/**
 * Builds the condition report and hands it to the browser as a download.
 *
 * @param {object} record            { property, rooms }
 * @param {(p: {done:number,total:number,label:string}) => void} [onProgress]
 * @returns {Promise<{filename: string, failed: Array<{room: string, reason: string}>}>}
 */
export async function generateReport(record, onProgress = () => {}) {
  const { property, rooms } = record;

  // jsPDF is ~350KB; keep it out of the initial bundle since most sessions
  // never generate a report.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const bottom = pageH - MARGIN;

  let y = MARGIN;
  const failed = [];

  /** Moves to a new page when `needed` points will not fit. */
  const ensureSpace = (needed) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = MARGIN;
      return true;
    }
    return false;
  };

  /* ---------- Cover block ---------- */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Casa Check — Condition Report", MARGIN, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const facts = [
    ["University", property.school],
    ["Property", property.communityName],
    ["Address", property.address],
    ["State", property.stateName],
    ["Move-in date", property.moveInDate],
    ["Move-out date", property.moveOutDate],
    ["Report generated", new Date().toLocaleString()],
  ];
  for (const [label, value] of facts) {
    ensureSpace(LINE);
    doc.text(`${label}: ${value || "—"}`, MARGIN, y);
    y += LINE;
  }
  y += 10;

  /* ---------- Property rules ----------
     The original advanced `y` by the full block height without ever checking
     for a page break, so long rules text ran straight off page one. */

  if (property.rules) {
    ensureSpace(LINE * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Property rules & move-out standards on file:", MARGIN, y);
    y += LINE;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of doc.splitTextToSize(property.rules, contentW)) {
      ensureSpace(12);
      doc.text(line, MARGIN, y);
      y += 12;
    }
    y += 16;
  }

  /* ---------- Standing note ---------- */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const notice =
    "Most states require written itemized deductions and set a deadline " +
    "(often 14-30 days) to return a deposit after move-out.";
  const noticeLines = doc.splitTextToSize(notice, contentW);
  ensureSpace(noticeLines.length * 14 + 10);
  doc.text(noticeLines, MARGIN, y);
  y += noticeLines.length * 14 + 24;

  /* ---------- Photo sections ---------- */

  const queue = [];
  for (const room of rooms) {
    for (const mode of MODE_KEYS) {
      if (room[mode].length > 0) queue.push({ room, mode, photos: room[mode] });
    }
  }

  const total = queue.reduce((sum, group) => sum + group.photos.length, 0);
  let done = 0;

  for (const { room, mode, photos } of queue) {
    ensureSpace(40 + IMG_BOX_H * 0.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${room.name} — ${MODE_LABEL[mode]}`, MARGIN, y);
    y += 20;

    for (const photo of photos) {
      done += 1;
      onProgress({ done, total, label: `${room.name} — ${MODE_LABEL[mode]}` });

      let image = null;
      try {
        image = await loadPhoto(photo.id);
      } catch (err) {
        failed.push({ room: `${room.name} (${MODE_LABEL[mode]})`, reason: err.message });
      }

      // Fit inside the box instead of stretching to it — the original forced
      // every photo to 220x165, which visibly squashed portrait shots.
      const draw = image
        ? fit(image.width, image.height, IMG_BOX_W, IMG_BOX_H)
        : { width: IMG_BOX_W, height: 40 };

      const textX = MARGIN + IMG_BOX_W + GUTTER;
      const textW = pageW - textX - MARGIN;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const stamp = formatStamp(photo.timestamp);
      const noteLines = photo.note ? doc.splitTextToSize(photo.note, textW) : [];
      const textH = 16 + (noteLines.length ? noteLines.length * 11 + 8 : 0);

      // Advance by whichever column is taller. The original always advanced by
      // the image height, so a long note overlapped the next photo.
      const rowH = Math.max(draw.height, textH);
      ensureSpace(rowH + ROW_GAP);

      if (image) {
        try {
          doc.addImage(image.dataUrl, "JPEG", MARGIN, y, draw.width, draw.height);
        } catch (err) {
          failed.push({ room: `${room.name} (${MODE_LABEL[mode]})`, reason: err.message });
          doc.setFont("helvetica", "italic");
          doc.text("[photo could not be embedded]", MARGIN, y + 12);
          doc.setFont("helvetica", "normal");
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.text("[photo missing from storage]", MARGIN, y + 12);
        doc.setFont("helvetica", "normal");
      }

      doc.setFontSize(9);
      doc.text(stamp, textX, y + 12, { maxWidth: textW });
      if (noteLines.length) doc.text(noteLines, textX, y + 30);

      y += rowH + ROW_GAP;
    }

    y += 10;
  }

  if (total === 0) {
    ensureSpace(LINE);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("No photos were recorded for this property.", MARGIN, y);
  }

  stampPageNumbers(doc, pageW, pageH);

  const filename = buildFilename(property);
  doc.save(filename);
  return { filename, failed };
}

/* ------------------------------------------------------------------ */

async function loadPhoto(id) {
  const blob = await getPhotoBlob(id);
  if (!blob) throw new Error("photo not found in storage");

  const dataUrl = await blobToDataUrl(blob);
  const { width, height } = await measure(blob, dataUrl);
  return { dataUrl, width, height };
}

async function measure(blob, dataUrl) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return dims;
    } catch {
      /* fall through */
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    // A square-ish default still produces a usable page if measuring fails.
    img.onerror = () => resolve({ width: IMG_BOX_W, height: IMG_BOX_H });
    img.src = dataUrl;
  });
}

function fit(w, h, boxW, boxH) {
  const scale = Math.min(boxW / w, boxH / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function formatStamp(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString();
}

function stampPageNumbers(doc, pageW, pageH) {
  const pages = doc.internal.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, pageH - 24, { align: "right" });
  }
}

function buildFilename(property) {
  const label = property.communityName || property.address || "report";
  const slug =
    label
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "report";
  return `casa-check-${slug}.pdf`;
}
