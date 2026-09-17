[简体中文](README.zh-CN.md) · **English**

<p align="center">
  <img src="README.png" alt="PhiAI-Player">
</p>

<h1 align="center">PhiAI-Player</h1>

<p align="center">
  <em>A Phigros-style rhythm game player that runs right in your browser — no install, no account, no config.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License"></a>
  <a href="https://dvd1145.github.io/PhiAI-Player/"><img src="https://img.shields.io/badge/▶%20Play%20online-online-brightgreen.svg" alt="Play online"></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/2%20min-quick%20start-orange.svg" alt="Quick start"></a>
</p>

---

**Drop a chart in → play it in under two seconds.** PhiAI-Player parses `.pez` / `.pec` /
`.json` chart packs, loads the audio and images, and renders the whole playthrough — falling
notes, judgement lines, combo, scoring and hitsounds — on a `<canvas>` in real time.

Try it instantly: **[play online](https://dvd1145.github.io/PhiAI-Player/)** (GitHub Pages).
No registration, no download, no install.

---

## What makes PhiAI-Player?

A **self-contained player** — not a mod, not a patch to an existing game. It turns chart
files into playable rhythm gameplay anywhere a browser runs:

- **Runs anywhere** — any modern browser, desktop or phone; nothing to install
- **Chart formats** — `.pez` / `.pec` / `.json`, single files or whole folders; Phi format
  auto-detected and converted on load
- **Two play views** — turntable-style angle plus full-screen keyboard / pointer play
- **Single-file build** — `node build.js` produces `dist/rpe-player.html`, a standalone file
  you can double-click
- **Your own look** — bundled default resource pack, plus `.zip` packs for custom notes
  skins, hitsounds, lyrics and animated backgrounds

> **About the name:** the original prototype was a quick reading tool thrown together with an
> LLM ("phi… AI" → the working name stuck). PhiAI-Player itself ships **no cloud AI** — it
> runs 100% locally, so your charts never leave your machine and it keeps working offline.
> The "AI" lives in the name's history, not in the payload.

---

## Demo / screenshots

The header image is the actual in-game load screen. Drop a chart pack on the page and you'll
see the same UI with a live falling-note lane, judgement ladder and combo counter.

*(A short gameplay GIF is welcome here — record ~10 s of a chart, then replace this section.)*

---

## Quick start

**① Play online** — open <https://dvd1145.github.io/PhiAI-Player/>.

**② Get a chart** — any `.pez` / `.pec` / `.json` chart, or a folder of them.

**③ Play** — drag & drop the file onto the page, or click **选择文件 / 加载资源包 / 进入谱面**,
then hit **游玩**. Autoplay works out of the box.

Windows / macOS / Linux, desktop or phone — nothing to install.

For developers:

```bash
git clone https://github.com/DVD1145/PhiAI-Player.git
cd PhiAI-Player
python -m http.server 8000      # dev layout
# open http://localhost:8000
node build.js                   # → dist/rpe-player.html (single-file build)
```

Open `index.html` by double-click also works thanks to an embedded default resource pack.

---

## Highlights

- **Judgement ladder** — `PERFECT` / `GOOD` / `BAD` / `MISS`, combo, accuracy, live scoring
- **Play styles** — keyboard (any key auto-aims the nearest note), pointer / touch
  (tap, flick, drag, hold)
- **Formats** — `.pez` / `.pec` / `.json`, single files or whole folders; Phi format is
  auto-detected and converted on load
- **Recording** — record your playthrough and export a video (ffmpeg, loaded on demand)
- **Skinnable** — `.zip` resource packs bring their own note skins, hitsounds, lyrics
  (`.lrc` / `.ttml`) and animated / video backgrounds (`extra.json`)
- **Effects** — WebGL post-processing shaders, particle hits, smooth judge-line easing
- Smart: large `.json` charts (256 MB+) parse in streaming mode and stay responsive

---

## Project status & roadmap

| Status | Details |
| --- | --- |
| ✅ Working | full play loop, scoring, recording, resource packs, effects |
| 🚧 In progress | gameplay GIF demo, more chart compatibility edge-cases |
| 📌 Planned | optional online score sharing, more accessibility settings |

The single-file build (`dist/rpe-player.html`) is the deployable artifact — the repo itself
is a maintainable source-split of that file.

> **Notable:** this project was formerly named **AIRE-Player**. It was retired because it was
> hard to maintain and could be used to fake play results (custom HUD hiding / replacing
> judgement), so a few legacy UI-editor source files remain in the repo but are no longer loaded.

---

## Contributing

Issues and pull requests are welcome. Ground rules:

- keep the existing file layout (one concern per file in `js/player/`)
- run `node --check` on changed JS
- confirm `node build.js` still produces a working `dist/rpe-player.html`

## License

GPL-3.0 — see [LICENSE](LICENSE). Bundled libraries, fonts and resource-pack assets have
separate licenses/copyright — see [THIRD_PARTY.md](THIRD_PARTY.md).