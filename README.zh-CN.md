[English](README.md) · **简体中文**

<p align="center">
  <img src="README.png" alt="AIRE-Player">
</p>

一个运行于浏览器的 RPE / Phigros 风格音游谱面播放器。把谱面包或文件拖到页面上，它会解析谱面包、加载音频与图片，并在 `<canvas>` 上实时渲染游玩画面——下落音符、判定线、连击、计分、打击音效，以及可选的 WebGL 后期特效。

本项目以可编辑的多文件代码库形式存在，并附带一个构建步骤，可将所有内容重新打包回一个自包含的 HTML 文件，双击即可运行。

## 背景

本代码库是从一个可用的单文件播放器重构并拆分的源代码发布（原版是一个约 25 MB 的 `rpe-player.html`，把样式、库、字体、声音和图片全部以 base64 data URI 内嵌）。谱面语义、渲染方式与内置资源均来自该原版；本仓库以更易于维护的方式重新组织——不改变播放谱面的方式。

## 快速开始

开发版布局最好通过 HTTP 提供服务——它用 `fetch` 加载文件（内置资源包）以及外部 `<script>` 标签，因此用服务器可以获得包括联网扩展在内的一切：

```bash
python -m http.server 8000
# 或:  npx serve
```

然后打开 `http://localhost:8000`，你会进入加载界面：

- **选择文件** — 选择一个或多个谱面文件
- **加载资源包 (.zip)** — 导入自定义资源包
- **进入谱面文件夹** — 打开一个含谱面文件的文件夹

也可以直接把文件或文件夹**拖拽**到页面上。勾选谱面后会有 撤销、游玩、独立窗口、录制 选项。

直接双击打开 `index.html`（`file://`）也可以正常使用核心功能：内置资源包带有嵌入式回退副本（`js/builtin-resources.js`），因此默认皮肤与默认音效依然生效。需要联网的功能——`extra.json` 中的 BGA 视频、谱面提示的 `fetch`、录制导出所用的 CDN ffmpeg——则需要服务器。

### 支持的谱面格式

- `.pez` / `.zip` 谱面包
- `.pec`、`.json`、`.rpe` 谱面文件
- `.pcmy` 旧版格式文件
- 整个谱面文件夹

### 构建单文件播放器

```bash
node build.js
```

该命令把所有 CSS、脚本、字体、图片和声音重新内联回页面，并把内置资源包以 `window.BUILTIN_RESOURCES` 嵌入——输出 `dist/rpe-player.html` 是一个完全独立的文件，双击即可运行。

## 功能特性

- **判定阶梯** — `PERFECT` / `GOOD` / `BAD` / `MISS`，含连击、准确度与实时计分
- **自动演示**，暂停/继续、重开、谱面速度控制
- **键盘游玩** — 任意按键打击最近音符，全屏判定
- **指针 / 触屏** — 支持点击、上划、拖划、长按音符
- **谱面录制** 与回放导出
- 资源包**打击音效**，以及 `.lrc` / `.ttml` 歌词
- 来自谱面包 `extra.json` 的动画 / 视频**背景**
- **附加特效** — `extra.json` 特效与 WebGL 后期着色器
- 内置默认资源包，无自定义皮肤的谱面依然好看

## 环境要求

- **Node.js** — 仅构建 `build.js` 时需要；最新的 LTS 即可
- 开发版布局需要静态文件服务器（`python -m http.server`、`npx serve`、…）
- 支持 Canvas 与 WebGL 的现代浏览器（Chrome、Edge、Firefox、Safari）

## 操作说明

| 输入 | 操作 |
| --- | --- |
| 任意按键（开启键盘游玩后） | 打击最近音符 |
| 指针 / 触屏拖划 | 在画布上打击音符 |
| `Esc` | 返回加载界面（暂停播放） |
| 暂停按钮 | 播放 / 暂停 |

游玩 UI 编辑器（右上角网格图标，*游玩UI编辑器*）可重新摆放 HUD 元素、添加自定义元素，并可将自定义布局导出/导入为 ZIP。方向键移动选中元素，`Del`/`Backspace` 删除。

## 仓库结构

```
AIRE-Player/
├── index.html           开发版入口（多文件布局；可服务器运行或双击）
├── build.js             构建脚本 → dist/rpe-player.html（单文件）
├── gen-builtin-resources.js   重新生成内置资源包回退副本
├── README.md            文档（英文）
├── README.zh-CN.md      文档（简体中文）
├── README.png           README 使用的横幅图片
├── LICENSE              MIT 许可证
├── dist/                构建输出
├── css/                 主样式 + 编辑器 UI 样式
├── fonts/               内嵌谱面字体（AppFont）
├── assets/              图片、内置资源包文件、开机/启动音效
└── js/
    ├── config.js        开发版路径（音效文件、内置资源包目录）
    ├── builtin-resources.js  （生成的）assets/builtin/ 的 base64 副本，供 file:// 使用
    ├── vendor/          第三方库（JSZip、js-yaml）
    ├── lib/             引擎辅助：GIF 解码、粒子系统、着色器、
    │                     缓动、谱面解析、PEZ 解析、资源包加载
    ├── player/          `EnhancedRPEPlayer` 类，按职责拆分文件
    │                     （core、settings、assets、audio、loaders、chart、playback、
    │                       judgement、scoring、rendering、fx、background、lyrics、
    │                       ui、controls、recording）
    ├── bootstrap.js     顶层接线：canvas、拖放处理、播放器启动
    ├── splash.js        启动动画
    └── uie.js           编辑器 / 设置 UI 胶水
```

类定义位于 `js/player/core.js`（含构造函数）；其余每个 `js/player/*` 文件都是一小段 `Object.assign(EnhancedRPEPlayer.prototype, …)`，因此脚本按顺序加载后，播放器仍表现为一个类。脚本顺序很重要——`index.html` 中按必需的顺序列出。

## 实现说明

- **判定线 / 音符几何**遵循 RPE 规范：`speedEvents` 从拍子轴转换为秒，并带有 `×40` 基础速度系数与单音符倍率。
- **Phigros 谱面**在加载时自动识别并转换为内部音符模型。
- **打击音效处理**模仿 Phigros 风格混音：声音进入单一混音总线，配合限制器，快速打击时不会爆音。
- **大谱面**（超过 256 MB 的 `.json`）采用流式解析，避免阻塞界面。

## 贡献

欢迎提交 Issue 与 Pull Request。修复 bug 或新增功能时，请保持现有结构——与文件布局一致，对修改的 JS 执行 `node --check`，并用 `node build.js` 确认构建出的独立文件仍可运行。

## 许可证

MIT——见 [LICENSE](LICENSE)。