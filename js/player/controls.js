// AIRE-Player | js/player/controls.js
// EnhancedRPEPlayer instance methods (initKeyboardInput, keyboardHit, initPointerInput, noteHitRadius, findNoteForTap, handleTap) attached to the prototype.
Object.assign(EnhancedRPEPlayer.prototype, {
  initKeyboardInput() {
  if (this._keyboardInitialized) return;
  this._keyboardInitialized = true;
  document.addEventListener('keydown', (e) => {
    if (!this.keyboardPlay || this.autoplay) return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    const code = e.code;
    if (this.activeKeys.has(code)) return;
    this.activeKeys.set(code, true);
    this.keyDownCount++;
    this.keyboardHit(code);
  });
  document.addEventListener('keyup', (e) => {
    const code = e.code;
    if (!this.activeKeys.delete(code)) return;
    this.keyDownCount = Math.max(0, this.keyDownCount - 1);
  });
},
keyboardHit(code) {
  const ct = this.getCurrentTime();
  let best = null;
  for (const n of (this._noteStream ? this._streamWindow : this.notes)) {
    if (n.judged || n.missed || n.isFake) continue;
    if (n.type === 3 || n.type === 4) continue;
    if (n.type === 2 && (n.holdTriggered || n.holdStarted || n.holdActive)) continue;
    if (!best || n.startTimeSec < best.startTimeSec) best = n;
  }
  if (!best) return;
  const targetSec = best.startTimeSec + (this.offset || 0);
  const diff = ct - targetSec;
  const ja = best.judgeArea || 1;
  const limit = best.type === 2 ? this.LIMIT_GOOD : this.LIMIT_BAD;
  if (Math.abs(diff) > limit * ja) return;
  if (best.type === 2) {
    best.holdTriggered = true;
    best.holdActive = true;
    best.holdStarted = true;
    if (!this.playNoteSounds(best)) this.playSound(this.noteSoundKey(best));
    const [sX, sY] = this.judgeFXPos(best);
    this.addJudgeEffect(sX, sY, 'PERFECT', best.tint, this.judgeLines[best.lineIndex].rotation, best.tintHitEffects);
    return;
  }
  this.judgeNote(best, this.judgeNoteTime(diff, best));
},
initPointerInput() {
  if (this._pointerInitialized) return;
  this._pointerInitialized = true;
  const cv = this.canvas;
  const hitUI = (t) => {
    if (!t || !t.closest) return false;
    return !!t.closest('#settings-modal, #load-screen, #unlock-overlay, #settings-toggle');
  };
  cv.addEventListener('pointerdown', (e) => {
    if (this.autoplay || hitUI(e.target)) return;
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.activeFingers.set(e.pointerId, { x, y, startX: x, startY: y, swiped: false });
    this.handleTap(x, y, e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (this.autoplay) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const f = this.activeFingers.get(e.pointerId);
    if (!f) return;
    f.x = x;
    f.y = y;
    if (Math.hypot(x - f.startX, y - f.startY) >= this.flickSwipeThreshold) f.swiped = true;
  });
  window.addEventListener('pointerup', (e) => {
    this.activeFingers.delete(e.pointerId);
  });
  window.addEventListener('pointercancel', (e) => {
    this.activeFingers.delete(e.pointerId);
  });
},
noteHitRadius(note) {
  const sc = (this.scaleX || 1) * (this.noteScale || 4.35);
  const size = (note && (note.size || 1)) * (note.controlSize || 1);
  const rad = 18 * size * sc;
  return Math.max(40, rad * 1.5 + 30);
},
findNoteForTap(x, y) {
  const ct = this.getCurrentTime();
  let best = null;
  let bestScore = Infinity;
  for (const n of (this._noteStream ? this._streamWindow : this.notes)) {
    if (n.judged || n.missed || n.isFake) continue;
    if (n.type === 3 || n.type === 4) continue;
    const targetSec = n.startTimeSec + (this.offset || 0);
    const diff = ct - targetSec;
    const ja = n.judgeArea || 1;
    if (diff < -this.LIMIT_BAD * ja || diff > this.LIMIT_BAD * ja) continue;
    const hitW = this.noteHitRadius(n);
    if (x != null && Math.abs(n.screenX - x) > hitW) continue;
    const score = Math.abs(diff);
    if (score < bestScore) { bestScore = score; best = n; }
  }
  return best;
},
handleTap(x, y, pointerId) {
  const n = this.findNoteForTap(x, y);
  if (!n) return;
  if (n.type === 2) {
    n.holdTriggered = true;
    n.holdActive = true;
    n.holdStarted = true;
    if (!this.playNoteSounds(n)) this.playSound(this.noteSoundKey(n));
    const [tX, tY] = this.judgeFXPos(n);
    this.addJudgeEffect(tX, tY, 'PERFECT', n.tint, this.judgeLines[n.lineIndex].rotation, n.tintHitEffects);
    return;
  }
  if (n.type === 3 || n.type === 4) return;
  const targetSec = n.startTimeSec + (this.offset || 0);
  const diff = this.getCurrentTime() - targetSec;
  this.judgeNote(n, this.judgeNoteTime(diff, n));
}
});
