// 音量分類模型(新增,原始碼沒有這層抽象,是規格書要求的「BGM/SE/Voice/
// Ambient/Announcement 分類 + ducking」)。
//
// master(0~1,對應 save.settings.volume) × 該分類的 category volume(預設都是 1)
// × 該分類目前的 duck 係數(暫時壓低,預設 1 = 不壓低) = 實際輸出音量。
export const CATEGORIES = ["bgm", "se", "voice", "ambient", "announcement"];

export class VolumeModel {
  constructor() {
    this.master = 0.8;
    this.category = Object.fromEntries(CATEGORIES.map((c) => [c, 1]));
    this.duck = Object.fromEntries(CATEGORIES.map((c) => [c, 1]));
    this._duckTimers = {};
  }

  setMaster(v) { this.master = Math.min(1, Math.max(0, v)); }
  setCategory(cat, v) { if (cat in this.category) this.category[cat] = Math.min(1, Math.max(0, v)); }

  // 取得某分類目前實際輸出音量(0~1)。
  effective(cat) {
    const c = this.category[cat] ?? 1;
    const d = this.duck[cat] ?? 1;
    return Math.min(1, Math.max(0, this.master * c * d));
  }

  // 暫時把某分類壓到 amount(0~1)倍,ms 毫秒後自動恢復到 1。
  // 例如:重要 SE 播放時暫時壓低 bgm,播完自動回穩。
  duckCategory(cat, amount, ms) {
    if (!(cat in this.duck)) return;
    this.duck[cat] = amount;
    if (this._duckTimers[cat]) clearTimeout(this._duckTimers[cat]);
    this._duckTimers[cat] = setTimeout(() => { this.duck[cat] = 1; }, ms);
  }
}
