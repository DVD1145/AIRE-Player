// AIRE-Player | js/player/background.js
// EnhancedRPEPlayer instance methods (renderFluidBackground, cleanupBGA, setupBGA, updateBGA) attached to the prototype.
Object.assign(EnhancedRPEPlayer.prototype, {
  renderFluidBackground(ctx, w, h) {
  const t = performance.now() / 1000;
  // Mode 2: the average low/mid band energy drives brightness and size (smoothed)
  let energy = 0.45;
  if (this.dynamicBackground === 2) {
    const an = this.ensureAudioAnalyser();
    if (an && this._fluidFreq) {
      an.getByteFrequencyData(this._fluidFreq);
      let s = 0;
      const bins = Math.min(48, this._fluidFreq.length);
      for (let i = 0; i < bins; i++) s += this._fluidFreq[i];
      const e = s / bins / 255;
      this._fluidEnergy = this._fluidEnergy === undefined ? e : this._fluidEnergy * 0.82 + e * 0.18;
    }
    energy = Math.max(0.22, (this._fluidEnergy === undefined ? 0.45 : this._fluidEnergy) * 1.15);
  }
  const fw = 160, fh = 90;
  if (!this._fluidCanvas) {
    this._fluidCanvas = document.createElement('canvas');
    this._fluidCanvas.width = fw;
    this._fluidCanvas.height = fh;
    this._fluidCtx = this._fluidCanvas.getContext('2d');
  }
  const fc = this._fluidCtx;
  const pal = this.bgPalette && this.bgPalette.length ? this.bgPalette : ['#5e5ce6', '#0a84ff', '#bf5af2', '#ff375f'];
  fc.globalCompositeOperation = 'source-over';
  fc.fillStyle = '#060609';
  fc.fillRect(0, 0, fw, fh);
  fc.globalCompositeOperation = 'lighter';
  if (!this._fluidBlobs) {
    this._fluidBlobs = Array.from({ length: 5 }, (_, i) => ({
      ax: 30 + (i % 3) * 18, ay: 22 + ((i + 1) % 3) * 14,
      fx: 0.11 + i * 0.037, fy: 0.13 + ((i * 5) % 7) * 0.021,
      px: i * 1.7, py: i * 2.9,
      r: 46 + (i % 4) * 13,
      color: pal[i % pal.length],
    }));
  }
  const baseA = this.dynamicBackground === 2 ? 0.30 + 0.5 * energy : 0.55;
  const rBoost = this.dynamicBackground === 2 ? 1 + 0.28 * energy : 1;
  for (const b of this._fluidBlobs) {
    const x = fw / 2 + Math.sin(t * b.fx + b.px) * b.ax + Math.sin(t * b.fy * 1.7 + b.py) * b.ax * 0.4;
    const y = fh / 2 + Math.cos(t * b.fy + b.py) * b.ay + Math.cos(t * b.fx * 1.5 + b.px) * b.ay * 0.4;
    const r = b.r * rBoost * (1 + 0.12 * Math.sin(t * 0.7 + b.px));
    const g = fc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, b.color + Math.round(baseA * 255).toString(16).padStart(2, '0'));
    g.addColorStop(1, b.color + '00');
    fc.fillStyle = g;
    fc.beginPath();
    fc.arc(x, y, r, 0, Math.PI * 2);
    fc.fill();
  }
  // Cover fit (same as the background image: keep the aspect ratio, center and crop the overflow)
  const s = Math.max(w / fw, h / fh);
  ctx.drawImage(this._fluidCanvas, (w - fw * s) / 2, (h - fh * s) / 2, fw * s, fh * s);
},
cleanupBGA() {
  for (const b of this.bgaVideos) {
    if (b.video) { b.video.pause(); b.video.removeAttribute('src'); b.video.load(); if (b.video.parentNode) b.video.parentNode.removeChild(b.video); }
    if (b.url) URL.revokeObjectURL(b.url);
  }
  this.bgaVideos = [];
  this._bgaCurrent = null;
},
async setupBGA(videoDescs) {
  this.cleanupBGA();
  if (!Array.isArray(videoDescs) || !videoDescs.length || !this.chartFiles) {
    console.warn('[BGA] extra.json 中无 videos 字段,或未用文件夹/压缩包方式加载(单文件加载不支持 BGA)');
    return;
  }
  const grab = async (name) => {
    if (!name) return null;
    const key = name.replace(/\\/g, '/').toLowerCase();
    const base = key.split('/').pop();
    let f = this.chartFiles && (this.chartFiles.get(key) || this.chartFiles.get(base));
    // When chartFiles is not set on the PEZ path, fall back to looking the file up inside the zip
    if (!f && this.pezZip) {
      const entry = Object.values(this.pezZip.files).find(e => { if (e.dir) return false; const fn = e.name.replace(/\\/g, '/').toLowerCase(); return fn === key || fn === base || fn.split('/').pop() === base; });
      if (entry) {
        const blob = await entry.async('blob');
        blob.name = base;
        f = blob;
      }
    }
    return f;
  };
  const bpmList = (this.chart && this.chart.BPMList) || [];
  for (const d of videoDescs) {
    if (!d || !d.path) continue;
    const f = await grab(d.path);
    if (!f) continue;
    try {
      const url = URL.createObjectURL(f);
      const v = document.createElement('video');
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.preload = this.bgaVideos.length ? 'metadata' : 'auto';
      v.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;';
      if (document.body) document.body.appendChild(v);
      this.bgaVideos.push({
        video: v, url, path: d.path,
        startSec: beatToSeconds(bpmList, tripleToBeat(d.time || [0, 0, 1])),
        scale: (d.scale === 'inside' || d.scale === 'fit') ? d.scale : 'cropCenter',
        alpha: (typeof d.alpha === 'number' && d.alpha >= 0 && d.alpha <= 1) ? d.alpha : 1,
        dim: (typeof d.dim === 'number' && d.dim >= 0 && d.dim <= 1) ? d.dim : 0.3,
      });
    } catch (e) { /* A single failing video must not affect the others */ }
  }
  this.bgaVideos.sort((a, b) => a.startSec - b.startSec);
  this.updateFileStatus('BGA 视频', this.bgaVideos.length > 0, this.bgaVideos.length ? this.bgaVideos.map(b => b.path + '@' + b.startSec.toFixed(1) + 's').join('; ') : '未绑定到 extra.json 中的视频文件');
  console.log('[BGA] 已绑定 ' + this.bgaVideos.length + ' 个视频:', this.bgaVideos.map(b => b.path + ' → ' + b.startSec.toFixed(1) + 's').join(', '));
},
updateBGA(ct) {
  let cur = null;
  for (const b of this.bgaVideos) {
    if (ct >= b.startSec) cur = b; else break;
  }
  this._bgaCurrent = cur;
  // Keep only the current video decoding and pause the rest (several high-bitrate videos decoding at once can crash the GPU)
  for (const b of this.bgaVideos) {
    if (b !== cur && !b.video.paused) b.video.pause();
  }
  if (!cur) return;
  const v = cur.video;
  if (v.preload !== 'auto') v.preload = 'auto';
  if (this.holdTime || this.isPaused || !this.isPlaying) {
    if (!v.paused) v.pause();
    return;
  }
  if (v.readyState < 2) return;
  const expected = Math.max(0, ct - cur.startSec);
  if (Math.abs(v.currentTime - expected) > 0.25 || (v.ended && expected < (v.duration || Infinity))) {
    try { v.currentTime = expected; } catch (e) { /* Seeking before ready may throw */ }
  }
  if (v.paused || v.ended) v.play().catch(() => {});
}
});
