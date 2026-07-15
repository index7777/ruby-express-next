// App —— 整個遊戲的最外層元件。
//
// ⚠️ 2026-07-15 選單流程接線:這次把 Phase 0~9 各自獨立驗證過的系統
// (config/assets/save/data/judge/audio/effect/scene/camera/particle/ui/
// boss/npc)真正組成一個從刷票口(splash)開始、可以整場走完的選單導向
// 遊戲入口——之前這裡只是一份「搬移驗證清單」demo 頁(列系統檢查項 +
// 各系統獨立展示按鈕),使用者確認「換成真的入口」後,demo 清單整份拿掉,
// 改成下面這個真正的畫面流程控制器。
//
// 畫面流程(對照 `scene/sceneManager.js` 的 `SCENE_NAMES`,不是每個名字
// 都用到——`penalty`/`running` 併進「一般行駛判定」由 `PlayScene` 自己
// 處理,沒有獨立畫面):
//   splash → hub → lobby → mode →
//     commute: slots → stagemap → playing → arrival → (下一站 stagemap / 終點 boss)
//     free:    songselect → playing → result
//     bossTest: bossselect → boss → result(boss)
//   hub → records / news / leaderboard / settings(→ calibrate) / vending / practice(→ playing)
//
// ⚠️ 刻意的範圍邊界(詳見各畫面檔案開頭註解跟 `game/README.md`):
// - 到站(arrival)選好肉鴿卡後「繼續共GO」是回到通勤路線圖讓玩家自己點
//   下一站,不是像原始碼直接無縫接下一站——省下額外的「站序自動推進」
//   狀態管理,行為上玩家一樣要點一次下一站,只是多經過路線圖畫面。
// - 進站補給預購(`preorder.monthlypass`/`loyalty`)、道具/集氣充能跨站
//   延續都還沒接(`ItemManager` 目前每次進 `PlayScene` 都重新歸零)——
//   肉鴿卡效果(`recalcRogue` 算出的加成)有做到跨站延續(見 `PlayScene.jsx`
//   /`BossScene.jsx` 的 `initialRogueCardIds` prop),道具充能沒有。
// - 練習模式/BOSS 戰測試略過原始碼的陀螺儀權限詢問彈窗(`askTiltThen`)。
import { useRef, useState } from "react";
import { STATION_NAMES, STATION_EN } from "../data/index.js";
import { loadSave, writeSave } from "../save/index.js";
import { accRank, rollArrivalCards } from "../judge/index.js";
import { createAudioManager } from "../audio/index.js";
import { createFxManager, createScreenShake } from "../effect/index.js";
import { createCameraManager } from "../camera/index.js";
import {
  SplashScene, HubScene, LobbyScene, ModeScene, SlotsScene, BossSelectScene,
  StageMapScene, SongSelectScene, PlayScene, BossScene, ArrivalScene,
  CalibrateScene, SettingsScene, RecordsScene, NewsScene, LeaderboardScene,
  VendingScene, ResultScene, BossResultScene,
} from "../game/index.js";

const REROLL_COST = 30;

export default function App() {
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudioManager();
  const fxRef = useRef(null);
  if (!fxRef.current) fxRef.current = createFxManager();
  const shakeRef = useRef(null);
  if (!shakeRef.current) shakeRef.current = createScreenShake();
  const cameraRef = useRef(null);
  if (!cameraRef.current) cameraRef.current = createCameraManager();

  const [screen, setScreen] = useState("splash");
  const [routeIdx, setRouteIdx] = useState(0);
  const [gameMode, setGameMode] = useState("commute"); // "commute" | "free"
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedBossId, setSelectedBossId] = useState("redline");
  const [returnScreen, setReturnScreen] = useState("hub"); // PlayScene/BossScene 的「離開」要回去哪
  const [arrivalCtx, setArrivalCtx] = useState(null);
  const [resultCtx, setResultCtx] = useState(null); // { kind:"normal"|"boss", stats, gameMode }

  // 通勤模式進 PlayScene/BossScene 時,把目前存檔格已選的肉鴿卡帶進去
  // (對照原始碼整趟通勤延續 `runCardsRef`),自由模式/練習模式沒有存檔格
  // 概念,一律從空清單開始。
  const activeSlotCardIds = () => {
    if (selectedStation == null && gameMode !== "commute") return [];
    const save = loadSave();
    const slot = save.slots[save.activeSlot];
    return (slot && slot.run && slot.run.cards) || [];
  };

  // ── hub ──
  const enterHub = () => setScreen("hub");

  // ── lobby / mode ──
  const goLobby = () => setScreen("lobby");
  const selectRoute = (i) => { setRouteIdx(i); setScreen("mode"); };

  // ── slots / stagemap(通勤) ──
  const goSlots = () => { setGameMode("commute"); setScreen("slots"); };
  const selectSlot = () => setScreen("stagemap");
  const selectStation = (stationIndex, track) => {
    setSelectedStation(stationIndex);
    setSelectedTrack(track);
    setReturnScreen("stagemap");
    setScreen("playing");
  };

  // ── songselect(自由模式) ──
  const goFree = () => { setGameMode("free"); setScreen("songselect"); };
  const confirmSong = (track) => {
    setSelectedTrack(track);
    setSelectedStation(null);
    setReturnScreen("songselect");
    setScreen("playing");
  };

  // ── bossselect(BOSS 戰測試) ──
  const goBossSelect = () => setScreen("bossselect");
  const selectBoss = (id) => {
    setSelectedBossId(id);
    setReturnScreen("bossselect");
    setScreen("boss");
  };

  // ── 練習模式(hub 直接進場,備援節奏、不記錄過關) ──
  const enterPractice = () => {
    setGameMode("free");
    setSelectedTrack(null);
    setSelectedStation(null);
    setReturnScreen("hub");
    setScreen("playing");
  };

  // ── PlayScene 結束 ──
  const onPlayFinished = (stats) => {
    if (stats.stationIndex != null) {
      // 通勤模式:算評級,抽三張肉鴿卡供到站選,進 arrival。
      const save = loadSave();
      const slot = save.slots[save.activeSlot];
      const ar = accRank(stats.counts);
      const offer = rollArrivalCards((slot.run && slot.run.cards) || [], 3);
      setArrivalCtx({
        stationIndex: stats.stationIndex,
        isLast: stats.stationIndex >= 4,
        stats: { rank: ar.rank, acc: ar.acc, fc: ar.fc, score: stats.score },
        cardsOffer: offer,
        rerolled: false,
        pickedCard: null,
        points: save.points || 0,
      });
      setScreen("arrival");
    } else {
      setResultCtx({ kind: "normal", stats, gameMode });
      setScreen("result");
    }
  };

  // ── arrival(到站)──
  const pickArrivalCard = (card) => setArrivalCtx((ctx) => ({ ...ctx, pickedCard: card }));
  const rerollArrival = () => {
    const save = loadSave();
    if ((save.points || 0) < REROLL_COST) return;
    save.points -= REROLL_COST;
    writeSave(save);
    const slot = save.slots[save.activeSlot];
    const offer = rollArrivalCards((slot.run && slot.run.cards) || [], 3);
    setArrivalCtx((ctx) => ({ ...ctx, cardsOffer: offer, rerolled: true, pickedCard: null, points: save.points }));
  };
  const continueFromArrival = () => {
    const save = loadSave();
    const slot = save.slots[save.activeSlot];
    if (arrivalCtx.pickedCard) {
      slot.run = slot.run || { cards: [] };
      slot.run.cards = [...(slot.run.cards || []), arrivalCtx.pickedCard.id];
      writeSave(save);
    }
    if (arrivalCtx.isLast) {
      setSelectedBossId("redline");
      setReturnScreen("stagemap");
      setScreen("boss");
    } else {
      setScreen("stagemap");
    }
    setArrivalCtx(null);
  };
  const leaveFromArrival = () => { setArrivalCtx(null); setScreen("hub"); };

  // ── BossScene 結束 ──
  const onBossFinished = (stats) => {
    setResultCtx({ kind: "boss", stats });
    setScreen("result");
  };

  // ── result(結算)──
  const retryFromResult = () => {
    if (resultCtx?.kind === "boss") { setScreen("boss"); return; }
    setScreen("playing");
  };
  const backFromResult = () => {
    if (resultCtx?.kind === "boss") { setScreen("hub"); return; }
    setScreen(gameMode === "commute" ? "stagemap" : "hub");
  };

  // ── settings / calibrate ──
  const applyCalibration = (offsetMs) => {
    const save = loadSave();
    save.settings.offsetMs = offsetMs;
    writeSave(save);
    setScreen("settings");
  };

  switch (screen) {
    case "splash":
      return <SplashScene onEnter={enterHub} />;

    case "hub":
      return (
        <HubScene
          onGoCommute={goLobby}
          onGoRecords={() => setScreen("records")}
          onGoNews={() => setScreen("news")}
          onGoLeaderboard={() => setScreen("leaderboard")}
          onGoSettings={() => setScreen("settings")}
          onGoVending={() => setScreen("vending")}
          onPractice={enterPractice}
          onLeave={() => setScreen("splash")}
        />
      );

    case "lobby":
      return <LobbyScene onSelectRoute={selectRoute} onBack={enterHub} />;

    case "mode":
      return (
        <ModeScene
          routeIdx={routeIdx}
          onCommute={goSlots}
          onFree={goFree}
          onBossTest={goBossSelect}
          onBack={goLobby}
        />
      );

    case "slots":
      return <SlotsScene onSelectSlot={selectSlot} onBack={() => setScreen("mode")} />;

    case "bossselect":
      return <BossSelectScene onSelectBoss={selectBoss} onBack={() => setScreen("mode")} />;

    case "stagemap":
      return <StageMapScene onSelectStation={selectStation} onBack={() => setScreen("mode")} />;

    case "songselect":
      return <SongSelectScene onConfirm={confirmSong} onBack={() => setScreen("mode")} />;

    case "records":
      return <RecordsScene onBack={enterHub} />;
    case "news":
      return <NewsScene onBack={enterHub} />;
    case "leaderboard":
      return <LeaderboardScene onBack={enterHub} />;
    case "vending":
      return <VendingScene onBack={enterHub} />;
    case "settings":
      return <SettingsScene onEnterCalibrate={() => setScreen("calibrate")} onBack={enterHub} />;
    case "calibrate":
      return <CalibrateScene onApply={applyCalibration} onBack={() => setScreen("settings")} />;

    case "playing":
      return (
        <PlayScene
          audio={audioRef.current}
          fx={fxRef.current}
          shake={shakeRef.current}
          camera={cameraRef.current}
          onExit={() => setScreen(returnScreen)}
          onFinished={onPlayFinished}
          track={selectedTrack}
          stationIndex={selectedStation}
          gameMode={gameMode}
          initialRogueCardIds={activeSlotCardIds()}
        />
      );

    case "boss":
      return (
        <BossScene
          audio={audioRef.current}
          fx={fxRef.current}
          shake={shakeRef.current}
          camera={cameraRef.current}
          onExit={() => setScreen(returnScreen)}
          onFinished={onBossFinished}
          bossId={selectedBossId}
          initialRogueCardIds={activeSlotCardIds()}
        />
      );

    case "arrival":
      if (!arrivalCtx) { setScreen("hub"); return null; }
      return (
        <ArrivalScene
          stationName={STATION_NAMES[arrivalCtx.stationIndex]}
          stationLabel={`${STATION_EN[arrivalCtx.stationIndex]} · 第 ${arrivalCtx.stationIndex + 1} 站 通過`}
          isLast={arrivalCtx.isLast}
          stats={arrivalCtx.stats}
          points={arrivalCtx.points}
          cardsOffer={arrivalCtx.cardsOffer}
          rerolled={arrivalCtx.rerolled}
          onPickCard={pickArrivalCard}
          onReroll={rerollArrival}
          onContinue={continueFromArrival}
          onLeave={leaveFromArrival}
        />
      );

    case "result":
      if (!resultCtx) { setScreen("hub"); return null; }
      return resultCtx.kind === "boss"
        ? <BossResultScene stats={resultCtx.stats} onRetry={retryFromResult} onBack={backFromResult} />
        : <ResultScene stats={resultCtx.stats} gameMode={resultCtx.gameMode} onRetry={retryFromResult} onBack={backFromResult} />;

    default:
      return <SplashScene onEnter={enterHub} />;
  }
}
