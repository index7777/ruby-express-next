// 單一 <audio> 頻道的共用包裝。
//
// 搬自 web-build/index.html 裡 bgmElRef/menuBgmRef/previewRef 這三個各自手動
// 管理的 <audio> 元素（約第 837-897、3524-3539、2773-2774 行）。原始碼三處各自
// 重複「new Audio() → loop/volume/preload → play().catch(()=>{})」的樣板，
// 這裡收斂成一個類別，行為不變，只是不再各自複製貼上一份。
//
// 重要:遊戲頻道(game channel,對應原本 bgmElRef)跟選單頻道(menu channel,
// 對應原本 menuBgmRef)必須是「兩個獨立的 SingleAudioChannel 實例」，
// 不能共用同一顆 <audio>——這是刻意設計，原始碼註解說明過：
// 「結算音樂改走 bgmEl(單一音軌,避免重疊),故 result 也靜音」。
export class SingleAudioChannel {
  constructor({ loop = false, volume = 1, preload = "auto" } = {}) {
    this._defaultLoop = loop;
    this._defaultVolume = volume;
    this._preload = preload;
    this.el = null;
    this._webAudioGain = null; // 若有透過 Web Audio 路由,存這個 gain node
  }

  ensure() {
    if (this.el) return this.el;
    if (typeof Audio === "undefined") return null;
    const a = new Audio();
    a.loop = this._defaultLoop;
    a.volume = this._defaultVolume;
    a.preload = this._preload;
    this.el = a;
    return a;
  }

  // 只換 src 並 load(),不播放(開場預載用,對應原本第 3523-3527 行的預載 logo-intro.mp3)。
  preloadSrc(src) {
    const a = this.ensure();
    if (!a) return;
    try { a.src = src; a.load(); } catch (e) {}
  }

  // 換曲並播放。resetTime=true(預設)會從頭播;傳 false 可以續播(暫停/繼續情境)。
  play(src, { loop, resetTime = true, playbackRate = 1, onEnded } = {}) {
    const a = this.ensure();
    if (!a) return;
    try {
      if (src && a.src && !a.src.endsWith(src.split("/").pop())) {
        a.src = src;
        a.load();
      } else if (src && !a.src) {
        a.src = src;
      }
      if (typeof loop === "boolean") a.loop = loop;
      if (resetTime) a.currentTime = 0;
      a.playbackRate = playbackRate;
      a.onended = onEnded || null;
      a.play().catch(() => {});
    } catch (e) {}
  }

  resume() {
    if (!this.el) return;
    try { this.el.play().catch(() => {}); } catch (e) {}
  }

  pause() {
    if (!this.el) return;
    try { this.el.pause(); } catch (e) {}
  }

  // 停止並取消 loop/onended(切場景時用,避免舊的 onended 殘留觸發下一首)。
  stop() {
    if (!this.el) return;
    try { this.el.pause(); this.el.loop = false; this.el.onended = null; } catch (e) {}
  }

  setVolume(v) {
    if (!this.el) return;
    try { this.el.volume = Math.min(1, Math.max(0, v)); } catch (e) {}
  }

  get currentTime() { return this.el ? this.el.currentTime : 0; }
  get duration() { return this.el ? this.el.duration : NaN; }
  get remaining() {
    if (!this.el || !isFinite(this.el.duration)) return Infinity;
    return this.el.duration - this.el.currentTime;
  }

  // 把這個頻道路由進 Web Audio 圖(只有遊戲頻道需要,選單/預覽頻道維持獨立 <audio> 直接輸出)。
  // file:// 底下 createMediaElementSource 會被瀏覽器擋(taint),退回直接播放 <audio>,
  // 這個 fallback 邏輯逐字保留(原本第 883-895 行)。
  connectToWebAudio(ctx, masterGain, gainValue = 0.6) {
    const a = this.ensure();
    if (!a || !ctx || !masterGain) return;
    const isFile = (typeof location !== "undefined" && location.protocol === "file:");
    if (isFile) {
      a.volume = 0.55;
      return;
    }
    try {
      a.crossOrigin = "anonymous";
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      const src = ctx.createMediaElementSource(a);
      src.connect(gain);
      gain.connect(masterGain);
      this._webAudioGain = gain;
    } catch (e) { /* BGM optional; 遊戲仍可用合成 SFX 繼續跑 */ }
  }
}
