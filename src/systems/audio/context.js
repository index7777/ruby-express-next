// Web Audio Context 單例 + 「resume-before-schedule」保護。
//
// 搬自 web-build/index.html 的 ensureAudio()(約第 839-897 行)跟 beepGate()
// （約第 3647-3674 行）。這兩處原本各自處理 AudioContext.resume()，這裡合併成
// 一個共用 helper，避免以後新增音效又重蹈「刷卡嗶聲偶爾消失」那個 bug
// （HANDOFF.md 2026-07-14f 那筆記錄）：
//
//   AudioContext.resume() 是非同步的，如果排程 oscillator/播放發生在 resume()
//   真正 resolve 之前，部分瀏覽器會直接把這次排程吃掉、完全沒聲音。
//
// 所以任何要排音的地方都要透過 `resumeThenRun()`，不要自己接 `ctx.resume()`
// 然後緊接著排程。

let ctx = null;
let masterGain = null;
let compressor = null;
let noiseBuffer = null;

export function hasAudioContext() {
  return !!ctx;
}

export function getAudioContext() {
  return ctx;
}

export function getMasterGain() {
  return masterGain;
}

// 建立(若尚未建立)並回傳 { ctx, masterGain }。
// initialVolume: 0~1，對應 save.settings.volume。
export function ensureAudioContext(initialVolume) {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return { ctx, masterGain };
  }
  const Ctx = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return { ctx: null, masterGain: null };
  ctx = new Ctx();
  // 新建的 AudioContext 有機率一開始是 suspended，主動 resume 一次，
  // 避免第一個排程的音效被吃掉。
  if (ctx.state !== "running") { ctx.resume().catch(() => {}); }
  masterGain = ctx.createGain();
  masterGain.gain.value = typeof initialVolume === "number" ? initialVolume : 0.8;
  compressor = ctx.createDynamicsCompressor();
  masterGain.connect(compressor);
  compressor.connect(ctx.destination);

  // 共用白噪音 buffer(原本 noiseBufferRef,約第 852-857 行),ambient rumble 跟
  // playBump() 這類撞擊音效共用同一份,不用每次都重新產生亂數。
  const len = ctx.sampleRate * 1;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  return { ctx, masterGain };
}

export function getNoiseBuffer() {
  return noiseBuffer;
}

export function setMasterVolume(v) {
  if (masterGain) masterGain.gain.value = v;
}

// 排程任何「這次 tick 就要發聲」的東西時,一律透過這個 helper 呼叫,
// 保證 ctx.resume() 真的 resolve 之後才執行 fn，避免排程被吃掉。
export function resumeThenRun(fn) {
  if (!ctx) return;
  try {
    if (ctx.state !== "running") {
      ctx.resume().then(fn).catch(fn);
    } else {
      fn();
    }
  } catch (e) { /* ignore */ }
}
