import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Builds one self-contained bundle: no module graph, no separate chunks, and
 * jsPDF folded in rather than dynamically imported. Used to produce a single
 * HTML file that runs anywhere without a server.
 *
 * `npm run dev` and `npm run build` are unaffected — those keep the split
 * chunks and the lazy jsPDF load.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-single",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        // A classic script, not an ES module: module scripts are subject to
        // CORS even when inline-adjacent, and this build has to be portable.
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "app.js",
        assetFileNames: "app.[ext]",
      },
    },
  },
});
