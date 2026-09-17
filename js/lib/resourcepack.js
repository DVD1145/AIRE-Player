// PhiAI-Player || Resource pack (.zip) loader for note skins / audio
class ResourcePackLoader {
  static async loadFromZip(file) {
    console.log('[RP] 开始加载资源包:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const hasClick = !!zip.file('click.png');
    if (!hasClick) {
      console.warn('[RP] 未找到 click.png，可能不是有效资源包');
      throw new Error('不是有效的资源包（缺少 click.png）');
    }

    const infoFile = zip.file('info.yml');
    if (!infoFile) throw new Error('PEZ 文件中未找到 info.txt');
    const yamlText = await infoFile.async('string');
    const cleanYaml = yamlText.replace(/^\uFEFF/, '');
    console.log('[RP] info.yml 原始内容 (前200字符):', cleanYaml.substring(0, 200));

    const extensionMarkerPhi = '#以下为PhiAI扩展信息段';
    const extensionMarkerOld = '#以下为AiRE扩展信息段';
    const extensionEnabled = cleanYaml.includes(extensionMarkerPhi) || cleanYaml.includes(extensionMarkerOld);
    console.log('[RP] PhiAI 扩展启用:', extensionEnabled);

    let info;
    try {
      info = jsyaml.load(cleanYaml);
    } catch (e) {
      console.error('[RP] YAML 解析失败:', e);
      throw new Error('info.yml 解析失败: ' + e.message);
    }
    console.log('[RP] 解析后的 info 对象:', info);

    const hitFx = info.hitFx || info.hit_fx;
    if (!hitFx || !Array.isArray(hitFx) || hitFx.length !== 2) {
      console.error('[RP] hitFx 无效:', hitFx);
      throw new Error('info.yml 解析失败: ' + e.message);
    }

    const holdAtlas = info.holdAtlas || info.hold_atlas || [10, 10];
    const holdAtlasMH = info.holdAtlasMH || info.hold_atlas_mh || [10, 10];

    const loadImageFromZip = async (name) => {
      const file = zip.file(name);
      if (!file) return null;
      const blob = await file.async('blob');
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
          // Pre-decode: the browser would otherwise decode the bitmap lazily on the main
          // thread the first time drawImage() touches it mid-frame (the playback stutter).
          try { await img.decode(); } catch (e) {}
          console.log(`[RP] 加载贴图成功: ${name}`); resolve(img);
        };
        img.onerror = () => { console.warn(`[RP] 加载贴图失败: ${name}`); resolve(null); };
        img.src = url;
      });
    };

    const loadAudioFromZip = async (basename) => {
      for (const ext of ['ogg', 'wav', 'mp3']) {
        const f = zip.file(`${basename}.${ext}`);
        if (f) {
          const blob = await f.async('blob');
          const url = URL.createObjectURL(blob);
          try {
            const resp = await fetch(url);
            const buf = await resp.arrayBuffer();
            console.log(`[RP] 加载音效成功: ${basename}.${ext}`);
            return buf;
          } catch (e) {
            console.warn(`[RP] 加载音效失败: ${basename}.${ext}`, e);
            return null;
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      }
      return null;
    };

    const textures = {
      click: await loadImageFromZip('click.png'),
      click_mh: await loadImageFromZip('click_mh.png'),
      hold: await loadImageFromZip('hold.png'),
      hold_mh: await loadImageFromZip('hold_mh.png'),
      flick: await loadImageFromZip('flick.png'),
      flick_mh: await loadImageFromZip('flick_mh.png'),
      drag: await loadImageFromZip('drag.png'),
      drag_mh: await loadImageFromZip('drag_mh.png'),
      hit_fx: await loadImageFromZip('hit_fx.png'),
    };

    const soundBuffers = {
      click: await loadAudioFromZip('click'),
      drag: await loadAudioFromZip('drag'),
      flick: await loadAudioFromZip('flick'),
      ending: await loadAudioFromZip('ending'),
    };

    let colorPerfect = null;
    let colorGood = null;
    let holdSFX = false;
    let goodHitFX = false;
    let holdSoundBuffer = null;
    let goodHitFxImage = null;

    if (extensionEnabled) {
      if (info.colorPerfect) colorPerfect = info.colorPerfect;
      if (info.colorGood) colorGood = info.colorGood;
      if (info.HoldSFX === true || info.HoldSFX === 'true') holdSFX = true;
      if (info.GoodHitFX === true || info.GoodHitFX === 'true') goodHitFX = true;

      if (holdSFX) {
        holdSoundBuffer = await loadAudioFromZip('Hold');
        if (!holdSoundBuffer) console.warn('[RP] HoldSFX 启用但未找到 Hold 音效');
      }
      if (goodHitFX) {
        goodHitFxImage = await loadImageFromZip('hit_fx2.png');
        if (!goodHitFxImage) console.warn('[RP] GoodHitFX 启用但未找到 hit_fx2.png');
      }
    }

    console.log('[RP] 资源包加载完成');
    return {
      info, textures, soundBuffers, hitFx, holdAtlas, holdAtlasMH,
      extensionEnabled, colorPerfect, colorGood, holdSFX, goodHitFX,
      holdSoundBuffer, goodHitFxImage,
    };
  }
}

// ============================================================
//  Main player (with integrated particle system)
// ============================================================
// Sum every stacked event layer at the given line beat. Hoisted out of the
// per-line loop: it used to allocate a fresh closure for every judge line on every frame.
function sumLayers(arrs, lb) { let s = 0; for (let i = 0; i < arrs.length; i++) s += evaluateEvent(arrs[i], lb, 0); return s; }

// Draw passes used by drawNotesOnLine: 0 = holds first, 1 = everything else.
// Hoisted so the literal array stops being reallocated per line per frame.
const __NOTE_PASSES = [0, 1];
