# config

搬入範圍：目前寫死在 `web-build/index.html` 裡的常數設定。
例如 `APPROACH_SEC`、`WINDOW_GOOD`/`WINDOW_GREAT`/`WINDOW_PERFECT`、
`COMBO_MILESTONES`、`BOSS_FINISHER_HP`、`BOSS_FINISHER_FAIL_DMG_PCT`、
`BOSS_FINISHER_SUCCESS_SCORE`/`BOSS_FINISHER_FAIL_SCORE` 等所有目前分散在
程式各處的魔法數字。

狀態：Phase 1 完成(2026-07-14),Phase 9 補齊 BOSS_FINISHER_* 常數(2026-07-15)。

- ⚠️ 這份文件先前一直沒更新過(一直寫「尚未搬入內容(Phase 1)」),但
  `constants.js` 其實從 Phase 1 起就已經有完整內容——這是文件跟實際進度
  脫節的既有落差,這次 Phase 9 順手修正,不是這輪才搬的。
- `constants.js` 目前涵蓋:燈軌定義(`LANES`/`KEY_TO_LANE`)、節奏時間軸
  (`BASE_BPM`/`BEAT_SEC`/`APPROACH_SEC`/`START_DELAY`)、判定窗
  (`WINDOW_PERFECT`/`GREAT`/`GOOD`)、combo 倍率(`COMBO_TIERS`/
  `multiplierFor`)、行車狀態(`DRIVE_STATES`)、平衡對抗常數(`BAL_*`/
  `OPP_DIR`)、BOSS 傷害/finisher 常數(`DMG_TABLE`/`SELF_DMG_TABLE`/
  `BOSS_HP`/`BOSS_FINISHER_*`/`BOSS_BULLET_INTERVAL_MS`/
  `BOSS_SPECIAL_INTERVAL_MS`/`HOLD_NEED_MS`)、道具定義(`ITEM_DEFS`)、
  必殺技集氣(`EXPRESS_*`)、NPC 相關分數(`STAFF_DURATION_MS`/
  `BACKPACK_SCORE`/`NOISE_SCORE`)、震動 helper(`vibrate`)等。
- `balanceGate.js`(Phase 9 新增):平衡對抗的共用純物理函式,見
  `src/systems/boss/README.md`/`src/systems/npc/README.md` 說明。
