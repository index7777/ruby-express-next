// 搬自 web-build/index.html 第 147-178 行左右。逐字保留,行為不變。
export const STATION_NAMES = ["迴音淡水", "潮汐紅樹", "竹圍風動", "關渡平原", "嶺上清風"];
export const STATION_EN = ["Echo Danshui", "Tidal Mangrove", "Gust Bamboo", "Plains Guandu", "Ridge Breeze"];
export const BOSS_NAME = "上班族之怒";
export const BOSS_SUB = "Paul 事真多";

// BOSS 名冊(phase 1:選王畫面 + 動態身分/立繪/橫幅;新王先沿用現有 BOSS 引擎可進場測試,獨特機制之後分批加)
export const BOSSES = [
  { id: "redline",  name: "上班族之怒",     sub: "Paul 事真多",   color: "#E24B4A",
    base: "assets/boss-redline.png",  p2: "assets/boss-redline-p2.png",  p3: "assets/boss-redline-p3.png",
    key: "assets/boss-redline-key.png",  banner: "assets/boss-banner-redline.png",  role: "紅寶線終點王",
    bg: "assets/boss-bg.png", bg2: "assets/boss-bg.png", bg3: "assets/boss-bg.png", bgm: "assets/boss-bgm-redline.mp3" },
  { id: "yaksha",   name: "擴音夜叉",       sub: "夜路走多總會遇到", color: "#3FE0FF",
    base: "assets/boss-yaksha.png",   p2: "assets/boss-yaksha-p2.png",   p3: "assets/boss-yaksha-p3.png",
    key: "assets/boss-yaksha-key.png",   banner: "assets/boss-banner-yaksha.png",   role: "夜間路線 · 操作解除王",
    bg: "assets/boss-bg.png", bg2: "assets/boss-bg.png", bg3: "assets/boss-bg.png", bgm: "assets/boss-bgm-yaksha.mp3" },
  { id: "glutton",  name: "士林夜市大魔神", sub: "呷飽袂?",       color: "#FF9F45",
    base: "assets/boss-glutton.png",  p2: "assets/boss-glutton-p2.png",  p3: "assets/boss-glutton-p3.png",
    key: "assets/boss-glutton-key.png",  banner: "assets/boss-banner-glutton.png",  role: "連點爆量王",
    bg: "assets/boss-bg.png", bg2: "assets/boss-bg.png", bg3: "assets/boss-bg.png", bgm: "assets/boss_bgm_glutton.mp3" },
  { id: "birdman",  name: "北車迷宮鳥人",   sub: "你,出得去嗎?", color: "#FFE14D",
    base: "assets/boss-birdman.png",  p2: "assets/boss-birdman-p2.png",  p3: "assets/boss-birdman-p3.png",
    key: "assets/boss-birdman-key.png",  banner: "assets/boss-banner-birdman.png",  role: "空間認知王",
    bg: "assets/boss-birdman-bg.png", bg2: "assets/boss-birdman-bg-p2.png", bg3: "assets/boss-birdman-bg-p3.png", bgm: "assets/boss_bgm_birdman.mp3" },
];

// 紅線 BOSS 死亡遺言(討伐成功時隨機一句)
export const BOSS_DEATH_LINES = [
  "終於……可以下班了……",
  "你贏了……記得幫我打卡……",
  "我的肝……終於可以休息了……",
  "明天……還有 Meeting……算了……不管了……",
  "原來……準時下班……是這種感覺啊……",
  "你……有資格當主管了……",
];
