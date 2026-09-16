// AIRE-Player | js/player/fx.js
// EnhancedRPEPlayer instance methods (parseEffects, initFX, compileFXProgram, ensureFXProgram, buildFXFBOs, lerpFXValue, evalFXVar, updateFX, _setFxGlobalZ, _composeFxUiSrc, renderFX, hideFX) attached to the prototype.
Object.assign(EnhancedRPEPlayer.prototype, {
  parseEffects() {
  this.fxEffects = [];
  const list = this._fxExtraEffects || [];
  for (const ef of list) {
    if (!ef || typeof ef.shader !== 'string' || !ef.shader) continue;
    let src = null;
    if (ef.shader.startsWith('/')) src = this._fxCustomShaders[ef.shader] || null;
    else src = BUILTIN_SHADERS[ef.shader] || null;
    if (!src) { console.warn('[FX] 着色器未找到: ' + ef.shader); continue; }
    this.fxEffects.push({
      shader: ef.shader,
      src: src,
      startBeat: tripleToBeat(ef.start || [0, 0, 1]),
      endBeat: tripleToBeat(ef.end || [0, 0, 1]),
      vars: (ef.vars && typeof ef.vars === 'object') ? ef.vars : {},
      global: !!ef.global, // Whether the UI (combo number / pause button etc.) is shaded as well (effect.global)
    });
  }
},
initFX() {
  if (this._fxGlInit) return this.fxGl;
  this._fxGlInit = true;
  const canvas = this.fxCanvas;
  if (!canvas) return null;
  const opts = { preserveDrawingBuffer: false, alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) { console.warn('[FX] WebGL 不可用,特效将被跳过'); return null; }
  this.fxGl = gl;
  this._fxPrograms = this._fxPrograms || {};
  this._fxGlLost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    this._fxGlLost = true;
    this._fxPrograms = null;
    this._fxFBOs = null;
    this._fxSrcTex = null;
    this.hideFX();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    this._fxGlLost = false;
    this._fxPrograms = null;
    this._fxFBOs = null;
    this._fxSrcTex = null;
    this._fxSrcTexW = 0;
    this._fxSrcTexH = 0;
    this._fxScale = 1;
  });
  const vs = gl.createShader(gl.VERTEX_SHADER);
  // Canvas upload texture: t = 0 = the canvas top row = the screen top -> the screen top (NDC +1) samples uv.y = 0
  gl.shaderSource(vs, 'attribute vec2 aPos; varying vec2 uv; void main(){ uv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }');
  gl.compileShader(vs);
  this._fxVertex = vs;
  // FBO texture: the GL viewport origin is bottom-left, so row t = 0 = the screen bottom -> the screen top (NDC +1) samples uv.y = 1;
  // chained intermediate effects consume FBO textures; reusing the canvas vertex shader would flip them once per pass (parity decides the final orientation)
  const vsFbo = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsFbo, 'attribute vec2 aPos; varying vec2 uv; void main(){ uv = vec2(aPos.x * 0.5 + 0.5, 0.5 + aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }');
  gl.compileShader(vsFbo);
  this._fxVertexFbo = vsFbo;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  this._fxQuadBuf = buf;
  return gl;
},
compileFXProgram(src, useFboVs) {
  const gl = this.fxGl;
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  let code = String(src || '').replace(/^\uFEFF/, '');
  code = code.replace(/^\s*#version\s+100\s*[\r\n]+/m, '');
  // The reference implementation puts the fragment coordinate origin at the top-left, while WebGL's gl_FragCoord origin is bottom-left, so shaders computing uv themselves must flip y to stay consistent.
  // Flip only for canvas upload textures (stored top-left); for FBO textures (stored bottom-left, t = 0 = screen bottom) keep the native bottom-left semantics
  if (!useFboVs) {
    code = code.replace(/gl_FragCoord\.y\s*\/\s*screenSize\.y/g, '(screenSize.y - gl_FragCoord.y) / screenSize.y');
    code = code.replace(/gl_FragCoord\.xy\s*\/\s*screenSize\b/g, 'vec2(gl_FragCoord.x, screenSize.y - gl_FragCoord.y) / screenSize');
  }
  if (!/\bprecision\s+(lowp|mediump|highp)\s+float\s*;/.test(code)) {
    code = 'precision mediump float;\n' + code;
  }
  gl.shaderSource(fs, code);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.warn('[FX] 着色器编译失败: ' + gl.getShaderInfoLog(fs));
    return null;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, useFboVs ? this._fxVertexFbo : this._fxVertex);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[FX] 着色器链接失败: ' + gl.getProgramInfoLog(prog));
    return null;
  }
  const vars = {};
  const defaults = {};
  const re = /uniform\s+(float|vec2|vec3|vec4)\s+(\w+)\s*;(?:[^\n]*?\/\/\s*%\s*([^%\r\n]+?)\s*%)?/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[2] === 'screenTexture' || m[2] === 'time' || m[2] === 'screenSize' || m[2] === 'uScale') continue;
    vars[m[2]] = { type: m[1], loc: gl.getUniformLocation(prog, m[2]) };
    if (m[3]) {
      const vals = m[3].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
      if (vals.length) defaults[m[2]] = { type: m[1], loc: vars[m[2]].loc, vals: vals };
    }
  }
  return {
    prog: prog,
    time: gl.getUniformLocation(prog, 'time'),
    screenSize: gl.getUniformLocation(prog, 'screenSize'),
    screenTexture: gl.getUniformLocation(prog, 'screenTexture'),
    uScale: gl.getUniformLocation(prog, 'uScale'),
    vars: vars,
    defaults: defaults,
  };
},
ensureFXProgram(name, useFboVs) {
  this._fxPrograms = this._fxPrograms || {};
  const key = useFboVs ? name + '#fbo' : name;
  if (this._fxPrograms[key]) return this._fxPrograms[key];
  const eff = this.fxEffects.find(e => e.shader === name);
  if (!eff) return null;
  const p = this.compileFXProgram(eff.src, useFboVs);
  if (p) this._fxPrograms[key] = p;
  else this._fxPrograms[key] = null;
  return p;
},
buildFXFBOs(w, h) {
  const gl = this.fxGl;
  if (this._fxFBOs && this._fxFBOs.w === w && this._fxFBOs.h === h) return this._fxFBOs;
  if (this._fxFBOs) {
    for (const fb of this._fxFBOs.fbos) { gl.deleteFramebuffer(fb.fb); gl.deleteTexture(fb.tex); }
  }
  const make = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb };
  };
  this._fxFBOs = { w: w, h: h, fbos: [make(), make()] };
  return this._fxFBOs;
},
lerpFXValue(a, b, k) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((x, i) => x + (b[i] !== undefined ? (b[i] - x) * k : 0));
  }
  return a + (b - a) * k;
},
evalFXVar(spec, tSec) {
  if (typeof spec === 'number') return spec;
  if (!Array.isArray(spec) || !spec.length) return null;
  // An RPE four-element numeric array is a color [r, g, b, a] (components 0-255), corresponding to Variable::Color divided by 255.
  // Otherwise vec4 components > 1 are clamped to pure white at fragment output (e.g. the colored edge of a vignette turns white)
  if (typeof spec[0] === 'number') return spec.length >= 4 ? spec.map(x => x / 255) : spec;
  // Multiple animation events are sorted by time; while iterating, if the current moment falls inside an event, return its interpolation,
  // otherwise record the tail value of the 'most recently ended event' -- gaps between events and everything after the last event keep that value,
  // instead of wrongly returning the tail value of the 'last event' (which would zero out the effect parameters during gaps and make it 'disappear')
  const norm = (v) => Array.isArray(v) && v.length >= 4 ? v.map(x => x / 255) : v;
  let lastEnd = null, lastE = -Infinity;
  for (const ev of spec) {
    if (!ev || ev.startTime === undefined) continue;
    const sb = tripleToBeat(ev.startTime || [0, 0, 1]);
    const eb = tripleToBeat(ev.endTime || ev.startTime || [0, 0, 1]);
    const s = bpmListToSeconds(this.bpmList, sb, 1);
    const e = bpmListToSeconds(this.bpmList, eb, 1);
    if (tSec >= s && tSec <= e) {
      const k = e > s ? Math.min(1, Math.max(0, (tSec - s) / (e - s))) : 1;
      const fn = Easing[Math.max(1, ev.easingType || 1)] || Easing[1];
      return norm(this.lerpFXValue(ev.start, ev.end, fn(k)));
    }
    if (tSec > e && e > lastE) { lastE = e; lastEnd = ev.end; }
  }
  if (lastEnd !== null) return norm(lastEnd);
  return null;
},
updateFX(cb, tSec, dtSec) {
  // Orientation diagnostic: with #fxdiag, force an overlay of red on top and blue at the bottom (uv.y < 0.5 = upper half = red, uv.y = 0 is the screen top)
  if ((location.hash || '').indexOf('fxdiag') !== -1 && !this.fxEffects.find(e => e.shader === '__diag')) {
    this.fxEffects.push({ shader: '__diag', src: BUILTIN_SHADERS['__diag'], startBeat: 0, endBeat: 1e9, vars: {} });
  }
  if (!this.fxEffects.length) { this._fxDtEma = 0; this.hideFX(); return; }
  const chain = [];
  for (const eff of this.fxEffects) {
    if (cb >= eff.startBeat && cb <= eff.endBeat) chain.push(eff);
  }
  this._fxChain = chain;
  if (!chain.length) { this._fxDtEma = 0; this.hideFX(); return; }
  // A global effect shades the UI too: the play UI is rasterized into the shader input, and the opaque effect output
  // is raised above the DOM play UI for the effect's duration so the shaded copies are what the viewer sees.
  this._fxGlobal = chain.some(eff => !!eff.global);
  this._setFxGlobalZ(this._fxGlobal);
  this.renderFX(tSec, dtSec);
},
_setFxGlobalZ(on) {
  if (!this.fxCanvas) return;
  if (on) {
    if (this._fxGlobalZ === null) this._fxGlobalZ = this.fxCanvas.style.zIndex || '';
    this.fxCanvas.style.zIndex = '600';
  } else if (this._fxGlobalZ !== null) {
    this.fxCanvas.style.zIndex = this._fxGlobalZ;
    this._fxGlobalZ = null;
  }
},
_composeFxUiSrc() {
  const w = this.canvas.width, h = this.canvas.height;
  if (w < 2 || h < 2) return this.canvas;
  if (!this._fxGlobalCv) this._fxGlobalCv = document.createElement('canvas');
  const cv = this._fxGlobalCv;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(this.canvas, 0, 0);
  const saved = {
    canvas: this.canvas, ctx: this.ctx, width: this.width, height: this.height, _recHudS: this._recHudS,
  };
  this.canvas = cv; this.ctx = ctx; this.width = w; this.height = h; this._recHudS = this._dpr || 1;
  try { this._drawRecHud(this.getCurrentTime(), { pauseBtn: true }); } catch (e) { /* a broken UI draw must never break the effect */ }
  this.canvas = saved.canvas; this.ctx = saved.ctx;
  this.width = saved.width; this.height = saved.height; this._recHudS = saved._recHudS;
  return cv;
},
renderFX(tSec, dtSec) {
  const gl = this.initFX();
  if (!gl) return;
  const steps = [];
  this._fxChain.forEach((eff, i) => {
    const p = this.ensureFXProgram(eff.shader, i > 0);
    if (p) steps.push({ eff: eff, p: p });
  });
  if (!steps.length) { this.hideFX(); return; }
  const w = this.canvas.width, h = this.canvas.height;
  if (w < 2 || h < 2) { this.hideFX(); return; }
  // Frame interval moving average (ms): CPU timing only reflects how long GL command submission takes, so a GPU bottleneck (effects stuttering on real devices)
  // must be captured through the real frame interval; intervals > 0.25s are ignored (tab switches / loading)
  if (dtSec > 0 && dtSec < 0.25) {
    const ms = dtSec * 1000;
    this._fxDtEma = this._fxDtEma ? (this._fxDtEma * 0.85 + ms * 0.15) : ms;
  }
  const t0 = performance.now();
  let scale = this._fxScale || 1;
  const lim = Math.min(1, (steps.length >= 5 ? 1080 : 1440) / Math.max(w, h));
  scale = Math.min(scale, lim);
  const w0 = Math.max(2, Math.round(w * scale)), h0 = Math.max(2, Math.round(h * scale));
  const fbos = this.buildFXFBOs(w0, h0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  if (!this._fxSrcTex) this._fxSrcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this._fxSrcTex);
  let src = this._fxGlobal ? this._composeFxUiSrc() : this.canvas;
  if (scale < 1 && !this._fxGlobal) {
    if (!this._fxDownCv) this._fxDownCv = document.createElement('canvas');
    if (this._fxDownCv.width !== w0 || this._fxDownCv.height !== h0) {
      this._fxDownCv.width = w0;
      this._fxDownCv.height = h0;
    }
    this._fxDownCv.getContext('2d').drawImage(src, 0, 0, w0, h0);
    src = this._fxDownCv;
  }
  // Update with texSubImage2D when the size is unchanged, avoiding a per-frame texImage2D reallocation
  if (this._fxSrcTexW !== src.width || this._fxSrcTexH !== src.height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this._fxSrcTexW = src.width;
    this._fxSrcTexH = src.height;
  }
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, src.width, src.height, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._fxQuadBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  let inTex = this._fxSrcTex;
  for (let i = 0; i < steps.length; i++) {
    const last = i === steps.length - 1;
    const fb = last ? null : fbos.fbos[i % 2].fb;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    // The final pass renders into the fx-canvas default framebuffer (full size), intermediate passes into FBOs (scaled size);
    // reusing w0/h0 would only fill the bottom-left corner when downsampling
    gl.viewport(0, 0, last ? w : w0, last ? h : h0);
    const d = steps[i].p;
    gl.useProgram(d.prog);
    if (d.time) gl.uniform1f(d.time, tSec);
    if (d.screenSize) gl.uniform2f(d.screenSize, w, h);
    if (d.screenTexture) gl.uniform1i(d.screenTexture, 0);
    if (d.uScale) gl.uniform1f(d.uScale, scale);
    const used = new Set();
    for (const [vname, vspec] of Object.entries(steps[i].eff.vars || {})) {
      const vu = d.vars[vname];
      if (!vu) continue;
      const v = this.evalFXVar(vspec, tSec);
      if (v === null || v === undefined) continue;
      used.add(vname);
      if (Array.isArray(v)) {
        if (vu.type === 'vec4' && v.length >= 4) gl.uniform4f(vu.loc, v[0], v[1], v[2], v[3]);
        else if (v.length >= 3) gl.uniform3f(vu.loc, v[0], v[1], v[2]);
        else if (v.length >= 2) gl.uniform2f(vu.loc, v[0], v[1]);
        else gl.uniform1f(vu.loc, v[0]);
      } else {
        gl.uniform1f(vu.loc, v);
      }
    }
    for (const [dname, ddef] of Object.entries(d.defaults || {})) {
      if (used.has(dname) || !ddef.loc) continue;
      if (ddef.type === 'float') gl.uniform1f(ddef.loc, ddef.vals[0]);
      else if (ddef.type === 'vec2' && ddef.vals.length >= 2) gl.uniform2f(ddef.loc, ddef.vals[0], ddef.vals[1]);
      else if (ddef.type === 'vec3' && ddef.vals.length >= 3) gl.uniform3f(ddef.loc, ddef.vals[0], ddef.vals[1], ddef.vals[2]);
      else if (ddef.type === 'vec4' && ddef.vals.length >= 4) gl.uniform4f(ddef.loc, ddef.vals[0], ddef.vals[1], ddef.vals[2], ddef.vals[3]);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    inTex = last ? null : fbos.fbos[i % 2].tex;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  this.fxCanvas.style.display = 'block';
  const cost = performance.now() - t0;
  const ema = this._fxDtEma || 0;
  // Downgrade: frame interval moving average > 20ms (~ below 50fps, which also reflects a GPU bottleneck) or CPU submission time > 25ms,
  // confirmed over 2 consecutive frames (filtering single-frame GC / compositor spikes); upgrade: frame interval < 14.5ms and CPU < 12ms for 90 consecutive frames (strong hysteresis prevents oscillation)
  if (ema > 20 || cost > 25) this._fxHot = (this._fxHot || 0) + 1;
  else this._fxHot = 0;
  if (this._fxHot >= 2 && scale > 0.25) {
    this._fxScale = Math.max(0.25, scale / 2);
    this._fxStable = 0;
    this._fxHot = 0;
  } else if (scale < 1) {
    this._fxStable = (this._fxStable || 0) + 1;
    if (ema > 0 && ema < 14.5 && cost < 12 && this._fxStable > 90) {
      this._fxScale = Math.min(1, scale * 2);
      this._fxStable = 0;
    }
  } else {
    this._fxStable = 0;
  }
},
hideFX() {
  this._fxGlobal = false;
  this._setFxGlobalZ(false);
  if (this.fxCanvas && this.fxCanvas.style.display !== 'none') this.fxCanvas.style.display = 'none';
}
});
