// PhiAI-Player || TTML lyric parser
function parseTTMLLyrics(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const lm = /^\[(\d{1,8}),\d{1,8}\](.*)$/.exec(line);
    if (!lm) continue;
    let chars = '';
    const charTimes = [];
    const rg = /\((\d{1,8}),\d{1,8},0\)([^(]*)/g;
    let m;
    while ((m = rg.exec(lm[2])) !== null) {
      const t = (+m[1]) / 1000;
      for (const ch of m[2]) { chars += ch; charTimes.push(t); }
    }
    let st = 0;
    while (st < chars.length && /\s/.test(chars[st])) st++;
    let en = chars.length;
    while (en > st && /\s/.test(chars[en - 1])) en--;
    const s = chars.slice(st, en);
    if (!s) continue;
    out.push({ time: (+lm[1]) / 1000, text: s, charTimes: charTimes.slice(st, en) });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

