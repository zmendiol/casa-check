/**
 * Folds the single-file build's CSS and JS into the HTML, producing one
 * portable document. Also emits a body-only fragment for hosting contexts
 * that supply their own document shell.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "dist-single";
// entryFileNames/assetFileNames carry no directory, so these sit at the root.
const files = readdirSync(DIR);
const pick = (ext) => {
  const name = files.find((f) => f.endsWith(ext));
  if (!name) throw new Error(`No  file in `);
  return readFileSync(join(DIR, name), "utf8");
};
const js = pick(".js");
const css = pick(".css");

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">';

const TITLE = "Casa Check — Move-In/Move-Out Documentation for College Renters";

const full = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#14161C">
<title>${TITLE}</title>
${FONTS}
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;

// Fragment form: no doctype/html/head/body, for hosts that wrap the content.
const fragment = `<title>Casa Check</title>
${FONTS}
<style>
${css}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;

writeFileSync("dist-single/casa-check.html", full);
writeFileSync("dist-single/casa-check.fragment.html", fragment);

const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`casa-check.html          ${kb(full)}`);
console.log(`casa-check.fragment.html ${kb(fragment)}`);
