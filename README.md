[简体中文](README.zh-CN.md) · **English**

<p align="center">
  <img src="README.png" alt="PhiAI-Player">
</p>

A browser-based player for RPE / Phigros-style rhythm charts. Drop a chart pack or file on
the page and it parses the bundle, loads its audio and images, and renders the playthrough on
a `<canvas>` in real time — falling notes, judgement lines, combo, scoring, hitsounds, and
optional WebGL post-processing effects.

The project lives here as an editable multi-file codebase, with a build step that collapses
everything back into one self-contained HTML file you can run by double-clicking.

> **PhiAI-Player** was formerly named **AIRE-Player**.

## Background

This codebase is a refactored, source-split release of a working single-file player
(originally a ~25 MB `rpe-player.html` that embedded every style, library, font, sound and
image as base64 data URIs). The chart semantics, rendering approach and bundled assets come
from that original work; this repository reorganizes it for maintainability — without
changing how it plays charts.

## Getting started

The dev layout is best served over HTTP — it loads files with `fetch` (the builtin resource
pack) plus external script tags, so a server gives you everything including network extras:

```bash
python -m http.server 8000
# or:  npx serve
```

…then open `http://localhost:8000`. You'll land on the load screen (in Chinese):

- **选择文件** — pick one or more chart files
- **加载资源包 (.zip)** — load a custom resource pack
- **进入谱面文件夹** — open a folder of chart files

You can also just **drag and drop** a file or folder straight onto the page. A staged chart
gives you 撤销 (undo), 游玩 (play), 独立窗口 (play in a standalone window) and 录制
(record to video) options.

Opening `index.html` directly (double-click, `file://`) also works for the core player: the
default resource pack ships with an embedded fallback (`js/builtin-resources.js`), so the
default skin and hitsounds still apply. Features that need the network — BGA videos from
`extra.json`, the chart-tip fetch, CDN-loaded ffmpeg for recording export — want a server.

### Supported chart formats

- `.pez` / `.zip` chart packs
- `.pec`, `.json` chart files
- a whole folder of chart files

### Building the single-file player

```bash
node build.js
```

This inlines every CSS file, script, font, image and sound back into the page, and embeds the
builtin resource pack as `window.BUILTIN_RESOURCES` — the output `dist/rpe-player.html` is a
fully standalone file that runs from disk with a double-click.

## What it can do

- **Judgement ladder** — `PERFECT` / `GOOD` / `BAD` / `MISS` with combo, accuracy and live
  scoring
- **Autoplay**, pause/resume, restart, and chart speed control
- **Keyboard play** — any key hits the nearest note, full-screen judgement
- **Pointer / touch** — tap, flick, drag and hold notes with your finger or mouse
- **Chart recording** and playback export
- **Hitsounds** from the pack, plus lyrics via `.lrc` / `.ttml` files
- Animated / video **backgrounds** (from `extra.json` within the pack)
- **Extra effects** — `extra.json` effects and WebGL post-processing shaders
- A built-in default resource pack, so charts with no custom skin still look right

## Requirements

- **Node.js** — only needed for `build.js`; recent LTS is fine
- Any static file server for the dev layout (`python -m http.server`, `npx serve`, …)
- A modern browser with Canvas and WebGL support (Chrome, Edge, Firefox, Safari)

## Controls

| Input | Action |
| --- | --- |
| Any key (with keyboard play on) | hit the nearest note |
| Pointer / touch drag | hit notes on the canvas |
| `Esc` | back to the load screen (pauses playback) |
| Pause button | play / pause |

> **Play-UI editor (游玩UI编辑器): disabled.** The source files (`js/uie.js`, `css/uie.css`)
> are kept in the repo for reference but are no longer loaded or invoked — the feature is
> retired because it was hard to maintain, had functional bugs, and could be used to fake
> play results, which is against the rules.

## Repository layout

```
PhiAI-Player/
├── index.html           dev entry point (split layout; runs via server or double-click)
├── build.js             build script → dist/rpe-player.html (single file)
├── gen-builtin-resources.js  regenerates the embedded builtin-pack fallback
├── README.md            documentation (English)
├── README.zh-CN.md      documentation (简体中文)
├── README.png           banner image used by the READMEs
├── LICENSE              GPL-3.0 license
├── THIRD_PARTY.md       third-party / bundled-asset attributions
├── dist/                build output
├── css/                 main styles + editor UI styles
├── fonts/               the embedded chart font (AppFont)
├── assets/              images, builtin resource-pack files, boot/splash sounds
└── js/
    ├── config.js        dev-mode paths (sound files, builtin pack directory)
    ├── builtin-resources.js  (generated) base64 copy of assets/builtin/ for file:// use
    ├── vendor/          third-party libs (JSZip, js-yaml)
    ├── lib/           engine helpers: GIF decoder, particle system, shaders,
    │                  easing, chart parsers, PEZ parser, resource-pack loader
    ├── player/        the `EnhancedRPEPlayer` class, one file per concern
    │                  (core, settings, assets, audio, loaders, chart, playback,
    │                  judgement, scoring, rendering, fx, background, lyrics,
    │                  ui, controls, recording)
    ├── bootstrap.js   top-level wiring: canvas, drop handlers, player bootstrap
    ├── splash.js      splash overlay animation
    └── uie.js         (retired) editor / settings UI glue — no longer loaded
```

The class definition lives in `js/player/core.js` (constructor included); every other
`js/player/*` file is a small `Object.assign(EnhancedRPEPlayer.prototype, …)` block, so
scripts can be loaded in sequence and the player still behaves as one class. Script order
matters — `index.html` lists them in the required sequence.

## Implementation notes

- **Judge line / note geometry** follows the RPE spec: `speedEvents` are converted from a beat
  axis to seconds, with a `×40` base speed factor and per-note multipliers.
- **Phi-format charts** are auto-detected and converted to the internal note model on load.
- **Hitsound handling** mocks the Phigros-style mixing: voices feed a single mix bus with a
  limiter so rapid hits don't clip.
- **Large charts** (`.json` over 256 MB) parse in streaming mode instead of blocking the UI.

## Contributing

Issues and pull requests are welcome. If you're fixing a bug or adding a feature, keep the
existing structure — match the file layout, run `node --check` on changed JS, and confirm the
build still emits a working standalone file with `node build.js`.

## License

GPL-3.0 — see [LICENSE](LICENSE). Bundled libraries, fonts and resource-pack
assets have separate licenses and/or copyright holders — see
[THIRD_PARTY.md](THIRD_PARTY.md).