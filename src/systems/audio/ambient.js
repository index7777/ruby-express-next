// 持續循環的環境音(車廂行駛底噪),搬自 ensureAudio() 裡的 ambient rumble 段落
// (原本第 860-874 行)+ updateAmbient()(原本第 899 行起)。用白噪音 buffer
// 過 lowpass filter,依行車狀態(隧道/一般)調整音量跟濾波頻率。
export class AmbientRumble {
  constructor() {
    this.gainNode = null;
    this.filterNode = null;
  }

  // ctx: AudioContext, masterGain: 要接進去的 master gain node。
  start(ctx, masterGain) {
    if (this.gainNode) return; // 已啟動
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(masterGain);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(filter);
    src.start(0);

    this.gainNode = gain;
    this.filterNode = filter;
  }

  // ds: 目前的 DRIVE_STATES 項目(見 systems/config),要有 .tunnel 布林欄位。
  update(ctx, ds) {
    if (!ctx || !this.gainNode || !this.filterNode || !ds) return;
    const t = ctx.currentTime;
    let vol = 0.05, freq = 220;
    if (ds.tunnel) { vol = 0.03; freq = 130; }
    this.gainNode.gain.setTargetAtTime(vol, t, 0.3);
    this.filterNode.frequency.setTargetAtTime(freq, t, 0.3);
  }
}
