// PhiAI-Player | gen-builtin-resources.js
// Regenerates js/builtin-resources.js from the files in assets/builtin/*.
// The sidecar embeds the default resource pack as base64 so the split repository still
// applies the default skin/hitsounds when opened directly via file:// (where fetch() is
// blocked by the browser). assets/builtin/* remains the editable source of truth and is
// used whenever the app is served over HTTP.
//
// Usage: node gen-builtin-resources.js   (run from the repo root)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const builtinDir = path.join(ROOT, 'assets', 'builtin');
const OUT = path.join(ROOT, 'js', 'builtin-resources.js');

const resources = {};
for (const f of fs.readdirSync(builtinDir).sort()) {
  resources[f] = fs.readFileSync(path.join(builtinDir, f)).toString('base64');
}

const out =
  '// PhiAI-Player | js/builtin-resources.js (GENERATED FILE - DO NOT EDIT)\n' +
  '// Regenerate with: node gen-builtin-resources.js\n' +
  '// Inline copy of assets/builtin/* as base64. Used as a fallback when fetch() is unavailable\n' +
  '// (file:// protocol); the canonical files live in assets/builtin/ and are used over HTTP.\n' +
  'window.BUILTIN_RESOURCES = ' + JSON.stringify(resources) + ';\n';

fs.writeFileSync(OUT, out);
console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size + ' bytes, ' + Object.keys(resources).length + ' files)');