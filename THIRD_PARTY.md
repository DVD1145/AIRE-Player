# THIRD PARTY NOTICES

AIRE-Player Copyright (c) 2026 AIRE-Player contributors. This program is free
software, released under the **GNU General Public License v3.0** — see
[LICENSE](LICENSE).

Some algorithms and assets in this project are derived from, inspired by, or
referenced from the following works. Their copyright and license notices are
reproduced here per their terms.

---

## 1. Engine reference implementations (algorithms only, no code copied)

The judgement-line / note geometry, flight-speed conversion and line-hierarchy
semantics in `js/player/*` are independently re-implemented but mirror the
behaviour of the following GPL-3.0 reference players:

- **prpr** — by Mivik <https://github.com/Mivik/prpr>, GPL-3.0
- **phira** — by TeamFlos <https://github.com/TeamFlos/phira>, GPL-3.0

<https://www.gnu.org/licenses/gpl-3.0.html>

## 2. Bundled JavaScript libraries

- **JSZip** v3.10.1 — <https://github.com/Stuk/jszip>, by Stuart Knightley &
  contributors. Dual-licensed **MIT OR GPLv3**; this project uses it under the
  MIT terms. The license header is preserved in `js/vendor/jszip.min.js`.
- **js-yaml** v4 — <https://github.com/nodeca/js-yaml>, MIT. License header
  preserved inline in `js/vendor/js-yaml.js`.
- **gif-reader.js / omggif** — Copyright (c) 2013 Dean McNamee, MIT. Header
  preserved in `js/lib/gif-reader.js`.
- **@ffmpeg/ffmpeg.wasm** — <https://github.com/ffmpegwasm/ffmpeg.wasm>, MIT.
  Loaded from a CDN at runtime; not bundled.

## 3. Fonts

- **fonts/AppFont.ttf** — "Source Han Sans & Saira Hybrid" (a third-party
  modified font). Contains:
  - **Source Han Sans** — Copyright (c) 2014 Adobe Systems Incorporated
    <https://www.adobe.com/type/>. Licensed under the **Apache License,
    Version 2.0** <https://www.apache.org/licenses/LICENSE-2.0>. Redistribution
    must retain the above copyright notice.
  - **Saira** — Copyright (c) 2015 The Saira Project Authors
    <https://github.com/googlefonts/saira/> (original designer: Paul D. Hunt),
    SIL **OFL-1.1** <https://openfontlicense.org/>.
  Under the Apache-2.0 terms: you may NOT use this font file in ways that
  misrepresents its origin; the file's embedded name table retains all original
  notices. If you redistribute or modify this font, preserve the notices above.

## 4. Bundled resource pack

- **assets/builtin/** — the default pack is the **"Phigros Official"** skin,
  Copyright (c) **PigeonGames** (原鸽游戏). It is a closed-source game's
  resource pack bundled ONLY as a local/offline fallback for personal,
  non-commercial chart-preview use. It is **not** licensed under this
  project's GPL-3.0 and may not be redistributed commercially. All rights
  remain with PigeonGames. If you are PigeonGames and object to it being
  bundled here, please open an issue.

---

Nothing in this notice licenses, or is intended to license, the "Phigros"
game, its trademarks, or its artwork. Phigros and its assets belong to
PigeonGames. This project is an unofficial, fan-made tool.