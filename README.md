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
  components/           Sidebar, RoomCard, PhotoTile
  hooks/usePhotoUrl.js  resolves a photo id to an object URL
  lib/
    constants.js        steps, modes, US states, photo limits
    images.js           decode / downscale / re-encode
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

## Notes for future work

Things deliberately left out of the refactor:

- **Multi-photo selection.** The file input takes one photo at a time, as the
  original did. Adding `multiple` to the input in `RoomCard.jsx` and looping in
  `handleFile` would be a small, contained change.
- **Export / import.** There's no way to move a record between devices or back
  it up other than the PDF. A JSON export would pair well with the storage
  adapter.
- **Start over.** No UI to clear a record and begin a new property.
- **Real per-state law content.** `RenterRights.jsx` shows Arizona statute as a
  worked example regardless of the state selected; the copy now says so plainly
  rather than implying otherwise. `PRINCIPLES` is already an array, so
  per-state data would slot in naturally.

Not legal advice. Renter protection laws vary by state.
