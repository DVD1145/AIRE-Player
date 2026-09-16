// AIRE-Player | .pez chart pack parser
class PEZParser {
  constructor() {
    this.zip = null; this.info = null; this.chart = null;
    this.audioBlob = null; this.imageBlob = null; this.extra = null;
    this.files = new Map();
  }
  async loadFromFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.zip = await JSZip.loadAsync(arrayBuffer);
      this.files.clear();
      for (const [name, obj] of Object.entries(this.zip.files)) {
        if (!obj.dir) this.files.set(name, { name, size: obj._data?.uncompressedLength || 0, loaded: false, error: false });
      }
      await this.parseInfo();
      await this.loadResources();
      return { success: true, info: this.info, chart: this.chart, audioBlob: this.audioBlob, imageBlob: this.imageBlob, extra: this.extra, yamlInfo: this.ymlInfo || null, files: Array.from(this.files.values()), zip: this.zip };
    } catch (error) { return { success: false, error: error.message }; }
  }
  async parseInfo() {
    const infoFile = this.zip.file('info.txt');
    if (!infoFile) throw new Error('PEZ 文件中未找到 info.txt');
    const text = await infoFile.async('string');
    this.info = {};
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const idx = s.indexOf(':');
      if (idx > 0) this.info[s.slice(0, idx).trim()] = s.slice(idx + 1).trim();
    }
    this.updateFileStatus('info.txt', true);
  }
  async loadResources() {
    if (this.info.Chart) {
      const f = this.zip.file(this.info.Chart);
      if (f) { this.chart = JSON.parse(await f.async('string')); this.updateFileStatus(this.info.Chart, true); }
      else this.updateFileStatus(this.info.Chart, false, '文件不存在');
    }
    if (this.info.Song) {
      const f = this.zip.file(this.info.Song);
      if (f) { this.audioBlob = await f.async('blob'); this.updateFileStatus(this.info.Song, true); }
      else this.updateFileStatus(this.info.Song, false, '文件不存在');
    }
    if (this.info.Picture) {
      const f = this.zip.file(this.info.Picture);
      if (f) { this.imageBlob = await f.async('blob'); this.updateFileStatus(this.info.Picture, true); }
      else this.updateFileStatus(this.info.Picture, false, '文件不存在');
    }
    const rootKey = (name) => name.replace(/\\/g, '/').split('/').pop();
    let extraFile = this.zip.file('extra.json');
    if (!extraFile && this.zip.files) {
      const ek = Object.keys(this.zip.files).find(k => !this.zip.files[k].dir && rootKey(k) === 'extra.json');
      if (ek) extraFile = this.zip.file(ek);
    }
    if (extraFile) {
      try { this.extra = JSON.parse(await extraFile.async('string')); this.updateFileStatus('extra.json', true); }
      catch(e) { this.updateFileStatus('extra.json', false, 'JSON 解析失败'); }
    }
    // Compatibility: a PEZ package may also carry info.yml, parsed for extended fields such as DynamicBackground
    const ymlKey = ['info.yml', 'info.yaml'].map(n => Object.keys(this.zip.files).find(k => !this.zip.files[k].dir && rootKey(k) === n)).find(Boolean);
    if (ymlKey) {
      try { this.ymlInfo = parseInfoYaml(await this.zip.file(ymlKey).async('string')) || null; }
      catch (e) { this.ymlInfo = null; }
    }
  }
  updateFileStatus(name, loaded, msg = '') {
    const f = this.files.get(name);
    if (f) { f.loaded = loaded; f.error = !loaded; f.errorMsg = msg; }
  }
}

// ============================================================
//  Resource pack loader
// ============================================================
