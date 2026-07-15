// 搬自 web-build/index.html 第 100-146 行(ART 物件)。
// 路徑逐字保留(相對路徑 "assets/xxx"),行為不變。
// 2026-07-15q:實際素材檔案本體(158 個,mp3/png/json)已經從
// web-build/assets/ 整包複製進 web-build-next/public/assets/
// （Vite 靜態資源慣例路徑),下面這些路徑字串現在真的能讀到檔案了,
// 詳見 systems/assets/README.md。
export const ART = {
  menuBg:       "assets/menu-bg.png",       // 選單直式底圖
  stationScene: "assets/station-bg.png",    // 遊戲中車廂/月台場景
  laneStrip:    "assets/lanes.png",         // 五軌膠囊背景
  resultBg:     "assets/result-bg.png",     // 結算頁背景
  routeMap:     "assets/route-map.png",     // 捷運路網圖（備用）
  train:        "assets/train.png",         // 列車插畫（選單 / 側面穿梭）
  trainFront:   "assets/train-front.png",    // 正面衝來的列車（特快 zoom；缺檔則第三段不顯示）
  card:         "assets/card.png",          // 票卡面板
  logo:         "assets/logo-white.png",    // 共GO logo（白色版·深色選單用;黑版 logo.png 給淺底）
  introVideo:   "assets/logo-intro.mp4",    // 首頁開場動畫
  lobbyBg:      "assets/lobby-bg.png",       // 通勤大廳背景（缺檔會自動退回 menuBg）
  songselectBg: "assets/songselect-bg.png", // 選曲背景（缺檔會自動退回 menuBg）
  splashBg:     "assets/splash-station.png", // 啟動刷票口背景
  windowFar:    "assets/window-far.png",     // 窗外遠景(視差速度感)
  boss:         "assets/boss-redline.png",   // 紅寶線終點 BOSS(P1)
  bossP2:       "assets/boss-redline-p2.png", // BOSS 暴走(血量 ≤50%)
  bossP3:       "assets/boss-redline-p3.png", // BOSS 狂暴(血量 ≤30%)
  bossBg:       "assets/boss-bg.png",         // BOSS 戰專屬背景（深色隧道 + 紅危險光）
  bossKey:      "assets/boss-redline-key.png", // 紅線 BOSS 過場/開場氣氛圖（整張不去背，可帶發光）
  doorLeft:     "assets/door-left.png",        // 進站開門:左門片(缺檔用 CSS 灰門)
  doorRight:    "assets/door-right.png",       // 進站開門:右門片
  bossSignal:   "assets/boss-atk-signal.png",  // BOSS 攻擊:訊號干擾符號(去背,當干擾彈幕落下)
  bossSpit:     "assets/boss-atk-spit.png",    // BOSS 攻擊:口水噴濺(半透明潑濺,鋪滿視線)
  bossCase:     "assets/boss-atk-case.png",    // BOSS 攻擊:公事包(強制長按事件圖示,去背)
  bossBullet:   "assets/boss-bullet.png",     // BOSS 彈幕素材（洋紅底，載入時即時去背）
  bossPhaseAlert: "assets/boss-phase-alert.png", // BOSS 階段轉場警示圖騰(透明底;P2/P3 切換瞬間短暫疊圖,配合 bossIntroRedFlash 手法)
  stagemapBg:   "assets/stagemap-bg.png",    // 通勤選站背景（缺檔退回 lobbyBg）
  ledPanelTex:  "assets/led-panel-tex.png",  // LED 點陣面板紋理疊層(缺檔則用純 CSS 點陣網格 fallback,不影響顯示)
  hubIcon: { commute: "assets/hub-commute.png", records: "assets/hub-records.png", news: "assets/hub-news.png", board: "assets/hub-board.png", control: "assets/hub-control.png", vending: "assets/hub-vending.png", practice: "assets/hub-practice.png" }, // 月台大廳設施圖示(缺檔退回 emoji)
  vending: { bg: "assets/vending-bg.png", coin: "assets/vending-coin.png", revive: "assets/vending-item-revive.png", reroll: "assets/vending-item-reroll.png", monthlypass: "assets/vending-item-monthlypass.png", loyalty: "assets/vending-item-loyalty.png" },
  cardBackBg: "assets/card-back-bg.png",     // 肉鴿卡背氛圍底(中央疊 logo-white)
  commuteBtn:   "assets/btn-commute.png",    // 首頁「開始通勤」按鈕
  gogoBtn:      "assets/btn-gogo.png",        // 選曲「共GO」進入按鈕
  fx:  { perfect: "assets/fx-perfect.png", good: "assets/fx-good.png", miss: "assets/fx-miss.png" }, // 判定特效（各一張）
  npc: { stand: "assets/npc-stand.png", sit: "assets/npc-sit.png", backpack: "assets/npc-backpack.png", phone: "assets/npc-phone.png", couple: "assets/npc-couple.png", kid: "assets/npc-kid.png", glitch: "assets/npc-glitch.png", staff: "assets/npc-staff.png", police: "assets/npc-police.png", cleaner: "assets/npc-cleaner.png", conductor: "assets/npc-conductor.png", student_seat: "assets/npc-student-seat.png", luggage: "assets/npc-luggage.png", luggage_p2: "assets/npc-luggage-p2.png" },
  noteDouble: "assets/note-double-wide.png",  // 雙軌行李箱音符
  item: { headphone: "assets/item-headphone.png", sunglasses: "assets/item-sunglasses.png", clearcard: "assets/item-ticket.png", express: "assets/item-express.png" }, // 道具 icon
  note: { kick: "assets/note-kick.png", hihat: "assets/note-hihat.png", snare: "assets/note-snare.png", tom: "assets/note-tom.png", crash: "assets/note-crash.png" }, // 音符素材
  bomb: "assets/note-bomb.png", // 亂跑小孩的假炸彈音符
  noise: "assets/note-noise.png", // 上班族丟的雜訊符號
  bag: "assets/bag.png", // 背包(疊在軌道上的障礙物)
  laneTrack: "assets/lane-track-tex.png", // 音符軌道底紋(可平鋪,疊在 laneTrack 色塊上)
  judgeLineFx: "assets/judge-line-fx.png", // 判定線光效(整張,screen 疊在既有 CSS 光暈上)
  hudCorner: "assets/hud-frame-corner.png", // HUD 面板邊框裝飾角標(左上角圖,CSS 鏡射出其餘三角)
  rankBadge: { S: "assets/rank-badge-s.png", A: "assets/rank-badge-a.png", B: "assets/rank-badge-b.png", C: "assets/rank-badge-c.png" }, // 結算評級勳章
};
