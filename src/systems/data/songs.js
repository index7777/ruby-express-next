// 搬自 web-build/index.html 第 320-333 行左右。逐字保留,行為不變。
// 實際自由曲清單是執行期讀 assets/songs.json(見 gen_songs.py 工具),
// 這裡是「讀不到時的後備清單」跟「通勤 5 站固定曲目」。
export const DEFAULT_TRACKS = [
  { name: "地下鉄のライン", file: "assets/bgm.mp3", chart: "assets/charts/bgm.normal.json" },
  { name: "捷運快線", file: "assets/express.mp3", chart: "assets/charts/express.normal.json" },
  { name: "捷運 Pulse", file: "assets/Pulse.mp3", chart: null },
];

// 紅寶線通勤 5 站專屬曲目(正式曲已產出,檔名為底線命名)
export const REDLINE_TRACKS = [
  { name: "迴音淡水", file: "assets/redline_1_echo_danshui.mp3", chart: "assets/charts/redline_1_echo_danshui.normal.json" },
  { name: "潮汐紅樹", file: "assets/redline_2_tidal_mangrove.mp3", chart: "assets/charts/redline_2_tidal_mangrove.normal.json" },
  { name: "竹圍風動", file: "assets/redline_3_gust_bamboo.mp3", chart: "assets/charts/redline_3_gust_bamboo.normal.json" },
  { name: "關渡平原", file: "assets/redline_4_plains_guandu.mp3", chart: "assets/charts/redline_4_plains_guandu.normal.json" },
  { name: "嶺上清風", file: "assets/redline_5_ridge_breeze.mp3", chart: "assets/charts/redline_5_ridge_breeze.normal.json" },
];
