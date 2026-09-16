// AIRE-Player | js/player/audio.js
// EnhancedRPEPlayer instance methods (setupAudio, setupBackground, waitBackground, ensureAudioAnalyser, playSound, flushSfx, _ensureSfxChain, _spawnSfx) attached to the prototype.
Object.assign(EnhancedRPEPlayer.prototype, {
  setupAudio(blob) {
  if (this.audio) { this.audio.pause(); URL.revokeObjectURL(this.audio.src); }
  // A new audio element is created for every chart switch, so the analyser node is rebuilt with it (createMediaElementSource can only be called once per element)
  this._bgMediaSrc = null;
  this._bgAnalyser = null;
  this._fluidFreq = null;
  this._fluidDead = false; // A fresh audio element may try to build the analyser source again
  this.audio = new Audio();
  this.audio.src = URL.createObjectURL(blob);
  this.audio.muted = this.muted;
  this.audio.volume = this.settings.musicVolume;
  this.audio.playbackRate = this.settings.playSpeed;
  this.audio.addEventListener('ended', () => {
    const ct = this.getCurrentTime();
    if (ct >= this.totalSeconds - 0.5) {
      this.isPlaying = false;
    } else {
      this.fallbackMode = true;
      this.fallbackTime = ct;
    }
  });
  this.audio.addEventListener('loadedmetadata', () => {
    if (this.audio.duration > 0) this.totalSeconds = Math.max(this.totalSeconds || 0, this.audio.duration);
  });
},
setupBackground(blob) {
  if (this.backgroundImage) URL.revokeObjectURL(this.backgroundImage.src);
  if (this.blurredBg) URL.revokeObjectURL(this.blurredBg.src);
  this.backgroundImage = null;
  this.blurredBg = null;
  // Offline blur: downscale the source image to <=512px and blur it once at load time; do not enter the play screen before it finishes
  this.bgReady = new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      // Pre-decode the full-size source before doing palette/blur work, so neither the
      // loading screen nor the first playback frame pays a synchronous main-thread decode.
      try { await img.decode(); } catch (e) {}
      this.backgroundImage = img;
      // Fluid background palette: extract the dominant colors from the background image (fall back to the default palette on failure)
      try { this.bgPalette = extractBgPalette(img); } catch (e) { this.bgPalette = null; }
      try {
        const offscreen = document.createElement('canvas');
        const maxW = 512, maxH = 512;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        offscreen.width = Math.max(1, Math.round(img.width * ratio));
        offscreen.height = Math.max(1, Math.round(img.height * ratio));
        const octx = offscreen.getContext('2d');
        // Leave a blur margin on all sides (edge pixels would otherwise have no neighbours and the convolution would expose an unblurred border), then crop back to the original size
        const pad = 64;
        const bloom = document.createElement('canvas');
        bloom.width = offscreen.width + pad * 2;
        bloom.height = offscreen.height + pad * 2;
        const bctx = bloom.getContext('2d');
        bctx.drawImage(img, 0, 0, bloom.width, bloom.height);
        bctx.filter = 'blur(16px)';
        bctx.drawImage(bloom, 0, 0);
        octx.drawImage(bloom, pad, pad, offscreen.width, offscreen.height, 0, 0, offscreen.width, offscreen.height);
        offscreen.toBlob((blurBlob) => {
          if (blurBlob) {
            const b = new Image();
            b.onload = async () => { try { await b.decode(); } catch (e) {} this.blurredBg = b; resolve(); };
            b.onerror = () => resolve();
            b.src = URL.createObjectURL(blurBlob);
          } else {
            resolve();
          }
        }, 'image/jpeg', 0.85);
      } catch (err) {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = URL.createObjectURL(blob);
  });
  return this.bgReady;
},
async waitBackground(timeoutMs = 3000) {
  if (!this.bgReady) return;
  const done = new Promise((res) => setTimeout(res, timeoutMs));
  await Promise.race([this.bgReady, done]);
},
ensureAudioAnalyser() {
  if (this._fluidDead) return null;
  if (this._bgAnalyser) return this._bgAnalyser;
  if (!this.audio || !this.audio.src) return null;
  try {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
    if (!this._bgMediaSrc) this._bgMediaSrc = this.audioCtx.createMediaElementSource(this.audio);
    const an = this.audioCtx.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.6;
    this._bgMediaSrc.connect(an);
    an.connect(this.audioCtx.destination);
    this._bgAnalyser = an;
    this._fluidFreq = new Uint8Array(an.frequencyBinCount);
  } catch (e) { this._fluidDead = true; return null; }
  return this._bgAnalyser;
},
playSound(type, vol) {
  if (this.muted || !this.audioCtx) return;
  if (this.audioCtx.state === 'suspended') {
    this.audioCtx.resume().catch(e => console.warn('AudioContext resume failed', e));
  }
  const buf = this.audioBuffers[type];
  if (!buf) return;
  // SFX layer: enqueue only (a cheap array push, without any Web Audio call).
  // vol is the sample volume 0-100 (default 100), normalized to 0-1 here and consumed by _spawnSfx once dequeued
  this._sfxQueue.push(type, (vol != null) ? Math.max(0, Math.min(100, vol)) / 100 : 1);
  // Inside the per-note loop only enqueue; flushSfx() plays the batch at the end of the frame. Outside the loop (UI / manual input) play immediately for low latency
  if (!this._sfxInNoteLoop) this.flushSfx();
},
flushSfx() {
  const q = this._sfxQueue;
  if (!q.length) return;
  const ctx = this.audioCtx;
  if (!ctx) { q.length = 0; return; }
  const pending = q.length >> 1;
  const n = Math.min(pending, this._sfxMaxPerFlush);
  // Phigros-style burst handling: when many hits land in the same frame, duck each voice by ~1/sqrt(count)
  // so simultaneous chords hold a stable loudness instead of summing into a blow-out ("炸音"). A single
  // note (n<=1) is untouched; >=12 voices are capped so an extreme burst can never duck to inaudibility.
  this._burstGain = (this.settings.sfxLimit && n > 1) ? (1 / Math.sqrt(Math.min(n, 12))) : 1;
  if (pending > this._sfxMaxPerFlush && !this._sfxDroppedWarned) {
    this._sfxDroppedWarned = true;
    console.warn('[SfxLayer] 单帧音效 ' + pending + ' 条超过上限 ' + this._sfxMaxPerFlush + ',已丢弃多余音效(防止卡死)');
  }
  // Always use the audio time captured at flush, so sounds within the same frame carry no accumulated jitter
  const t0 = ctx.currentTime;
  for (let i = 0; i < n * 2; i += 2) this._spawnSfx(q[i], q[i + 1], t0);
  q.length = 0;
},
_ensureSfxChain(ctx) {
  if (this._sfxLimiter || !ctx) return null;
  try {
    const bus = ctx.createGain();
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6;
    lim.knee.value = 3;
    lim.ratio.value = 12;
    lim.attack.value = 0.002;
    lim.release.value = 0.2;
    bus.connect(lim);
    lim.connect(ctx.destination);
    this._sfxBus = bus;
    this._sfxLimiter = lim;
  } catch (e) { /* Chain unavailable; leave null so _spawnSfx falls back to direct playback */ }
  return this._sfxBus;
},
_spawnSfx(type, v, t0) {
  const ctx = this.audioCtx;
  const buf = this.audioBuffers[type];
  if (!ctx || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // GainNodes are reused from the recycle pool to cut createGain/connect overhead
  const gain = this._sfxGainPool.length ? this._sfxGainPool.pop() : ctx.createGain();
  let g = this.settings.sfxVolume * 0.8 * v;
  // Apply the per-flush burst normalization computed in flushSfx() when this voice was enqueued
  if (this._burstGain !== 1) g *= this._burstGain;
  gain.gain.value = g;
  src.connect(gain);
  if (this.settings.sfxLimit) {
    this._ensureSfxChain(ctx);
    // Everything goes through the limiter bus; if the chain is somehow unavailable, fall back to the
    // recording bus / destination exactly as before
    gain.connect(this._sfxBus || this._recSfxBus || ctx.destination);
  } else {
    gain.connect(this._recSfxBus || ctx.destination);
  }
  src.onended = () => {
    try { src.disconnect(); gain.disconnect(); } catch (e) { /* Disconnected */ }
    if (this._sfxGainPool.length < 64) this._sfxGainPool.push(gain);
  };
  src.start(t0);
}
});
