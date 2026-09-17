// PhiAI-Player || js/player/lyrics.js
// EnhancedRPEPlayer instance methods (_renderLyricLine, _updateLyricChars, _lyricLineStart, updateLyric) attached to the prototype.
Object.assign(EnhancedRPEPlayer.prototype, {
  _renderLyricLine(el, line, ct) {
  el.textContent = '';
  el._lyricChars = null;
  if (line.charTimes && line.charTimes.length === line.text.length) {
    const chars = [];
    for (let i = 0; i < line.text.length; i++) {
      const s = document.createElement('span');
      s.className = 'lyric-char';
      s.textContent = line.text[i];
      el.appendChild(s);
      chars.push(s);
    }
    el._lyricChars = chars;
    this._updateLyricChars(el, line, ct);
  } else {
    el.textContent = line.text;
  }
},
_updateLyricChars(el, line, ct) {
  const chars = el._lyricChars;
  if (!chars || !line.charTimes) return;
  let on = 0;
  for (let i = 0; i < line.charTimes.length; i++) if (line.charTimes[i] <= ct) on = i + 1;
  for (let i = 0; i < chars.length; i++) chars[i].classList.toggle('on', i < on);
},
_lyricLineStart(lines, i) {
  if (i <= 0) return lines[i].time;
  const prev = lines[i - 1];
  const pt = (prev.endT != null) ? prev.endT : ((prev.charTimes && prev.charTimes.length === prev.text.length) ? prev.charTimes[prev.charTimes.length - 1] : prev.time);
  return Math.max(lines[i].time, pt + 0.5);
},
updateLyric(ct) {
  const lines = this.lyricLines;
  if (!lines || !lines.length) return;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (this._lyricLineStart(lines, i) <= ct) idx = i;
  const slots = this._lyricSlots || (this._lyricSlots = [document.getElementById('lyric-a'), document.getElementById('lyric-b')]);
  if (!slots[0] || !slots[1]) { this._lyricIdx = idx; return; }
  const prev = this._lyricSlot;
  // Word-by-word advance: update the lit characters of the current line every frame from ct (without interrupting line switches)
  if (prev && prev._lyricChars && idx === this._lyricIdx && !prev._lyricOut) {
    this._updateLyricChars(prev, lines[idx], ct);
  }
  // 0.5s before the next line: slide the current line up and fade it out early (based on the 'line may start' time so the tail is fully read);
  // if the next line is far away (or this is the last line), fade the line out once it is 'read' instead of leaving it hanging
  const lineEnd = (i) => {
    if (i < 0 || !lines[i]) return Infinity;
    const ln = lines[i];
    if (ln.endT != null) return ln.endT;
    if (ln.charTimes && ln.charTimes.length === ln.text.length) return ln.charTimes[ln.charTimes.length - 1] + 0.5;
    return ln.time + 3;
  };
  const nextTime = idx >= 0 ? (idx + 1 < lines.length ? Math.min(this._lyricLineStart(lines, idx + 1), lineEnd(idx)) : lineEnd(idx)) : Infinity;
  const scheduleClean = (el) => {
    clearTimeout(this._lyricT);
    this._lyricT = setTimeout(() => { el.classList.remove('lyric-out'); el._lyricOut = false; el.textContent = ''; el._lyricChars = null; }, 1000);
  };
  if (prev && !prev._lyricOut && nextTime - ct <= 0.5) {
    prev.classList.remove('lyric-in');
    prev.classList.add('lyric-out');
    prev._lyricOut = true;
    scheduleClean(prev);
  }
  if (idx === this._lyricIdx) return;
  if (prev && !prev._lyricOut) {
    prev.classList.remove('lyric-in');
    prev.classList.add('lyric-out');
    prev._lyricOut = true;
    scheduleClean(prev);
  }
  if (idx >= 0) {
    const cur = (prev === slots[0]) ? slots[1] : slots[0];
    this._renderLyricLine(cur, lines[idx], ct);
    void cur.offsetWidth;
    cur.classList.add('lyric-in');
    cur._lyricOut = false;
    this._lyricSlot = cur;
  } else {
    this._lyricSlot = null;
  }
  this._lyricIdx = idx;
}
});
