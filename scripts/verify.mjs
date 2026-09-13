/**
 * Headless visual verification.
 *
 * A Claude Code session in a terminal has no browser pane, and design work
 * done blind ships regressions that only show at one viewport width. This
 * builds the app, serves it, drives every step at phone and desktop widths
 * with real photos seeded in, screenshots each one into verify/, and fails on
 * anything a human would have caught by looking: console errors, uncaught
 * exceptions, sideways scroll, a sidebar step wrapping onto two lines.
 *
 *   npm run verify
 *
 * Then look at verify/*.png before committing. The screenshots are the point;
 * the checks are the floor.
 */

import { mkdirSync, rmSync } from "node:fs";
import { build, preview } from "vite";
import { chromium } from "playwright";

const OUT = "verify";
const PORT = 4183;
const STEPS = ["setup", "capture", "compare", "law", "report"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1300, height: 900 },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

console.log("building…");
await build({ logLevel: "error" });

const server = await preview({ preview: { port: PORT, strictPort: true, host: "127.0.0.1" }, logLevel: "error" });
const origin = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch();
const problems = [];

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`${vp.name}: console error: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`${vp.name}: uncaught: ${e.message}`));

    await page.goto(`${origin}/`);
    await page.waitForSelector(".page-title");

    // Seed a realistic record so the screenshots show populated cards rather
    // than an empty shell. Two rooms, both passes, one with a note.
    await seed(page);

    for (const step of STEPS) {
      await page.evaluate((s) => {
        localStorage.setItem("casa-check:ui", JSON.stringify({ step: s, mode: "moveIn" }));
      }, step);
      await page.reload();
      await page.waitForSelector(".page-title");
      // Let photo thumbnails resolve from IndexedDB before capturing.
      await page.waitForTimeout(400);

      const checks = await page.evaluate(() => {
        const de = document.documentElement;
        const steps = [...document.querySelectorAll(".step-btn")];
        return {
          overflow: de.scrollWidth > de.clientWidth,
          wrappedSteps: steps
            .filter((b) => b.getBoundingClientRect().height > 44)
            .map((b) => b.textContent.trim().replace(/\s+/g, " ")),
          title: document.querySelector(".page-title")?.textContent.trim(),
        };
      });

      if (checks.overflow) problems.push(`${vp.name}/${step}: horizontal overflow`);
      if (checks.wrappedSteps.length) {
        problems.push(`${vp.name}/${step}: sidebar step wrapped: ${checks.wrappedSteps.join(", ")}`);
      }

      await page.screenshot({ path: `${OUT}/${vp.name}-${step}.png`, fullPage: true });
      console.log(`  ${vp.name.padEnd(7)} ${step.padEnd(8)} ${checks.title}`);
    }

    // The viewer, which goes full-bleed on mobile and must fit the screen.
    await page.evaluate(() => {
      localStorage.setItem("casa-check:ui", JSON.stringify({ step: "capture", mode: "moveIn" }));
    });
    await page.reload();
    await page.waitForSelector(".photo-open");
    await page.click(".photo-open");
    await page.waitForSelector(".viewer-stage img");
    await page.waitForTimeout(300);
    const viewerFits = await page.evaluate(() => {
      const f = document.querySelector(".viewer-frame").getBoundingClientRect();
      return f.width <= innerWidth + 1 && f.height <= innerHeight + 1;
    });
    if (!viewerFits) problems.push(`${vp.name}: photo viewer exceeds the viewport`);
    await page.screenshot({ path: `${OUT}/${vp.name}-viewer.png` });
    console.log(`  ${vp.name.padEnd(7)} viewer   ${viewerFits ? "fits" : "OVERFLOWS"}`);

    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

console.log("");
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\nscreenshots in ${OUT}/`);
  process.exit(1);
}
console.log(`clean. screenshots in ${OUT}/ — look at them.`);

/* ------------------------------------------------------------------ */

/** The record save is debounced; wait until it reflects what we expect. */
function waitForRecord(page, predicateSource) {
  return page.waitForFunction(
    (src) => {
      const rec = JSON.parse(localStorage.getItem("casa-check:record") || "null");
      // eslint-disable-next-line no-new-func
      return rec && new Function("rec", "return (" + src + ")(rec)")(rec);
    },
    predicateSource,
    { timeout: 10000 }
  );
}

/** Adds two rooms' worth of synthetic photos through the real import path. */
async function seed(page) {
  await waitForRecord(page, "(r) => Array.isArray(r.rooms) && r.rooms.length > 0");
  await page.evaluate(() => {
    localStorage.setItem("casa-check:ui", JSON.stringify({ step: "capture", mode: "moveIn" }));
    const rec = JSON.parse(localStorage.getItem("casa-check:record") || "null");
    if (rec) {
      rec.property.school = "Arizona State University";
      rec.property.communityName = "The Standard at College Ave";
      rec.property.address = "123 E College Ave, Unit 4B, Tempe AZ";
      localStorage.setItem("casa-check:record", JSON.stringify(rec));
    }
  });
  await page.reload();
  await page.waitForSelector("input[type=file]", { state: "attached" });

  const drop = async (inputIndex, specs, expect) => {
    await page.evaluate(
      async ({ inputIndex, specs }) => {
        const mk = (w, h, label, color) =>
          new Promise((resolve) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const x = c.getContext("2d");
            const g = x.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, color);
            g.addColorStop(1, "#14161C");
            x.fillStyle = g;
            x.fillRect(0, 0, w, h);
            x.fillStyle = "#fff";
            x.font = `bold ${Math.round(w / 7)}px sans-serif`;
            x.textAlign = "center";
            x.fillText(label, w / 2, h / 2);
            c.toBlob((b) => resolve(new File([b], `${label}.jpg`, { type: "image/jpeg" })), "image/jpeg", 0.9);
          });
        const files = await Promise.all(specs.map((s) => mk(...s)));
        const input = document.querySelectorAll("input[type=file]")[inputIndex];
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { inputIndex, specs }
    );
    // Wait on the outcome, not on the progress banner: checking for the
    // banner's absence can succeed before it has even rendered, and a reload
    // right after that kills the import mid-flight.
    await waitForRecord(page, expect);
  };

  await drop(
    0,
    [
      [1600, 1200, "SINK", "#0E6B5C"],
      [1200, 1600, "WALL", "#0E6B5C"],
    ],
    "(r) => r.rooms[0].moveIn.length === 2"
  );
  await drop(1, [[1400, 1000, "SOFA", "#0E6B5C"]], "(r) => r.rooms[1].moveIn.length === 1");

  // One move-out photo with a note, so the compare screen has both sides.
  await page.evaluate(() => {
    localStorage.setItem("casa-check:ui", JSON.stringify({ step: "capture", mode: "moveOut" }));
  });
  await page.reload();
  await page.waitForSelector("input[type=file]", { state: "attached" });
  await drop(0, [[1600, 1200, "SINK", "#D98E2B"]], "(r) => r.rooms[0].moveOut.length === 1");
  await page.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem("casa-check:record"));
    rec.rooms[0].moveOut[0].note = "Same sink, now chipped at the corner";
    localStorage.setItem("casa-check:record", JSON.stringify(rec));
  });
}
