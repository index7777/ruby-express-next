// AudioManager:統一音訊管理的對外介面,對應規格書要求的
// 「BGM / SE / Voice / Ambient / Announcement」分類。
//
// 這裡把 web-build/index.html 原本散在 ensureAudio()/beepGate()/menuBgmRef 等
// useRef + useEffect 裡的音訊邏輯,收斂成一個不綁定 React 的物件,Phase 3
// (Judge/Game loop)、Phase 5(Scene Manager)之後會呼叫這裡的方法,
// 而不是各自重新 new Audio()/建立 AudioContext。
//
// 目前(Phase 2)範圍:BGM 三頻道(遊戲/選單/試聽)、環境音、通用 SE 原語、
// 音量分類 + ducking 模型。判定/BOSS 專屬的具名合成音效(playBump/playChime/
// playDoorOpen...)刻意留到 Phase 3 跟 Judge/Boss 邏輯一起搬(見 se.js 開頭註解)。
import {
  ensureAudioContext, getAudioContext, getMasterGain, getNoiseBuffer,
  setMasterVolume as setCtxMasterVolume,
} from "./context.js";
import { SingleAudioChannel } from "./bgm.js";
import { playGateBeep as _playGateBeep, playEnvelopedTone, playNoiseBurst } from "./se.js";
import { AmbientRumble } from "./ambient.js";
import { VolumeModel, CATEGORIES } from "./volume.js";

// 搬自原本第 3532/3545 行:這些 phase 底下選單主題曲要靜音
// (因為畫面正在播放關卡曲/BOSS 曲/結算曲,兩者不能同時播)。
const MENU_BGM_SILENT_PHASES = new Set([
  "running", "penalty", "songselect", "boss", "result", "arrival", "calibrate",
]);
export function isMenuBgmSilentPhase(phase) {
  return MENU_BGM_SILENT_PHASES.has(phase);
}

export class AudioManager {
  constructor() {
    this.volume = new VolumeModel();
    this.game = new SingleAudioChannel({ loop: false, volume: 0.55 });   // 對應 bgmElRef
    this.menu = new SingleAudioChannel({ loop: true, volume: 0.5 });     // 對應 menuBgmRef
    this.preview = new SingleAudioChannel({ loop: true, volume: 0.7 });  // 對應 previewRef
    this.ambient = new AmbientRumble();
    this._ready = false;
  }

  // 對應原本 ensureAudio()。第一次呼叫才會真的建立 AudioContext/接線,
  // 之後重複呼叫只會做 resume 檢查(見 context.js)。
  ensure(initialVolume) {
    const { ctx, masterGain } = ensureAudioContext(initialVolume ?? this.volume.master);
    if (!ctx) return false; // 環境沒有 Web Audio(SSR/測試環境),安靜地不做事
    if (!this._ready) {
      this.ambient.start(ctx, masterGain);
      this.game.connectToWebAudio(ctx, masterGain, 0.6);
      this._ready = true;
    }
    return true;
  }

  isReady() { return this._ready; }

  // 對應原本設定頁改音量時同步的三處(第 1360-1363 行):
  // master gain(遊戲頻道走 Web Audio 時靠這個控制音量)、選單頻道 volume、
  // 遊戲頻道 volume(只有 file:// 才需要,因為那時遊戲頻道沒接 Web Audio)。
  applySettingsVolume(vol) {
    this.volume.setMaster(vol);
    setCtxMasterVolume(vol);
    this.menu.setVolume(vol);
    const isFile = typeof location !== "undefined" && location.protocol === "file:";
    if (isFile) this.game.setVolume(vol);
  }

  // ── 遊戲頻道(bgm 分類,關卡曲/BOSS 曲/結算曲/勝敗曲共用同一顆 <audio>,
  //    避免重疊——這是刻意設計,不要拆成多顆元素)──
  playGameBgm(src, opts) { this.game.play(src, opts); }
  stopGameBgm() { this.game.stop(); }
  pauseGameBgm() { this.game.pause(); }
  get gameBgmRemaining() { return this.game.remaining; }
  get gameBgmCurrentTime() { return this.game.currentTime; }

  // ── 選單頻道(bgm 分類,對應 menuBgmRef;splash 播 logo-intro,
  //    其餘畫面播 menu-bgm,特定 phase 靜音見 isMenuBgmSilentPhase)──
  preloadMenuBgm(src) { this.menu.preloadSrc(src); }
  playMenuBgm(src, opts) { this.menu.play(src, opts); }
  pauseMenuBgm() { this.menu.pause(); }
  resumeMenuBgm() { this.menu.resume(); }

  // ── 試聽頻道(bgm 分類,選曲畫面用,跟遊戲/選單頻道完全獨立)──
  playPreview(src) { this.preview.play(src, { loop: true }); }
  stopPreview() { this.preview.pause(); }

  // ── 環境音(ambient 分類,車廂行駛底噪,依行車狀態調整)──
  updateAmbient(driveState) {
    this.ambient.update(getAudioContext(), driveState);
  }

  // ── SE(se 分類)──
  playGateBeep() { _playGateBeep(); }
  playTone(opts) { playEnvelopedTone(getMasterGain(), opts); }
  playNoiseBurst(opts) { playNoiseBurst(getAudioContext(), getMasterGain(), getNoiseBuffer(), opts); }

  // ── ducking(新增能力;voice/announcement 之後要接語音提示時,
  //    可以用這個暫時壓低 bgm/ambient,不用另外手刻淡出邏輯)──
  duck(category, amount, ms) { this.volume.duckCategory(category, amount, ms); }

  // 手機切到背景/螢幕關閉時暫停選單曲,回前景依 phase 決定要不要恢復
  // (對應原本 visibilitychange 那個 useEffect,第 3541-3551 行)。
  handleVisibilityChange(isHidden, currentPhase) {
    if (isHidden) { this.pauseMenuBgm(); return; }
    if (!isMenuBgmSilentPhase(currentPhase)) this.resumeMenuBgm();
  }
}

export function createAudioManager() {
  return new AudioManager();
}

export { CATEGORIES };
