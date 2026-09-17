[简体中文](README.zh-CN.md) · **English**

<p align="center">
  <img src="README.png" alt="PhiAI-Player">
</p>

<h1 align="center">PhiAI-Player</h1>

<p align="center">
  <em>A browser-based player for Phigros-style rhythm charts.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License"></a>
  <a href="https://dvd1145.github.io/PhiAI-Player/"><img src="https://img.shields.io/badge/play%20online-online-brightgreen.svg" alt="Play online"></a>
</p>

---

PhiAI-Player parses `.pez` / `.pec` / `.json` chart packs and renders the playthrough —
falling notes, judgement lines, combo, scoring and hitsounds — on a `<canvas>` in real time.
It runs in any modern browser; there is nothing to install.

[Play online](https://dvd1145.github.io/PhiAI-Player/) (GitHub Pages), or download the
single-file build and open it locally.

---

## Demo

Playing a chart with an animated video background and hit particle effects:

<img src="demo.gif" width="720" alt="PhiAI-Player gameplay demo">

---

## About the name

The project name comes from an early prototype, a quick chart-reading tool built with an LLM.
The player itself has no AI — it runs fully locally, and your charts never leave your device.

---

## Quick start

**① Play online** — open <https://dvd1145.github.io/PhiAI-Player/>.

**② Get a chart** — any `.pez` / `.pec` / `.json` chart file, or a folder of charts.

**③ Play** — drag and drop the file onto the page, or use the buttons on the load screen
(**选择文件 / 加载资源包 / 进入谱面文件夹**), then hit **游玩**. Autoplay is available.

Windows / macOS / Linux, desktop or phone.

For developers:

```bash
git clone https://github.com/DVD1145/PhiAI-Player.git
cd PhiAI-Player
python -m http.server 8000      # dev layout
# open http://localhost:8000
node build.js                   # → dist/rpe-player.html (single-file build)
```

Opening `index.html` directly by double-click also works, thanks to an embedded default
resource pack.

---

## Features

- **Judgement ladder** — `PERFECT` / `GOOD` / `BAD` / `MISS`, combo, accuracy, live scoring
- **Play styles** — keyboard (any key hits the nearest note), pointer / touch (tap, flick,
  drag, hold)
- **Formats** — `.pez` / `.pec` / `.json` chart files, or a whole folder; Phi format is
  auto-detected and converted on load
- **Recording** — record a playthrough and export it as a video (ffmpeg, loaded on demand)
- **Resource packs** — `.zip` packs bring their own note skins, hitsounds, lyrics
  (`.lrc` / `.ttml`) and animated / video backgrounds (`extra.json`)
- **Effects** — WebGL post-processing shaders and particle hit effects
- Large `.json` charts (over 256 MB) are parsed in streaming mode to avoid blocking the UI

---

## Project status

| Status | Details |
| --- | --- |
| ✅ Working | full play loop, scoring, recording, resource packs, effects |
| 🚧 In progress | demo GIF, more chart compatibility edge cases |

The single-file build (`dist/rpe-player.html`) is the deployable artifact; this repository is
a maintainable source-split of that file.

> **History:** this project was formerly named **AIRE-Player**. The old play-UI editor has
> been retired — it was hard to maintain and could be used to fake play results (custom HUD
> hiding or replacing judgement). The source files remain in the repo for reference but are
> no longer loaded.

---

## Contributing

Issues and pull requests are welcome. Ground rules:

- keep the existing file layout (one concern per file in `js/player/`)
- run `node --check` on changed JS
- confirm `node build.js` still produces a working `dist/rpe-player.html`

## License

GPL-3.0 — see [LICENSE](LICENSE). Bundled libraries, fonts and resource-pack assets have
separate licenses / copyright — see [THIRD_PARTY.md](THIRD_PARTY.md).