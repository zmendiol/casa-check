import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so a production build works from a subdirectory or from
  // file:// without further configuration.
  base: "./",
  server: {
    // Needed to open the app on a phone for a real walkthrough test.
    host: true,
  },
  build: {
    outDir: "dist",
    // jsPDF is only pulled in when a report is generated; keep it out of the
    // initial bundle so first paint stays small on a phone.
    chunkSizeWarningLimit: 900,
  },
});
