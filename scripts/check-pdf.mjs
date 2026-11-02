/**
 * Measures the generated PDF rather than looking at it.
 *
 * The report is the one artifact that leaves the app, and its failure mode is
 * silent: jsPDF draws text past the page edge without complaint, so an
 * over-long line simply loses its tail. That has already cost a property
 * address and a section's "— Move-In" label. Screenshots cannot catch it;
 * measuring every drawn line against the printable width can.
 *
 *   npm run check:pdf
 */

import { preview } from "vite";
import { chromium } from "playwright";

const PORT = 4189;
const MARGIN = 48;

const server = await preview({
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const problems = [];

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForSelector(".page-title");

  // Deliberately awkward content: a long address, a long room name, a statute
  // URL, and a long note — every field that has overflowed before.
  await page.evaluate(() => {
    localStorage.setItem(
      "casa-check:record",
      JSON.stringify({
        property: {
          school: "Arizona State University",
          communityName: "The Standard at College Ave",
          address:
            "1234 East Extremely Long Apartment Complex Boulevard, Building C, Unit 4B, Tempe, Arizona 85281-1234",
          stateName: "Arizona",
          moveInDate: "2026-08-15",
          moveOutDate: "2027-05-28",
          rules: "Carpets professionally cleaned. ".repeat(20),
          depositDeadlineDays: "14",
          depositDeadlineBasis: "business",
          depositLawSource:
            "A.R.S. §33-1321(D) — https://www.azleg.gov/viewdocument/?docName=https://www.azleg.gov/ars/33/01321.htm",
        },
        rooms: [
          { id: "r1", name: "Upstairs Back Bedroom Closet and Storage Area Behind the Water Heater", moveIn: [], moveOut: [] },
        ],
      })
    );
    localStorage.setItem("casa-check:ui", JSON.stringify({ step: "capture", mode: "moveIn" }));
  });
  await page.reload();
  await page.waitForSelector("input[type=file]", { state: "attached" });

  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 1600;
    c.height = 1200;
    c.getContext("2d").fillRect(0, 0, 1600, 1200);
    const f = await new Promise((r) =>
      c.toBlob((b) => r(new File([b], "p.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9)
    );
    const i = document.querySelectorAll("input[type=file]")[0];
    const dt = new DataTransfer();
    dt.items.add(f);
    i.files = dt.files;
    i.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () => {
      const r = JSON.parse(localStorage.getItem("casa-check:record") || "null");
      return r && r.rooms[0].moveIn.length === 1;
    },
    null,
    { timeout: 20000 }
  );

  // A long note, which shares the right-hand column with the timestamp.
  await page.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem("casa-check:record"));
    rec.rooms[0].moveIn[0].note =
      "Deep scratch across the laminate near the dishwasher, plus a chipped corner on the counter edge.";
    localStorage.setItem("casa-check:record", JSON.stringify(rec));
    localStorage.setItem("casa-check:ui", JSON.stringify({ step: "report", mode: "moveIn" }));
  });
  await page.reload();
  await page.waitForSelector(".report-cta");

  const result = await page.evaluate(async (margin) => {
    let captured = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o) => {
      if (o instanceof Blob && o.type === "application/pdf") captured = o;
      return orig(o);
    };
    [...document.querySelectorAll(".report-cta button")]
      .find((b) => b.textContent.includes("PDF"))
      .click();

    const started = Date.now();
    while (!captured && Date.now() - started < 20000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!captured) return { error: "no PDF produced" };

    const buf = new Uint8Array(await captured.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 65536) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + 65536));
    }

    // Extract the drawn text with the font state in force for each run.
    // Measuring happens in Node: the preview server serves dist/, not
    // node_modules, so jsPDF cannot be imported from inside the page.
    const tokens = [];
    let size = 11;
    let bold = false;
    for (const t of s.matchAll(/\/(F\d+)\s+([\d.]+)\s+Tf|\(((?:\\.|[^\\()])*)\)\s*Tj/g)) {
      if (t[2]) {
        size = Number(t[2]);
        bold = t[1] === "F2"; // jsPDF emits F1 normal, F2 bold, F3 italic here
        continue;
      }
      const text = t[3].replace(/\\([()])/g, "$1");
      if (text.trim()) tokens.push({ text, size, bold });
    }
    return { tokens, bytes: buf.length };
  }, MARGIN);

  if (result.error) problems.push(result.error);

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const printable = doc.internal.pageSize.getWidth() - MARGIN * 2;

  for (const { text, size, bold } of result.tokens || []) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const w = doc.getTextWidth(text);
    if (w > printable + 1) {
      problems.push(
        `line runs off the page (${Math.round(w)}pt > ${Math.round(printable)}pt @ ${size}pt): ${text.slice(0, 80)}`
      );
    }
  }
  console.log(
    `printable ${Math.round(printable)}pt · ${result.tokens.length} text runs · ${result.bytes} bytes`
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("no PDF line runs off the page.");
