# Casa Check

Move-in / move-out condition documentation for college renters. Photograph every
room at move-in and again at move-out, keep timestamped evidence, and export a
single PDF you can hand a landlord or bring to small claims court.

## Running it

```bash
npm install
npm run dev
```

The dev server binds to all interfaces, so you can open it on your phone at
`http://<your-computer-ip>:5173` — worth doing, since the walkthrough is
something you actually perform while standing in the room.

```bash
npm run build     # production build into dist/
npm run preview   # serve the built output
```

## Project layout

```
src/
  main.jsx              entry point, CSS imports
  App.jsx               shell + step -> screen mapping
  state/
    storage.js          ALL persistence. Swap this file to add a backend.
    store.jsx           context + reducer, debounced save
  steps/                one component per sidebar step
  components/           Sidebar, RoomCard, PhotoTile, PhotoViewer,
                        DataPanel, ErrorBoundary
  hooks/usePhotoUrl.js  resolves a photo id to an object URL
  lib/
    constants.js        steps, modes, US states, photo limits
    images.js           decode / downscale / re-encode, capture time
    exif.js             reads DateTimeOriginal out of a JPEG
    backup.js           whole-record JSON export / restore
    pdf.js              report generation (lazy-loads jsPDF)
    icons.jsx           inline SVG
    uid.js
  styles/
    tokens.css          the palette — edit colors here and nowhere else
    base.css            reset, typography, form + button primitives
    layout.css          app shell and the mobile reflow
    components.css      cards, photo grid, toggles, panels
legacy/casa-check.html  the original single-file prototype, for reference
```

## How storage works

Two tiers, deliberately:

| What | Where | Why |
|---|---|---|
| Property details, room names, photo notes and timestamps | `localStorage` | Small, and easy to inspect in DevTools. |
| Photo bytes | IndexedDB, as `Blob`s | localStorage caps out around 20–30 photos. Blobs also avoid base64's ~33% size penalty. |

A record written by the original prototype (photos inlined as `dataUrl`) is
migrated automatically on first load: the bytes move into IndexedDB and the
legacy key is removed. Orphaned blobs — ones no room references any more — are
swept on startup.

**Adding a backend later** means reimplementing the exports in
`src/state/storage.js`. Nothing else in the app touches persistence directly.

## Timestamps and provenance

The app sells timestamped photos as evidence, so it is careful about where a
timestamp comes from. When a photo is added, `src/lib/exif.js` reads
`DateTimeOriginal` out of the JPEG. Failing that it falls back to the file's own
date, and failing that to the moment it was added here.

Each photo stores which of those three it used, and both the UI and the PDF say
so — a photo without a camera timestamp is labelled rather than quietly
presented as if it had one. Stamping upload time and calling it a capture time
would be the single easiest way to get a renter's report dismissed.

## Backup

`Generate report -> Backup & data` exports the whole record — property details,
notes, and every photo inlined as a data URL — as one JSON file, and restores
from the same. The PDF is the readable artifact; the JSON is the restorable one.

The app also asks the browser for persistent storage on startup. Without it,
IndexedDB is best-effort and can be evicted under storage pressure; the data
panel tells you whether the browser granted it.

## Notes for future work

- **Offline / installable (PWA).** The app is fully client-side, so a service
  worker would make it work with no signal and installable to a home screen —
  worth having when documenting a basement unit. Deliberately not added yet:
  it introduces cache-invalidation behaviour that is easy to get subtly wrong.
- **Real per-state law content.** `RenterRights.jsx` shows Arizona statute as a
  worked example regardless of the state selected; the copy says so plainly.
  `PRINCIPLES` is already an array, so per-state data would slot in naturally.
- **Photo reordering**, and room-level notes.
- **HEIC support.** iPhones set to "High Efficiency" produce HEIC files that
  most browsers cannot decode; those photos are rejected with an error today.

Not legal advice. Renter protection laws vary by state.
