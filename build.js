// AIRE-Player build script
// Reassembles the split repository (index.html + css/js/assets) into a single, self-contained
// rpe-player.html — every image, font, sound and resource is inlined as a base64 data URI, so
// the produced file runs standalone (double-click, no server required).
//
// Usage:  node build.js   (run from the repo root; output -> dist/rpe-player.html)
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const OUT  = path.join(DIST, 'rpe-player.html');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

function read(f)      { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function base64(f, m) { return 'data:' + m + ';base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64'); }
function b64File(f)   { return fs.readFileSync(path.join(ROOT, f)).toString('base64'); }

// ---------------------------------------------------------------------------
// 1. Read the dev index.html and parse its pieces
// ---------------------------------------------------------------------------
let html = read('index.html');

function extractBetween(text, open, close) {
  const o = text.indexOf(open);
  const c = text.indexOf(close, o + open.length);
  return text.slice(o + open.length, c);
}

const headContent  = extractBetween(html, '<head>', '</head>');
const bodyContent  = extractBetween(html, '<body>', '</body>');
const scriptSrcs   = [];
{
  const re = /<script src="([^"]+)"><\/script>/g;
  let m; while ((m = re.exec(html)) !== null) scriptSrcs.push(m[1]);
}
console.log('script sources:', scriptSrcs.length);

// ---------------------------------------------------------------------------
// 2. Inline CSS
// ---------------------------------------------------------------------------
function inlineCss(srcRef) {
  let css = read(srcRef);
  // relative urls in css/*.css resolve against css/ -> '../...'
  css = css.replace(/url\(\s*'\.\.\/(fonts\/AppFont\.ttf)'\s*\)/g, () => "url('" + base64('fonts/AppFont.ttf', 'font/ttf') + "')");
  css = css.replace(/url\(\s*'\.\.\/(assets\/mask-track\.png)'\s*\)/g, () => "url('" + base64('assets/mask-track.png', 'image/png') + "')");
  return css;
}
const mainCssInline  = inlineCss('css/main.css');
const uieCssInline   = read('css/uie.css');

// ---------------------------------------------------------------------------
// 3. Assemble <head>
// ---------------------------------------------------------------------------
const favicon = base64('assets/favicon.png', 'image/png');
const title = (headContent.match(/<title>([^<]*)<\/title>/) || [])[1] || 'AIRE-PLAYER';
const builtHead =
  '<head>\n' +
  '  <meta charset="utf-8">\n' +
  '  <title>' + title + '</title>\n' +
  '  <link rel="icon" href="' + favicon + '" type="image/png">\n' +
  '  <style>\n' + mainCssInline + '\n' +
  '  </style>\n' +
  '  <style id="uie-css">\n' + uieCssInline + '\n' +
  '  </style>\n' +
  '</head>';

// ---------------------------------------------------------------------------
// 4. Assemble <body>: inline images, strip external <script src> tags (re-added inline)
// ---------------------------------------------------------------------------
let body = bodyContent;
// remove every script-external tag; we re-add them inline below
body = body.replace(/<script src="[^"]+"><\/script>\s*/g, '');
body = body.replace(/<img class="logo-svg" src="assets\/logo-svg\.png"([^>]*)>/g, '<img class="logo-svg" src="' + base64('assets/logo-svg.png', 'image/png') + '"$1>');
body = body.replace(/<img src="assets\/ld-img-bar\.png"([^>]*)>/g, '<img src="' + base64('assets/ld-img-bar.png', 'image/png') + '"$1>');

// ---------------------------------------------------------------------------
// 5. Inline scripts
// ---------------------------------------------------------------------------
const BUILTIN_RESOURCES = {};
const builtinDir = path.join(ROOT, 'assets', 'builtin');
for (const f of fs.readdirSync(builtinDir).sort()) {
  BUILTIN_RESOURCES[f] = b64File(path.join('assets', 'builtin', f));
}
const builtinMapJson = JSON.stringify(BUILTIN_RESOURCES);

// The engine looks for window.BUILTIN_RESOURCES; embed it (the base64 payload lives in
// assets/builtin/* for the split repo but must be inlined for the standalone build).
const resourcesInline =
  'window.BUILTIN_RESOURCES = ' + builtinMapJson + ';';

// AIRE_SFX defined in config.js is replaced with inlined data URIs for standalone use.
const bootWav = base64('assets/sounds/boot.wav', 'audio/wav');
const splashWav = base64('assets/sounds/splash.wav', 'audio/wav');

let scriptsInline = [];
for (const src of scriptSrcs) {
  if (src === 'js/builtin-resources.js') {
    // BUILTIN_RESOURCES is already inlined below (resourcesInline); including the sidecar again
    // would double the embed (assets are fetched from disk for the split repo, base64 for standalone).
    continue;
  }
  let js = read(src);
  if (src === 'js/config.js') {
    // walkmark: turn audio file refs into embedded data URIs; keep the mode switches
    js = js
      .replace(/'assets\/sounds\/boot\.wav'/, "'" + bootWav + "'")
      .replace(/'assets\/sounds\/splash\.wav'/, "'" + splashWav + "'")
      .replace(/window\.AIRE_BUILTIN_DIR\s*=\s*'assets\/builtin\/';/, '');
  }
  if (src === 'js/lib/ttml-parser.js') {
    // parseTTMLLyrics used to live with the resources block; keep it bundled after resources
    scriptsInline.push(resourcesInline);
  }
  // strip the trailing newline-ish gap already handled by separate pushes
  scriptsInline.push(js);
}

const builtScripts = scriptsInline.map((js) => '  <script>\n' + js + '\n  </script>').join('\n')

// ---------------------------------------------------------------------------
// 6. Splash overlay div + splash script + uie script stay as-is (inlined above)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. Emit
// ---------------------------------------------------------------------------
const out =
  '<!DOCTYPE html>\n' +
  '<html lang="en">\n' +
  builtHead + '\n' +
  '<body>\n' +
  body + '\n' +
  builtScripts + '\n' +
  '</body>\n' +
  '</html>\n';

fs.writeFileSync(OUT, out);
console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size + ' bytes)');