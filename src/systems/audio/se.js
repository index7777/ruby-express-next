// 一次性音效(SE)——沿用 beepGate() 的 oscillator 手法(原本第 3647-3674 行),
// 逐字保留「resume-before-schedule」修法,並泛化成可以排任意音高組合,
// 不只是刷票口那組 [880, 1320]。
import { getAudioContext, resumeThenRun } from "./context.js";

// tones: [{ freq, delay, dur, type, gain }]，delay/dur 單位秒。
export function playTones(tones) {
  resumeThenRun(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      tones.forEach(({ freq, delay = 0, dur = 0.11, type = "square", gain = 0.22 }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const t = ctx.currentTime + delay;
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur - 0.01 > t ? t + dur - 0.01 : t + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + dur);
      });
    } catch (e) {}
  });
}

// 刷票口嗶嗶聲(原 beepGate)：兩聲 880Hz/1320Hz,間隔 0.11s。
export function playGateBeep() {
  playTones([
    { freq: 880, delay: 0 },
    { freq: 1320, delay: 0.11 },
  ]);
}

// ── 以下兩個是「泛化過的合成音效原語」，抽自 playBump()/playChime()
// (原本第 920-965 行左右)的共同寫法。原始碼裡還有一整批同樣手法的具名函式
// (playBump/playChime/playDoorOpen/...judge 判定音效等,約第 899-1270 行,
// 全部都要接 masterGainRef 才能發聲)。
//
// ⚠️ 這批具名 SFX 函式**這次 Phase 2 故意先不搬**：它們的呼叫端(判定/BOSS/
// 進站門片動畫...)都還在 Judge/Boss/Scene 系統裡,那些系統要 Phase 3 之後
// 才會搬進 web-build-next。現在搬這些函式只會變成沒有呼叫端的孤兒程式碼,
// 沒辦法真的驗證接線正不正確,所以決定跟 Judge/Boss 邏輯一起在 Phase 3 搬,
// 到時候直接用下面這兩個共用原語重寫,不用再各自複製一份 oscillator 樣板。

// 單一振盪器 + 音量包絡(linear 上升接 exponential 衰減),freq 可選擇性做
// exponential ramp(模擬 playBump 的「砰」低頻下滑感)。
// 需要呼叫端自己提供 masterGain(通常是 audio/context.js 的 getMasterGain())。
export function playEnvelopedTone(masterGain, {
  freq, freqTo, type = "sine", attack = 0.01, decay = 0.3, peakGain = 0.4, delay = 0,
} = {}) {
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (typeof freqTo === "number") osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + decay * 0.6);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
  osc.connect(g); g.connect(masterGain);
  osc.start(t0); osc.stop(t0 + decay + 0.05);
}

// 白噪音短爆(需要先用 ambient.js 之外另外準備一份 noise buffer,或呼叫端自備)。
export function playNoiseBurst(ctx, masterGain, noiseBuffer, {
  filterFreq = 900, peakGain = 0.3, decay = 0.15, delay = 0,
} = {}) {
  if (!ctx || !masterGain || !noiseBuffer) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peakGain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
  src.connect(filter); filter.connect(g); g.connect(masterGain);
  src.start(t0); src.stop(t0 + decay + 0.03);
}

// ── Phase 3(Judge 接線)補搬:以下兩個是原本「故意先不搬」的具名 SFX
// 之中,判定核心(gameEngine.js)真正會呼叫到的兩個——onPlayDrum/
// onPlayComboFanfare。逐字對照 web-build/index.html playDrum()(約
// 1269-1313 行)/ playComboFanfare()(約 1052-1069 行),只是改成吃
// ctx/masterGain/noiseBuffer 參數而不是閉包讀 ref,呼叫端(judge 系統)
// 負責從 audio/context.js 拿這三樣東西傳進來。

// 5 軌鼓聲判定音效:kick/tom 用 sine 音高下滑,hihat/snare/crash 用
// noiseBuffer 過濾出不同音色,category==="miss" 時整體悶聲(低通/降頻)、
// category==="perfect" 時音量加成。
export function playDrum(ctx, masterGain, noiseBuffer, laneKey, category) {
  if (!ctx || !masterGain) return;
  const t0 = ctx.currentTime;
  const muffled = category === "miss";
  const bright = category === "perfect";
  const volMul = muffled ? 0.35 : bright ? 1.1 : category === "good" ? 0.7 : 0.9;

  const env = (gain, peak, attack, decay) => {
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  };

  if (laneKey === "kick" || laneKey === "tom") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const baseFreq = laneKey === "kick" ? 130 : 190;
    const endFreq = laneKey === "kick" ? 45 : 90;
    osc.frequency.setValueAtTime(baseFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.12);
    let filt = null;
    if (muffled) { filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 300; }
    env(gain, 0.9 * volMul, 0.005, laneKey === "kick" ? 0.18 : 0.22);
    osc.connect(gain);
    if (filt) { gain.connect(filt); filt.connect(masterGain); } else gain.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  } else {
    if (!noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    if (laneKey === "hihat") { filt.type = "highpass"; filt.frequency.value = muffled ? 1200 : 6000; env(gain, 0.5 * volMul, 0.001, 0.05); }
    else if (laneKey === "snare") { filt.type = "bandpass"; filt.frequency.value = muffled ? 400 : 1800; filt.Q.value = 0.7; env(gain, 0.8 * volMul, 0.001, 0.14); }
    else { filt.type = "highpass"; filt.frequency.value = muffled ? 800 : 3000; env(gain, 0.6 * volMul, 0.005, 0.55); }
    src.connect(filt);
    filt.connect(gain);
    gain.connect(masterGain);
    src.start(t0);
    src.stop(t0 + 0.7);
  }
}

// combo 里程碑 fanfare:上升大三和弦琶音(523.25/659.25/783.99/1046.5Hz)。
export function playComboFanfare(ctx, masterGain) {
  if (!ctx || !masterGain) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const t0 = ctx.currentTime + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(t0); osc.stop(t0 + 0.3);
  });
}
