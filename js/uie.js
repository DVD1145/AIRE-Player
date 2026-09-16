// AIRE-Player | js/uie.js
// Settings / editor UI glue for the split (dev) layout. Same code is inlined by build.js.
(function () {
'use strict';
var DW = 1350, DH = 900;
var BUILTIN_FONTS = ['MiSans', 'PingFang SC', 'Microsoft YaHei', 'SimHei', 'Noto Sans SC', 'Arial', 'Segoe UI', 'Roboto', 'Georgia', 'serif', 'monospace'];
var TYPES = {
  score: { name: '分数元素' }, combo: { name: '连击分元素' }, maxcombo: { name: '最高连击分元素' },
  image: { name: '图片元素' }, title: { name: '曲名元素' }, difficulty: { name: '难度元素' },
  bar: { name: '进度条元素' }, pause: { name: '暂停元素' }, hitlabel: { name: '打击标签元素' },
  goodcount: { name: '当前Good元素' }, perfectcount: { name: '当前Perfect元素' },
  text: { name: '文本元素' }, chartinfo: { name: '谱面结构信息元素' }
};
var SAMPLE = { score: '0987650', combo: '234', maxcombo: '456', good: '12', perfect: '678', hitlabel: '700', title: '示例曲名 Sample Song', difficulty: 'Lv.11', text: '自定义文本', chartinfo: 'BPM 120  ·  时长 2:30  ·  物量 456' };
// Anchor positioning: l/c/r x t/m/b; the editor always shows the design space, the runtime converts by anchor (equivalent to the original gap x uis)
function anchorXY(el, cw, ch, k) {
  var an = el.anchor || (function () { var cx = el.x + el.w / 2, cy = el.y + el.h / 2; return (cx < DW / 3 ? 'l' : cx > DW * 2 / 3 ? 'r' : 'c') + (cy < DH / 3 ? 't' : cy > DH * 2 / 3 ? 'b' : 'm'); })();
  var L = an.charAt(0) === 'l' ? el.x * k : an.charAt(0) === 'r' ? cw - (DW - el.x) * k : cw / 2 + (el.x - DW / 2) * k;
  var T = an.charAt(1) === 't' ? el.y * k : an.charAt(1) === 'b' ? ch - (DH - el.y) * k : ch / 2 + (el.y - DH / 2) * k;
  return { x: L, y: T };
}
var SLOT_MAP = { pause: 'pause', score: 'score', combo: 'combonumber', title: 'name', difficulty: 'level', bar: 'bar' };

function defEl(type, x, y, w, h, fontSize, extra) {
  var el = { id: type + '-1', type: type, name: TYPES[type].name, x: x, y: y, w: w, h: h, visible: true,
    anchor: 'lt', fontFamily: 'AppFont', fontSize: fontSize, color: '#ffffff', bold: false, italic: false,
    letterSpacing: 0, align: 'center', prefix: '', src: null, customFont: null, text: '' };
  if (extra) for (var k in extra) el[k] = extra[k];
  return el;
}
function defaultLayout() {
  // Values measured from the real default HUD on the 1350x900 baseline (CSS px x --uis 1.43)
  return [
    Object.assign(defEl('pause', 28.6, 37.2, 42.9, 42.9, 30), { anchor: 'lt' }),
    Object.assign(defEl('combo', 525, 17.2, 300, 126, 102.96), { anchor: 'ct' }),
    Object.assign(defEl('score', 1015.7, 28.6, 300, 52, 51.48, { align: 'right', letterSpacing: 1 }), { anchor: 'rt' }),
    Object.assign(defEl('title', 42.9, 814.7, 420, 36, 34.32, { align: 'left' }), { anchor: 'lb' }),
    Object.assign(defEl('difficulty', 1107.1, 817.7, 200, 33, 31.46, { align: 'right' }), { anchor: 'rb' }),
    Object.assign(defEl('bar', 0, 0, 1350, 11.4, 11, { color: 'rgba(255,255,255,.5)' }), { anchor: 'lt' })
  ];
}

// ===== State =====
var elements = defaultLayout();
var assets = { fonts: {}, images: {} }; // fonts:{fname:{family,dataURL}} images:{fname:dataURL}
var selectedId = null, idSeq = 1, newCount = 0;
var grid = { size: 20, snap: true, show: true };
var hasChanges = false;
function markChanged() { hasChanges = true; updateSaveMenu(); }
function isDefaultLayout() {
  if (elements.length !== defaultLayout().length) return false;
  var def = defaultLayout();
  for (var i = 0; i < elements.length; i++) {
    var a = elements[i], b = def[i];
    if (a.type !== b.type) return false;
    if (Math.abs(a.x - b.x) > 0.1 || Math.abs(a.y - b.y) > 0.1) return false;
    if (Math.abs(a.w - b.w) > 0.1 || Math.abs(a.h - b.h) > 0.1) return false;
  }
  return true;
}
function updateSaveMenu() {
  var saveItem = document.querySelector('#uie-file-menu [data-act="save"]');
  if (!saveItem) return;
  var isDef = isDefaultLayout() && !hasChanges;
  saveItem.style.opacity = isDef ? '0.4' : '';
  saveItem.style.pointerEvents = isDef ? 'none' : '';
  saveItem.style.cursor = isDef ? 'not-allowed' : '';
  saveItem.title = isDef ? '当前为默认UI，无需保存' : '保存到浏览器';
}
var stageScale = 1, pvw = 1350, pscale = 1, previewCW = window.innerWidth, previewCH = window.innerHeight;
var $ = function (id) { return document.getElementById(id); };

// ===== Node content building (shared by the editor and the runtime) =====
function valueOf(el, vals) {
  if (el.type === 'text') return el.text || '';
  var v = vals[el.type]; if (v === undefined || v === null) v = '';
  return (el.prefix || '') + v;
}
// Stretch: measure the natural content size and scale it independently to the box width and height (true WYSIWYG 'size = stretch')
function fitStretch(inner, el, boxW, boxH) {
  inner.style.transform = '';
  var oldW = inner.style.width, oldH = inner.style.height;
  inner.style.width = 'max-content';
  inner.style.height = 'max-content';
  var r = inner.getBoundingClientRect();
  inner.style.width = oldW;
  inner.style.height = oldH;
  if (!r.width || !r.height) return '';
  var t = 'scale(' + (boxW / r.width).toFixed(4) + ', ' + (boxH / r.height).toFixed(4) + ')';
  inner.style.transformOrigin = (el.align === 'left' ? '0' : el.align === 'right' ? '100%' : '50%') + ' 0';
  inner.style.transform = t;
  return t;
}
// Stretch ratio = box / designed natural size; with no nw/nh (default / old saves) it is identity, looking the same as the original
function computeStretch(el) {
  if (!el.nw || !el.nh || el.type === 'bar' || el.type === 'pause' || el.type === 'image') return '';
  return 'scale(' + (el.w / el.nw).toFixed(4) + ', ' + (el.h / el.nh).toFixed(4) + ')';
}
// Combo number: the real content fills the box adaptively (changing live with the box size and digit count) instead of locking a fixed glyph
function comboStretch(el, inner, rs) {
  if (!inner) return '';
  var ow = inner.style.width, oh = inner.style.height, ot = inner.style.transform;
  inner.style.transform = 'none';
  inner.style.width = 'max-content';
  inner.style.height = 'max-content';
  var r = inner.getBoundingClientRect();
  inner.style.width = ow; inner.style.height = oh; inner.style.transform = ot;
  if (r.width < 2 || r.height < 2) return '';
  var nw = r.width / rs, nh = r.height / rs;
  var s = Math.min(el.w / nw, el.h / nh) * 0.85;
  return 'scale(' + s.toFixed(4) + ', ' + s.toFixed(4) + ')';
}
function resolveStretch(el, inner, rs) {
  if (el.type === 'combo' && inner) return comboStretch(el, inner, rs);
  return computeStretch(el);
}
function applyTextStyle(node, el) {
  node.style.fontFamily = '"' + el.fontFamily + '", sans-serif';
  node.style.fontSize = Math.max(4, el.fontSize * stageScale) + 'px';
  node.style.color = el.color;
  node.style.fontWeight = el.bold ? '700' : '400';
  node.style.fontStyle = el.italic ? 'italic' : 'normal';
  node.style.letterSpacing = (el.letterSpacing * stageScale) + 'px';
  node.style.justifyContent = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
  node.style.alignItems = 'center';
  node.style.lineHeight = '1';
}
function buildNode(el, vals, runtime, scale) {
  scale = scale || stageScale;
  var n;
  if (el.type === 'bar') {
    n = document.createElement('div');
    n.style.cssText = 'width:100%;height:100%;background:transparent;position:relative;overflow:hidden';
    var fill = document.createElement('div');
    fill.className = 'cu-bar-fill';
    fill.style.cssText = 'height:100%;width:' + ((vals.progress !== undefined ? vals.progress : 0.42) * 100) + '%;background:' + el.color + ';border-radius:inherit';
    n.appendChild(fill);
  } else if (el.type === 'pause') {
    n = document.createElement('div');
    n.style.cssText = 'width:100%;height:100%;background:transparent;display:flex;align-items:center;justify-content:center';
    n.innerHTML = '<svg viewBox="0 0 37 41" style="width:100%" aria-hidden="true">' +
      '<path d="M0 0 C3.63 0 7.26 0 11 0 C11 12.87 11 25.74 11 39 C7.37 39 3.74 39 0 39 C0 26.13 0 13.26 0 0 Z" fill="#FFFFFF"/>' +
      '<path d="M0 0 C3.63 0 7.26 0 11 0 C11 12.87 11 25.74 11 39 C7.37 39 3.74 39 0 39 C0 26.13 0 13.26 0 0 Z" fill="#FFFFFF" transform="translate(22,0)"/>' +
      '<path d="M0 0 C1.32 0 2.64 0 4 0 C4 12.87 4 25.74 4 39 C0.37 39 -3.26 39 -7 39 C-7 38.34 -7 37.68 -7 37 C-4.69 37 -2.38 37 0 37 C0 24.79 0 12.58 0 0 Z" fill="#000000" transform="translate(11,2)"/>' +
      '<path d="M0 0 C1.32 0 2.64 0 4 0 C4 12.87 4 25.74 4 39 C0.37 39 -3.26 39 -7 39 C-7 38.34 -7 37.68 -7 37 C-4.69 37 -2.38 37 0 37 C0 24.79 0 12.58 0 0 Z" fill="#000000" transform="translate(33,2)"/></svg>';
  } else if (el.type === 'image') {
    n = document.createElement('div');
    n.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden';
    if (el.src && assets.images[el.src]) {
      var img = document.createElement('img');
      img.src = assets.images[el.src];
      img.style.cssText = 'max-width:100%;max-height:100%';
      n.appendChild(img);
    } else {
      n.style.border = '1px dashed rgba(140,150,190,.5)';
      n.style.color = 'rgba(140,150,190,.8)';
      n.textContent = runtime ? '' : '图片未设置';
    }
  } else if (el.type === 'combo') {
    n = document.createElement('div');
    n.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;white-space:nowrap';
    var cnum = document.createElement('div');
    cnum.textContent = valueOf(el, vals);
    applyTextStyle(cnum, el);
    cnum.style.lineHeight = '1';
    var clbl = document.createElement('div');
    clbl.textContent = vals.comboLabel || 'COMBO';
    clbl.style.cssText = 'font-size:' + Math.max(4, el.fontSize * 0.25 * scale) + 'px;letter-spacing:' + (el.fontSize * 0.0556 * scale) + 'px;color:#aaa;margin-top:' + (-el.fontSize * 0.0833 * scale) + 'px;font-weight:400;line-height:1.2;font-family:"' + el.fontFamily + '", sans-serif';
    n.appendChild(cnum); n.appendChild(clbl);
  } else {
    n = document.createElement('div');
    n.style.cssText = 'width:100%;display:flex;white-space:nowrap';
    n.textContent = valueOf(el, vals);
    applyTextStyle(n, el);
  }
  return n;
}

// ===== Editor rendering =====
function elById(id) { for (var i = 0; i < elements.length; i++) if (elements[i].id === id) return elements[i]; return null; }
function layoutStage() {
  var pr = window.playerRef;
  var cw = (pr && pr.width) ? pr.width : window.innerWidth;
  var ch = (pr && pr.height) ? pr.height : window.innerHeight;
  if (!cw || !ch || cw < 100 || ch < 100) return;
  previewCW = cw; previewCH = ch;
  var sx = cw / DW, sy = ch / DH, k = Math.min(sx, sy);
  stageScale = k; // Preview scale = the runtime scale k, so the editor preview matches what the game actually shows
  pvw = cw; pscale = k; // Kept for legacy references
  var st = $('uie-stage');
  st.style.width = cw + 'px';
  st.style.height = ch + 'px';
  var gs = grid.size * stageScale;
  $('uie-grid').style.backgroundSize = (gs * 5) + 'px ' + (gs * 5) + 'px,' + (gs * 5) + 'px ' + (gs * 5) + 'px,' + gs + 'px ' + gs + 'px,' + gs + 'px ' + gs + 'px';
}
function editorVals() {
  return { score: SAMPLE.score, combo: SAMPLE.combo, maxcombo: SAMPLE.maxcombo, good: SAMPLE.good,
    perfect: SAMPLE.perfect, hitlabel: SAMPLE.hitlabel, title: SAMPLE.title, difficulty: SAMPLE.difficulty,
    comboLabel: 'COMBO', progress: 0.42 };
}
function renderElements() {
  var host = $('uie-elements');
  host.innerHTML = '';
  var tip = $('uie-empty-tip') || (function () { var t = document.createElement('div'); t.id = 'uie-empty-tip'; t.textContent = '右侧「添加元素」开始搭建你的游玩界面'; $('uie-stage').appendChild(t); return t; })();
  elements.forEach(function (el) {
    var d = document.createElement('div');
    d.className = 'uie-el' + (el.id === selectedId ? ' selected' : '');
    d.dataset.id = el.id;
    var apE = anchorXY(el, previewCW, previewCH, stageScale);
    if (el.type === 'bar') {
      // Progress bar: pinned to the screen top, spanning the full width, width follows screen x (el.w / el.y ignored)
      d.style.left = '0px';
      d.style.top = '0px';
      d.style.width = previewCW + 'px';
    } else {
      d.style.left = apE.x + 'px';
      d.style.top = apE.y + 'px';
      d.style.width = (el.w * stageScale) + 'px';
    }
    d.style.height = (el.h * stageScale) + 'px';
    d.style.opacity = el.visible ? '' : '.3';
    d.appendChild(buildNode(el, editorVals(), false));
    host.appendChild(d);
    var __st = resolveStretch(el, d.firstChild, stageScale);
    if (__st) {
      d.firstChild.style.transformOrigin = (el.align === 'left' ? '0' : el.align === 'right' ? '100%' : '50%') + ' 0';
      d.firstChild.style.transform = __st;
    }
    if (!el.visible) d.style.outline = '1px dashed rgba(140,150,190,.4)';
    makeDraggable(d, el);
    d.addEventListener('pointerdown', function (e) { selectEl(el.id); });
  });
  tip.style.display = elements.length ? 'none' : 'block';

  renderHandles();
}
var handleDefs = [['nw', '-5px', '-5px'], ['n', '', '-5px'], ['ne', '-5px', '-5px'], ['e', '-5px', ''], ['se', '-5px', '-5px'], ['s', '-5px', ''], ['sw', '-5px', '-5px'], ['w', '', '-5px']];
function renderHandles() {
  document.querySelectorAll('.uie-handle').forEach(function (h) { h.remove(); });
  var sel = elById(selectedId);
  if (!sel || !sel.visible) return;
  var node = document.querySelector('.uie-el[data-id="' + selectedId + '"]');
  if (!node) return;
  ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (dir) {
    var h = document.createElement('div');
    h.className = 'uie-handle';
    h.dataset.dir = dir;
    h.style.position = 'absolute';
    if (dir.indexOf('n') >= 0) h.style.top = '-5px';
    if (dir.indexOf('s') >= 0) h.style.bottom = '-5px';
    if (dir.indexOf('w') >= 0) h.style.left = '-5px';
    if (dir.indexOf('e') >= 0) h.style.right = '-5px';
    if (dir === 'n' || dir === 's') { h.style.left = 'calc(50% - 4.5px)'; }
    if (dir === 'e' || dir === 'w') { h.style.top = 'calc(50% - 4.5px)'; }
    h.addEventListener('pointerdown', function (e) { e.stopPropagation(); startResize(e, sel, dir); });
    node.appendChild(h);
  });
}
function snap(v) { return grid.snap ? Math.round(v / grid.size) * grid.size : Math.round(v); }
function captureNatural(el) {
  if (el.nw && el.nh) return;
  var node = document.querySelector('.uie-el[data-id="' + el.id + '"]');
  if (!node || !node.firstChild) return;
  var inn = node.firstChild;
  var ow = inn.style.width, oh = inn.style.height, ot = inn.style.transform;
  inn.style.transform = 'none';
  inn.style.width = 'max-content';
  inn.style.height = 'max-content';
  var r = inn.getBoundingClientRect();
  inn.style.width = ow; inn.style.height = oh; inn.style.transform = ot;
  if (r.width > 2 && r.height > 2) { el.nw = r.width / stageScale; el.nh = r.height / stageScale; }
}
function startResize(e, el, dir) {
  e.preventDefault();
  if (el.type !== 'bar' && el.type !== 'pause' && el.type !== 'image') captureNatural(el);
  var sx0 = e.clientX, sy0 = e.clientY, o = { x: el.x, y: el.y, w: el.w, h: el.h };
  var sizeKx = el.type === 'bar' ? (pvw / DW * pscale) : stageScale;
  function mv(ev) {
    var dxp = ev.clientX - sx0, dyp = ev.clientY - sy0;
    if (el.type === 'bar') {
      // Progress bar width / position are fixed (pinned to the top, full width); only the height is adjustable
      if (dir.indexOf('s') >= 0) el.h = Math.max(8, snap(o.h + dyp / stageScale));
      if (dir.indexOf('n') >= 0) el.h = Math.max(8, snap(o.h - dyp / stageScale));
      renderElements(); renderProps(); return;
    }
    if (dir.indexOf('e') >= 0) el.w = Math.max(8, snap(o.w + dxp / sizeKx));
    if (dir.indexOf('s') >= 0) el.h = Math.max(8, snap(o.h + dyp / stageScale));
    if (dir.indexOf('w') >= 0) { el.w = Math.max(8, snap(o.w - dxp / sizeKx)); el.x = snap(o.x + dxp / stageScale); }
    if (dir.indexOf('n') >= 0) { el.h = Math.max(8, snap(o.h - dyp / stageScale)); el.y = snap(o.y + dyp / stageScale); }
    renderElements(); renderProps();
  }
  function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}
function makeDraggable(node, el) {
  node.addEventListener('pointerdown', function (e) {
    if (el.type === 'bar') return; // Progress bar position is fixed (pinned to the top, full width) and cannot be dragged
    if (e.target.classList.contains('uie-handle')) return;
    e.preventDefault();
    var sx0 = e.clientX, sy0 = e.clientY, ox = el.x, oy = el.y;
    function mv(ev) {
      el.x = Math.max(-el.w / 2, Math.min(DW - el.w / 2, snap(ox + (ev.clientX - sx0) / stageScale)));
      el.y = Math.max(-el.h / 2, Math.min(DH - el.h / 2, snap(oy + (ev.clientY - sy0) / stageScale)));
      renderElements(); renderProps();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
}

// ===== Layer panel / property panel / add element =====
function renderLayers() {
  var host = $('uie-layers');
  host.innerHTML = '';
  var list = elements.slice().reverse();
  list.forEach(function (el) {
    var row = document.createElement('div');
    row.className = 'uie-layer' + (el.id === selectedId ? ' selected' : '') + (el.visible ? '' : ' hidden-el');
    var eye = document.createElement('button');
    eye.textContent = el.visible ? '👁' : '—';
    eye.title = '显示/隐藏';
    eye.onclick = function (e) { e.stopPropagation(); el.visible = !el.visible; markChanged(); renderAll(); };
    var nm = document.createElement('span');
    nm.className = 'lname';
    nm.textContent = el.name;
    row.appendChild(eye); row.appendChild(nm);
    ['↑', '↓'].forEach(function (arr, idx) {
      var b = document.createElement('button');
      b.textContent = arr;
      b.title = idx === 0 ? '上移一层' : '下移一层';
      b.onclick = function (e) {
        e.stopPropagation();
        var i = elements.indexOf(el);
        var j = idx === 0 ? i + 1 : i - 1;
        if (j < 0 || j >= elements.length) return;
        elements[i] = elements[j]; elements[j] = el;
        markChanged();
        renderAll();
      };
      row.appendChild(b);
    });
    var del = document.createElement('button');
    del.textContent = '✕';
    del.title = '删除';
    del.onclick = function (e) { e.stopPropagation(); elements.splice(elements.indexOf(el), 1); if (selectedId === el.id) selectedId = null; markChanged(); renderAll(); };
    row.appendChild(del);
    row.onclick = function () { selectEl(el.id); var lp = $('uie-layers-panel'); if (lp) lp.classList.remove('open'); };
    host.appendChild(row);
  });
}
function selectEl(id) { selectedId = id; renderElements(); renderLayers(); renderProps(); }
function prow(labelText, inputEl) {
  var r = document.createElement('div'); r.className = 'prow';
  var l = document.createElement('label'); l.textContent = labelText;
  r.appendChild(l); r.appendChild(inputEl); return r;
}
function numInput(v, cb, step) {
  var i = document.createElement('input'); i.type = 'number'; i.value = v; if (step) i.step = step;
  i.oninput = function () { var n = parseFloat(i.value); if (!isNaN(n)) cb(n); };
  return i;
}
function renderProps() {
  var host = $('uie-props');
  host.innerHTML = '';
  var el = elById(selectedId);
  // Grid settings (always visible)
  var gt = document.createElement('div'); gt.className = 'panel-title';
  gt.textContent = '网格'; gt.style.marginTop = '16px';
  host.appendChild(gt);
  host.appendChild(prow('网格大小', numInput(grid.size, function (n) { grid.size = Math.max(2, n); markChanged(); layoutStage(); }, 1)));
  ['吸附:grid.snap', '显示:grid.show'].forEach(function (defi) {
    var parts = defi.split(':');
    var wrap = document.createElement('div'); wrap.className = 'chkrow';
    var lb = document.createElement('label');
    var ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = grid[parts[1]];
    ck.onchange = function () { grid[parts[1]] = ck.checked; markChanged(); if (parts[1] === 'show') $('uie-grid').classList.toggle('hidden', !ck.checked); };
    lb.appendChild(ck); lb.appendChild(document.createTextNode(parts[0]));
    wrap.appendChild(lb); host.appendChild(wrap);
  });
  if (!el) return;
  var t = document.createElement('div'); t.className = 'panel-title'; t.textContent = '属性 · ' + el.name;
  host.appendChild(t);
  var nameI = document.createElement('input'); nameI.type = 'text'; nameI.value = el.name;
  nameI.oninput = function () { el.name = nameI.value || TYPES[el.type].name; markChanged(); renderLayers(); };
  host.appendChild(prow('名称', nameI));
  host.appendChild(prow('X', numInput(el.x, function (n) { el.x = n; markChanged(); renderElements(); })));
  host.appendChild(prow('Y', numInput(el.y, function (n) { el.y = n; markChanged(); renderElements(); })));
  host.appendChild(prow('宽', numInput(el.w, function (n) { el.w = Math.max(4, n); markChanged(); renderElements(); })));
  host.appendChild(prow('高', numInput(el.h, function (n) { el.h = Math.max(4, n); markChanged(); renderElements(); })));
  if (el.type !== 'bar' && el.type !== 'pause' && el.type !== 'image') {
    var fs = document.createElement('select');
    BUILTIN_FONTS.concat(Object.keys(assets.fonts).map(function (k) { return assets.fonts[k].family; })).forEach(function (f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f;
      if (el.fontFamily === f || assets.fonts[Object.keys(assets.fonts).find(function (k) { return assets.fonts[k].family === el.fontFamily; })] && assets.fonts[Object.keys(assets.fonts).find(function (k) { return assets.fonts[k].family === el.fontFamily; })].family === f) o.selected = true;
      fs.appendChild(o);
    });
    var upO = document.createElement('option'); upO.value = '__upload__'; upO.textContent = '上传字体文件…';
    fs.appendChild(upO);
    fs.value = el.fontFamily;
    var found = BUILTIN_FONTS.indexOf(el.fontFamily) >= 0 || Object.keys(assets.fonts).some(function (k) { return assets.fonts[k].family === el.fontFamily; }) || ['serif', 'monospace'].indexOf(el.fontFamily) >= 0;
    if (!found) { var o = document.createElement('option'); o.value = el.fontFamily; o.textContent = el.fontFamily + '(未加载)'; fs.insertBefore(o, upO); fs.value = el.fontFamily; }
    fs.onchange = function () {
      if (fs.value === '__upload__') { window.__uieFontTarget = el.id; $('uie-font-input').click(); setTimeout(function () { fs.value = el.fontFamily; }, 0); return; }
      el.fontFamily = fs.value; el.customFont = null;
      for (var k in assets.fonts) if (assets.fonts[k].family === fs.value) el.customFont = k;
      delete el.nw; delete el.nh;
      markChanged();
      renderElements();
    };
    host.appendChild(prow('字体', fs));
    host.appendChild(prow('字号', numInput(el.fontSize, function (n) { el.fontSize = n; delete el.nw; delete el.nh; markChanged(); renderElements(); })));
    var ci = document.createElement('input'); ci.type = 'color'; ci.value = el.color;
    ci.oninput = function () { el.color = ci.value; markChanged(); renderElements(); };
    host.appendChild(prow('颜色', ci));
    var ls = numInput(el.letterSpacing, function (n) { el.letterSpacing = n; markChanged(); renderElements(); }, 1);
    host.appendChild(prow('字距', ls));
    var al = document.createElement('select');
    ['left', 'center', 'right'].forEach(function (a) { var o = document.createElement('option'); o.value = a; o.textContent = a; if (el.align === a) o.selected = true; al.appendChild(o); });
    al.onchange = function () { el.align = al.value; markChanged(); renderElements(); };
    host.appendChild(prow('对齐', al));
    var chk = document.createElement('div'); chk.className = 'chkrow';
    [['加粗', 'bold'], ['斜体', 'italic']].forEach(function (pair) {
      var lb = document.createElement('label');
      var ck2 = document.createElement('input'); ck2.type = 'checkbox'; ck2.checked = el[pair[1]];
      ck2.onchange = function () { el[pair[1]] = ck2.checked; markChanged(); renderElements(); };
      lb.appendChild(ck2); lb.appendChild(document.createTextNode(pair[0]));
      chk.appendChild(lb);
    });
    host.appendChild(chk);
    var pf = document.createElement('input'); pf.type = 'text'; pf.placeholder = '例: COMBO '; pf.value = el.prefix || '';
    pf.oninput = function () { el.prefix = pf.value; markChanged(); renderElements(); };
    host.appendChild(prow('前缀', pf));
  }
  if (el.type === 'text') {
    var ti = document.createElement('input'); ti.type = 'text'; ti.value = el.text || '';
    ti.oninput = function () { el.text = ti.value; markChanged(); renderElements(); };
    host.appendChild(prow('文本内容', ti));
  }
  if (el.type === 'chartinfo') {
    var ci = document.createElement('select');
    ['bpm', 'duration', 'notes', 'all'].forEach(function (o) {
      var opt = document.createElement('option'); opt.value = o;
      opt.textContent = { bpm: '仅 BPM', duration: '仅时长', notes: '仅物量', all: '全部信息' }[o];
      if ((el.infoMode || 'all') === o) opt.selected = true;
      ci.appendChild(opt);
    });
    ci.onchange = function () { el.infoMode = ci.value; markChanged(); renderElements(); };
    host.appendChild(prow('显示模式', ci));
  }
    if (el.type === 'image') {
    var ib = document.createElement('button'); ib.className = 'uie-addbtn'; ib.style.width = '100%';
    ib.textContent = el.src ? '更换图片 (' + el.src + ')' : '选择图片…';
    ib.onclick = function () { window.__uieImgTarget = el.id; $('uie-img-input').click(); };
    host.appendChild(prow('图片', ib));
  }
}
function renderAddButtons() {
  var host = $('uie-addgrid');
  host.innerHTML = '';
  Object.keys(TYPES).forEach(function (type) {
    var b = document.createElement('button');
    b.className = 'uie-addbtn';
    b.textContent = TYPES[type].name.replace('元素', '');
    b.title = '添加' + TYPES[type].name;
    b.onclick = function () {
      newCount++;
      var el = defaultLayoutElementFor(type, newCount);
      elements.push(el);
      markChanged();
      selectEl(el.id);
    };
    host.appendChild(b);
  });
}

// ===== Default parameters for new elements =====
function defaultLayoutElementFor(type, seq) {
  var base = defEl(type, 0, 0, 0, 0, 24);
  base.id = type + '-' + Date.now() + '-' + seq;
  base.name = TYPES[type].name;
  var off = (seq % 8) * 16;
  var dims = { score: [280, 48, 36], combo: [300, 120, 72], maxcombo: [300, 36, 22], image: [260, 160, 24],
    title: [420, 44, 24], difficulty: [220, 44, 24], bar: [1350, 8, 8], pause: [64, 64, 30],
    hitlabel: [180, 34, 20], goodcount: [160, 32, 20], perfectcount: [160, 32, 20],
    text: [240, 40, 24], chartinfo: [360, 28, 18] };
  var d = dims[type] || [200, 60, 24];
  base.w = d[0]; base.h = d[1]; base.fontSize = d[2];
  base.x = Math.round((DW - d[0]) / 2) + off; base.y = Math.round((DH - d[1]) / 2) + off;
  if (type === 'bar') { base.x = 0; base.y = 892 - off; }
  if (type === 'image') { base.color = '#ffffff'; }
  if (type === 'text') { base.text = '文本'; }
  return base;
}
// ===== File menu actions =====
function stripForStorage(layout) {
  return JSON.parse(JSON.stringify({ version: 1, grid: grid, elements: layout }));
}
function actSave() {
  try {
    var data = stripForStorage(elements);
    localStorage.setItem('pez-custom-ui-v3', JSON.stringify(data));
    var _p = window.playerRef;
    if (!(_p && _p.isPlaying)) window.CustomUI.apply(JSON.parse(JSON.stringify(data)), assets); // Do not interrupt play; it takes effect the next time a chart is entered
    toast('已保存到浏览器');
  } catch (e) { toast('保存失败: ' + e.message); }
}
function actExport() {
  var zip = new JSZip();
  var out = { version: 1, grid: grid, elements: JSON.parse(JSON.stringify(elements)) };
  Object.keys(assets.images).forEach(function (fname) {
    zip.file('assets/' + fname, assets.images[fname].split(',').pop(), { base64: true });
  });
  Object.keys(assets.fonts).forEach(function (fname) {
    zip.file('assets/fonts/' + fname, assets.fonts[fname].dataURL.split(',').pop(), { base64: true });
  });
  elements.forEach(function (el) {
    if (el.src && !assets.images[el.src]) el.src = null;
    if (el.customFont && !assets.fonts[el.customFont]) el.customFont = null;
  });
  zip.file('ui.json', JSON.stringify(out));
  zip.generateAsync({ type: 'blob' }).then(function (blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'custom-ui.zip';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    toast('已导出 custom-ui.zip');
  });
}
function mimeOf(name) {
  var ext = name.split('.').pop().toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[ext] || 'application/octet-stream';
}
function registerFont(fname, dataURL) {
  try {
    var fam = 'UIE-' + fname.replace(/[^\w.-]/g, '_');
    if (assets.fonts[fname]) document.fonts.delete(document.fonts.entries ? Array.from(document.fonts).find(function (f) { return f.family === assets.fonts[fname].family; }) || { family: '' } : { family: '' });
    var ff = new FontFace(fam, 'url(' + dataURL + ')');
    ff.load().then(function (loaded) { document.fonts.add(loaded); }).catch(function () {});
    assets.fonts[fname] = { family: fam, dataURL: dataURL };
    return fam;
  } catch (e) { return null; }
}
function actImport(file) {
  var reader = new FileReader();
  reader.onload = function () {
    JSZip.loadAsync(reader.result).then(function (zip) {
      return zip.file('ui.json').async('string').then(function (txt) {
        var data = JSON.parse(txt);
        var jobs = [];
        zip.forEach(function (rel, zf) {
          if (zf.dir || rel === 'ui.json') return;
          if (rel.indexOf('assets/') !== 0) return;
          var fname = rel.replace(/^assets\/(fonts\/)?/, '');
          jobs.push(zf.async('base64').then(function (b64) {
            var du = 'data:' + mimeOf(fname) + ';base64,' + b64;
            if (rel.indexOf('assets/fonts/') === 0) registerFont(fname, du);
            else assets.images[fname] = du;
          }));
        });
        return Promise.all(jobs).then(function () {
          grid = data.grid || grid;
          elements = data.elements || [];
          selectedId = null;
          hasChanges = false;
          renderAll(); layoutStage();
          if (window.CustomUI) window.CustomUI.apply(JSON.parse(JSON.stringify({ version: 1, grid: grid, elements: elements })), assets);
          toast('已导入 UI 布局 (' + elements.length + ' 个元素)');
        });
      });
    }).catch(function (e) { toast('导入失败: ' + e.message); });
  };
  reader.readAsArrayBuffer(file);
}
function actReset() {
  if (!confirm('恢复默认游玩UI?当前自定义布局将被清除。')) return;
  localStorage.removeItem('pez-custom-ui-v3');
  elements = defaultLayout();
  selectedId = null;
  hasChanges = false;
  renderAll();
  if (window.CustomUI) window.CustomUI.apply(null);
  toast('已恢复默认 UI');
}
function toast(msg) {
  var t = $('status-msg');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(window.__uieToastT);
  window.__uieToastT = setTimeout(function () { t.style.opacity = ''; }, 2200);
}

// ===== Open / close / collapse =====
function renderAll() { renderElements(); renderLayers(); renderProps(); updateSaveMenu(); }
function openEditor() {
  var p = window.player;
  if (p && p.isPlaying && !p.isPaused) { p.togglePlay(); }
  $('ui-editor').classList.add('open');
  document.body.classList.add('uie-open');
  hasChanges = false;
  layoutStage();
  requestAnimationFrame(function () { layoutStage(); renderAll(); });
}
function closeEditor() {
  $('ui-editor').classList.remove('open');
  document.body.classList.remove('uie-open');
  if (window.CustomUI) window.CustomUI.refresh();
}
function initUIE() {
  renderAddButtons();
  // Menu interaction
  var mi = $('uie-menu-file');
  mi.addEventListener('click', function (e) {
    if (e.target.closest('.uie-dropdown-item')) return;
    mi.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!mi.contains(e.target)) mi.classList.remove('open');
    if (!e.target.closest('.uie-el') && !e.target.closest('#uie-right') && !e.target.closest('#uie-layers-panel') && !e.target.closest('#uie-add-panel')) selectEl(null);
  });
  var back = document.createElement('div');
  back.className = 'uie-dropdown-item';
  back.dataset.act = 'close';
  back.textContent = '返回播放器';
  back.style.color = '#8fb4ff';
  $('uie-file-menu').appendChild(back);
  mi.querySelectorAll('.uie-dropdown-item').forEach(function (item) {
    item.addEventListener('click', function () {
      mi.classList.remove('open');
      var act = item.dataset.act;
      if (act === 'save') actSave();
      else if (act === 'export') actExport();
      else if (act === 'import') $('uie-zip-input').click();
      else if (act === 'reset') actReset();
      else if (act === 'close') closeEditor();
    });
  });
  $('uie-collapse').addEventListener('click', function () {
    var tb = $('uie-topbar');
    if (tb.classList.contains('collapsed-up')) {
      tb.classList.remove('collapsed-up');
      this.textContent = '▲';
    } else {
      tb.classList.add('collapsed-up');
      this.textContent = '▼';
    }
  });
  // Add element panel
  $('uie-add-btn').addEventListener('click', function () {
    $('uie-add-panel').classList.add('open');
  });
  $('uie-add-close').addEventListener('click', function () {
    $('uie-add-panel').classList.remove('open');
  });
  $('uie-add-panel').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
  // Layer panel
  $('uie-layers-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    $('uie-layers-panel').classList.toggle('open');
  });
  $('uie-layers-close').addEventListener('click', function () {
    $('uie-layers-panel').classList.remove('open');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#uie-layers-panel') && !e.target.closest('#uie-layers-btn')) {
      $('uie-layers-panel').classList.remove('open');
    }
  });
  // Close the panel after adding an element
  var _origRenderAddButtons = renderAddButtons;
  renderAddButtons = function() {
    _origRenderAddButtons();
    // Give every button the logic that closes the panel
    var btns = $('uie-addgrid').querySelectorAll('.uie-addbtn');
    btns.forEach(function(btn) {
      var origClick = btn.onclick;
      btn.onclick = function() {
        if (origClick) origClick.call(btn);
        $('uie-add-panel').classList.remove('open');
      };
    });
  };
  $('uie-right-toggle').addEventListener('click', function () {
    var r = $('uie-right');
    r.classList.toggle('collapsed');
    this.textContent = r.classList.contains('collapsed') ? '◀' : '▶';
  });
  window.addEventListener('resize', function () {
    if ($('ui-editor').classList.contains('open')) { layoutStage(); renderElements(); }
    if (window.CustomUI) window.CustomUI.refresh();
  });
  window.addEventListener('keydown', function (e) {
    if (!$('ui-editor').classList.contains('open')) return;
    if (e.key === 'Escape') closeEditor();
    var el = elById(selectedId);
    if (!el) return;
    var step = grid.snap ? grid.size : 1;
    var mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); el.x += mv[0]; el.y += mv[1]; renderElements(); renderProps(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName !== 'INPUT') {
      elements.splice(elements.indexOf(el), 1);
      selectEl(null);
    }
  });
  $('uie-zip-input').addEventListener('change', function () {
    if (this.files && this.files[0]) actImport(this.files[0]);
    this.value = '';
  });
  $('uie-font-input').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var fam = registerFont(f.name, rd.result);
      if (!fam) { toast('字体加载失败'); return; }
      var target = elById(window.__uieFontTarget);
      if (target) { target.fontFamily = fam; target.customFont = f.name; }
      toast('字体已载入: ' + fam);
      renderAll();
    };
    rd.readAsDataURL(f);
  });
  $('uie-img-input').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      assets.images[f.name] = rd.result;
      var target = elById(window.__uieImgTarget);
      if (target) { target.src = f.name; renderAll(); if (window.CustomUI) window.CustomUI.apply(JSON.parse(JSON.stringify({ version: 1, grid: grid, elements: elements })), assets); }
    };
    rd.readAsDataURL(f);
  });
  $('uie-entry').addEventListener('click', openEditor);
  // Watch the loading page visibility: hidden = entering play (collapse the editor, hide the entry button, apply the saved layout), shown again = back to the home screen
  var lsEl = $('load-screen');
  if (lsEl && window.MutationObserver) {
    var syncGame = function () {
      var inGame = lsEl.classList.contains('hidden') || lsEl.style.display === 'none';
      document.body.classList.toggle('in-game', inGame);
      if (inGame) {
        if ($('ui-editor').classList.contains('open')) closeEditor();
        try {
          var savedUI = localStorage.getItem('pez-custom-ui-v3');
          if (savedUI && !(window.CustomUI && window.CustomUI.active)) window.CustomUI.apply(JSON.parse(savedUI));
        } catch (e) {}
      }
    };
    new MutationObserver(syncGame).observe(lsEl, { attributes: true, attributeFilter: ['class', 'style'] });
    syncGame();
  }
}

// ===== Runtime custom UI layer =====
var runtime = { active: false, layout: null, nodes: null };
function dataToUrl(du) {
  try { return URL.createObjectURL((function () { var b = atob(du.split(',').pop()), arr = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i); return new Blob([arr], { type: du.slice(5, du.indexOf(';')) }); })()); }
  catch (e) { return du; }
}
window.CustomUI = {
  apply: function (data, assetMap) {
    var root = $('custom-hud');
    if (!root) return;
    if (!data || !data.elements || !data.elements.length) {
      this.active = false;
      root.style.display = 'none';
      document.body.classList.remove('custom-ui-active');
      return;
    }
    // Asset mapping: inside the editor the assets are passed directly; when restoring from localStorage there is no binary data, so images get placeholders
    if (assetMap) window.__uieAssetsLive = assetMap;
    this.active = true;
    runtime.layout = data;
    root.innerHTML = '';
    runtime.nodes = [];
    var p = window.playerRef;
    var cw = p ? p.width : window.innerWidth, ch = p ? p.height : window.innerHeight;
    var sx = cw / DW, sy = ch / DH, k = Math.min(sx, sy);
    stageScale = k; // Sync the preview scale at runtime so the editor matches the game
    root.style.display = 'block';
    document.body.classList.add('custom-ui-active');
    data.elements.forEach(function (el) {
      if (!el.visible) return;
      var d = document.createElement('div');
      d.className = 'cu-el cu-' + el.type;
      var ap0 = anchorXY(el, cw, ch, k);
      if (el.type === 'bar') {
        // Progress bar: pinned to the screen top, spanning the full width, width follows screen x (el.w / el.y ignored)
        d.style.left = '0px';
        d.style.top = '0px';
        d.style.width = cw + 'px';
      } else {
        d.style.left = ap0.x + 'px';
        d.style.top = ap0.y + 'px';
        d.style.width = (el.w * k) + 'px';
      }
      d.style.height = (el.h * k) + 'px';
      var liveAssets = window.__uieAssetsLive && (!assetMap || assetMap === window.__uieAssetsLive) ? window.__uieAssetsLive : (assetMap || { fonts: {}, images: {} });
      if (el.type === 'image' && el.src) {
        var du = liveAssets.images[el.src];
        if (du) {
          var img = document.createElement('img');
          img.src = du.slice(0, 5) === 'data:' ? dataToUrl(du) : du;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none';
          d.appendChild(img);
        }
      } else {
        var inner = buildNode(el, editorVals(), true, k);
        inner.style.fontSize = Math.max(4, (el.fontSize || 24) * k) + 'px';
        inner.style.letterSpacing = ((el.letterSpacing || 0) * k) + 'px';
        inner.style.color = el.color;
        inner.style.fontFamily = '"' + el.fontFamily + '", sans-serif';
        inner.style.fontWeight = el.bold ? '700' : '400';
        inner.style.justifyContent = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
        d.appendChild(inner);
      }
      if (el.type === 'pause') d.addEventListener('click', function () { if (p) p.togglePlay(); });
      root.appendChild(d);
      var stretchStr = resolveStretch(el, inner, k);
      if (stretchStr && inner) {
        inner.style.transformOrigin = (el.align === 'left' ? '0' : el.align === 'right' ? '100%' : '50%') + ' 0';
        inner.style.transform = stretchStr;
      }
      var ref = { el: el, node: d, inner: null, fill: null, stretch: stretchStr };
      if (el.type !== 'image' && el.type !== 'pause') {
        ref.inner = el.type === 'bar' ? null : inner;
        ref.fill = inner.querySelector ? inner.querySelector('.cu-bar-fill') : null;
      }
      runtime.nodes.push(ref);
    });
    root.style.display = 'block';
    document.body.classList.add('custom-ui-active');
    this.update();
  },
  refresh: function () {
    if (this.active && runtime.layout) {
      var s = JSON.parse(JSON.stringify(runtime.layout));
      this.apply(s, window.__uieAssetsLive);
    }
  },
  update: function (p) {
    if (!this.active || !runtime.nodes) return;
    p = p || window.playerRef;
    if (!p) return;
    var cw = p.width, ch = p.height;
    var sx = cw / DW, sy = ch / DH, k = Math.min(sx, sy);
    var rawScore = p.computeScore ? p.computeScore() : 0;
    if (!isFinite(rawScore)) rawScore = 0;
    var scoreV = String(Math.min(1000000, Math.max(0, Math.round(rawScore)))).padStart(7, '0');
    var vals = {
      score: scoreV,
      combo: p.combo >= 3 ? String(p.combo) : '',
      maxcombo: String(p.maxCombo || 0),
      good: String((p.counts && p.counts[1]) || 0),
      perfect: String((p.counts && p.counts[0]) || 0),
      hitlabel: String(((p.counts && (p.counts[0] + p.counts[1] + p.counts[2] + p.counts[3])) || 0)),
      title: (p.chart && p.chart.META && p.chart.META.name) || 'Unknown',
      difficulty: (p.chart && p.chart.META && p.chart.META.level !== undefined && p.chart.META.level !== null && p.chart.META.level !== '') ? String(p.chart.META.level) : '-'
    };
    var _tn = p.totalNotes || 0, _pc = (p.counts && p.counts[0]) || 0;
    var _miss = ((p.counts && p.counts[2]) || 0) + ((p.counts && p.counts[3]) || 0);
    vals.comboLabel = (p.autoplay ? 'AUTOPLAY' : 'COMBO');
    var totalSec = p.totalSeconds || 1;
    vals.progress = Math.min(1, Math.max(0, p.getCurrentTime() / totalSec));
    runtime.nodes.forEach(function (rn) {
      var el = rn.el, n = rn.node;
      var t = SLOT_MAP[el.type] && p.uiTransforms ? p.uiTransforms[SLOT_MAP[el.type]] : null;
      // Same semantics as the default HUD: follow while a position event is active, freeze at the last position when it ends; rotation / scale / opacity / color stay in sync
      var ap = anchorXY(el, cw, ch, Math.min(sx, sy));
      var bx = ap.x, by = ap.y;
      if (t && t.isPosActive) { rn.hold = { x: bx + (t.dx || 0), y: by + (t.dy || 0) }; }
      var pos = rn.hold || { x: bx, y: by };
      n.style.left = pos.x + 'px';
      n.style.top = pos.y + 'px';
      var btf = '';
      if (t) {
        if (t.rotation) btf += ' rotate(' + t.rotation + 'deg)';
        if (t.scaleX !== undefined && (t.scaleX !== 1 || t.scaleY !== 1)) btf += ' scale(' + t.scaleX + ', ' + t.scaleY + ')';
        n.style.opacity = t.alpha !== undefined ? t.alpha : '';
        if (el.type !== 'bar') n.style.color = t.color ? 'rgb(' + t.color[0] + ',' + t.color[1] + ',' + t.color[2] + ')' : '';
      }
      n.style.transform = btf;
      if (el.type === 'bar') {
        if (rn.fill) rn.fill.style.width = (vals.progress * 100) + '%';
      } else if (el.type === 'combo') {
        var showC = p.combo >= 3;
        n.style.visibility = showC ? '' : 'hidden';
        if (showC) {
          var innerC = rn.node.firstChild;
          var t1 = valueOf(el, vals);
          if (innerC.firstChild && innerC.firstChild.textContent !== t1) innerC.firstChild.textContent = t1;
          if (innerC.lastChild && innerC.lastChild.textContent !== vals.comboLabel) innerC.lastChild.textContent = vals.comboLabel;
          rn.stretch = comboStretch(el, innerC, k);
          innerC.style.transformOrigin = (el.align === 'left' ? '0' : el.align === 'right' ? '100%' : '50%') + ' 0';
          innerC.style.transform = rn.stretch;
        }
      } else if (rn.inner) {
        var txt = valueOf(el, vals);
        if (rn.inner.textContent !== txt) rn.inner.textContent = txt;
      }
    });
  }
};
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
  if (window.CustomUI.active) window.CustomUI.refresh();
  var ed = $('ui-editor'); if (ed && ed.classList.contains('open')) renderElements();
});
window.UIE_DEBUG={elements:function(){return elements},assets:function(){return assets},open:openEditor,close:closeEditor,save:actSave,export:actExport,import:actImport,reset:actReset,select:selectEl,defaultLayout:defaultLayout,pvw:function(){return pvw},pscale:function(){return pscale},stageScale:function(){return stageScale},grid:function(){return grid},setGridSnap:function(v){grid.snap=!!v},anchorXY:function(el,cw,ch,k){return anchorXY(el,cw,ch,k)},DW:function(){return DW},DH:function(){return DH}};
// ===== Initialization =====
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUIE);
else initUIE();
window.addEventListener('load', function () {
  try {
    var saved = localStorage.getItem('pez-custom-ui-v3');
    if (saved) window.CustomUI.apply(JSON.parse(saved));
  } catch (e) {}
});
})();

