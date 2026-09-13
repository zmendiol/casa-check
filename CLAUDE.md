# Casa Check — working notes for Claude Code

Move-in / move-out condition documentation for college renters. React + Vite,
no backend, everything stored on the user's own device.

Live: https://zmendiol.github.io/casa-check/ (auto-deploys on push to `main`)

## Commands

```bash
npm run dev                  # dev server, binds all interfaces for phone testing
npm run build                # production build -> dist/
npm run preview -- --host    # serve the built output on the LAN
npm run build:single         # one self-contained HTML -> dist-single/
npm run verify               # headless visual check — REQUIRED before committing UI
```

## Verifying (do this, every time, before committing anything visual)

`npm run verify` builds the app, serves it, seeds real photos through the
actual import path, drives all five steps at 375px and 1300px, and fails on
console errors, uncaught exceptions, sideways scroll, a sidebar step wrapping
onto two lines, or the photo viewer exceeding the screen. It writes full-page
screenshots to `verify/` (gitignored).

**Then open the screenshots and look at them.** The automated checks are the
floor, not the ceiling — several past regressions (four identical hint boxes
stacked down a page; tiles collapsing to one column on phones) were visible
only to a human looking at the picture. Read at least `mobile-capture.png`,
`desktop-capture.png`, and whichever screen you changed.

There is no unit test suite; this is the test suite. Anything in the photo
pipeline should additionally be tried on a real phone — some failure modes only
appear there.

## Architecture in one pass

- `src/state/storage.js` owns **all** persistence. Metadata (property details,
  room names, photo notes/timestamps) in `localStorage`; photo bytes as Blobs in
  IndexedDB. Adding a backend means reimplementing this file's exports and
  nothing else.
- `src/state/store.jsx` is a context + reducer. The reducer is pure; every
  IndexedDB call happens in the action creators or components.
- Photos are `{ id, timestamp, timestampSource, note }`. The bytes live in
  IndexedDB under `id`.
- `src/lib/images.js` turns a picked file into stored bytes + capture time.
- `src/steps/` is one component per sidebar step; `src/App.jsx` maps step id to
  screen.

## Things that will bite you

These are all fixed. Each was a real bug; please do not reintroduce them.

**Never use `canvas.toBlob`.** Measured on a 12MP photo: reading 2ms, decoding
36ms, and `toBlob` **1024ms** — for an encode that takes 13ms through the
synchronous `toDataURL`. It also stops firing entirely when the page is
backgrounded. Both encode paths deliberately avoid it. This single call was the
difference between "instant" and "minutes" on a phone.

**`overflow-x: hidden` on html/body breaks `position: sticky`.** It forces
`overflow-y: auto`, making them scroll containers. `base.css` uses
`overflow-x: clip` for exactly this reason; the mobile step nav depends on it.

**`pruneOrphanPhotos` must list stored ids BEFORE reading the room list.** The
other order leaves a window where a just-added photo is in neither set and has
its bytes deleted. Pass it a getter, never a snapshot.

**Timestamps are evidence, so provenance is not decoration.** `exif.js` reads
`DateTimeOriginal`; failing that the file date; failing that upload time. Every
photo records which, and the UI and PDF both say so. Never present an upload
time as a capture time — that is the fastest way to get a renter's report
dismissed.

**EXIF orientation: size targets must be computed in the ROTATED frame.** A
phone held upright stores its JPEG on its side (4032x3024 + Orientation=6),
and the frame-header dimensions are the unrotated ones. The decoder applies
resize targets AFTER honouring the rotation, so targets derived from the raw
header squash every portrait photo into a landscape box. `exif.js` reads the
tag and `images.js` swaps the axes for orientations 5–8; the worker sizes its
canvas from the bitmap it actually got, never from the targets. Photos stored
before this fix are permanently squashed — they must be re-imported.

**Non-JPEG images have no frame header, so no resize targets.** The worker
must clamp to `maxEdge` from the decoded bitmap or a 1290x2796 screenshot is
stored at full size.

**No `capture="environment"` on the file input.** It forces the camera and makes
the photo library unreachable, which defeats multi-select and EXIF entirely.

**IndexedDB is unavailable on `file://`.** The single-file build must be served
over http. `StorageWarning` detects and explains this.

**Sandboxed iframes may block `blob:` workers.** The app falls back to the main
thread automatically, but that fallback is much slower on weak devices. If
import feels slow, check the timing line the app shows after any import over
1.5s — it reports `background thread` vs `main thread`.

## Design

The teal/amber/dark-sidebar identity is deliberate; keep it. The user's
standing rule: **polish within the system is welcome, palette and layout
changes need approval.** So: fix hierarchy, spacing, empty states, progress
signals, and mobile behaviour freely; do not change the colours, the sidebar
layout, or the overall structure without asking.

All colours live in `src/styles/tokens.css`; edit them there and nowhere
else. Teal means move-in / original condition, amber means move-out / later —
used consistently on the room counts and the compare columns. Class names
match the original prototype (kept at `legacy/casa-check.html`) so visual
drift is easy to spot.

`npm run verify` covers both widths. Several regressions this project has had
only appeared at one: a sidebar badge wrapped its label on desktop but not
mobile; larger thumbnails dropped phones to one column; a media-query rule sat
before its base rule and silently never applied. Read the screenshots.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds with `npm ci` against the
committed lockfile and publishes `dist/` to GitHub Pages. Nothing else to do.

## Not legal advice

The app makes claims about tenant rights. Keep the disclaimers, and keep the
Arizona statute labelled as a worked example rather than implying it applies to
whichever state the user selected.
