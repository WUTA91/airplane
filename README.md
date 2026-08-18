# ✈️ Airplan · 飞行计划

> 把每一次专注变成一场飞行 —— 基于地图的专注计时器

![Version](https://img.shields.io/badge/VERSION-V1.2.1.3Beta2-4A90D9?style=flat-square)
![Platform](https://img.shields.io/badge/PLATFORM-WEB%20%2F%20MOBILE-4A90D9?style=flat-square)
![Demo](https://img.shields.io/badge/DEMO-在线体验-4A90D9?style=flat-square)

> 🌐 **在线演示**：[http://wujing.pages.dev/](http://wujing.pages.dev/)

---

## 📖 简介

**Airplan · 飞行计划** 是一款将「专注时间」可视化为「飞行旅程」的 Web 应用。选择起飞机场，设定专注时长（即飞行时间），系统会自动匹配范围内的目的地机场，然后你将在地图上看着飞机沿着航线缓缓飞向终点——专注结束，航班降落。

### 核心理念

```
选定起点 → 规划航线 → 挑选座位 → 选择专注场景 → 领取登机牌 → 起飞 → 巡航 → 降落
```

---

## 📘 代码文档

> 深入的代码架构、算法解析、函数速查 → [**CodeWiki.md**](CodeWiki.md)

---

## ✨ 功能特性

### 🗺️ 地图与航线
- 基于 **Leaflet.js** + **高德地图**瓦片（卫星/路网/自定义）
- 覆盖 **69 座** 中国机场，含三字码、名称、经纬度
- 自动 **WGS84 ⇄ GCJ02** 坐标系统切换，确保不同图层下位置精准
- 以机场为节点，实时绘制航线、显示范围圆、计算飞行距离
-专属codewiki.md文档，便于维护

### ⏱️ 专注计时
- 滑块设定 **10–240 分钟** 飞行时间
- 根据速度 800 km/h（13.33 km/min）自动匹配可达机场
- 球形大地线插值（Slerp）驱动飞机平滑移动，匀速无抖动
- 支持 **暂停/继续**，地图随飞机视角自动跟随

### 💺 座位与场景
- 模拟客机 30 排 × 4 列（A/C/D/F）座位图
- **11 种预设专注场景**：学习、工作、睡眠、放松、运动、阅读、创作、游戏、音乐、编程、追星
- 支持自定义场景（最多 14 个），每个场景有独特颜色和 SVG 图标
- 座位上显示当前场景图标，场景切换实时联动

### 🎫 登机牌
- 生成模拟登机牌：航班号、日期、座位、乘客昵称
- 静态 SVG 条形码图形

### 📊 飞行记录
- 自动保存每次飞行记录（最多 100 条）
- 显示航线、距离、时长、状态（已降落 / 中断）
- 支持清空历史

### ⚙️ 设置中心
- 昵称管理
- 默认地图样式（卫星 / 路网 / 自定义瓦片）
- 自定义瓦片 URL 模板
- 重置起飞机场
- 图层标注开关

### 📱 移动端适配
- 全面响应式布局，`clamp()` 自适应字号
- Safe Area 安全区域适配（iPhone 刘海/底部横条）
- 触摸事件优化，`overscroll-behavior` 防止滚动穿透

---

## 🚀 快速开始

### 环境要求

无需构建工具、无需服务端。只需一个现代浏览器（Chrome / Safari / Firefox / Edge 最新版本）。

### 运行

```bash
# 直接打开
open index.html

# 或启动本地服务器（推荐，避免某些浏览器安全策略限制）
npx serve .
# 或
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`

### 使用流程

```
1. 点击地图上的机场标记 → 选择起飞机场
2. 拖动时间滑块 → 设定专注时长
3. 搜索或浏览目的地机场 → 确认航线
4. 在座位图上选一个喜欢的座位
5. 选择本次专注场景（学习/工作/...）
6. 领取登机牌 → 点击"准备登机"
7. 观看飞机沿航线飞行 → 专注计时中...
8. 飞行结束 → 航班降落，记录保存
```

---

## 📖 代码文档

> 深入的代码架构与实现细节分析 → [**CodeWiki.md**](CodeWiki.md)

---

## 🏗️ 技术架构

### 单文件架构

整个应用为一个 `index.html`（~2100 行），零外部构建依赖：

```
index.html
├── <style>  — 全部 CSS（353 行）
├── <body>   — DOM 结构（186 行）
└── <script> — 全部 JavaScript（1542 行）
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 地图引擎 | [Leaflet.js](https://leafletjs.com/) 1.9.4（CDN） |
| 地图瓦片 | 高德卫星/路网 · OpenStreetMap · 自定义 URL |
| 坐标转换 | 内置 WGS84 ⇄ GCJ02 精确算法 |
| 插值算法 | 球面大地线 Slerp（Haversine 变体） |
| 动画引擎 | `requestAnimationFrame` + 增量时间 |
| 数据存储 | `localStorage` 持久化 |
| 样式方案 | CSS 变量 + `clamp()` 响应式 + `backdrop-filter` |

### 核心数据结构

```javascript
// 全局状态
globalState = {
    startAir, endAir,       // 起/终点机场
    selectSeat,             // 座位号 (如 "12A")
    currScene,              // 当前专注场景
    flyMin,                 // 飞行分钟数
    flyKmPerMin: 13.33,     // 速度 (800km/h)
    totalKm, remainMin,     // 总距离/剩余时间
    isFlyPause, isFlying,   // 飞行状态
    map, currentTile,       // 地图实例与图层
    currentCoordSystem,     // 'gcj02' | 'wgs84'
    planeMarker, routeLine, // 飞机/航线 Leaflet 对象
    airportMarkers          // 机场标记数组
}

// 机场数据库（69 座）
airportDB = [
    { code: "PEK", name: "北京首都", lng: 116.40, lat: 40.08 },
    // ...
]
```

### 模块划分（JS 函数群）

| 模块 | 关键函数 | 说明 |
|------|----------|------|
| 存储封装 | `setStorage` / `getStorage` | localStorage JSON 序列化 |
| 工具函数 | `wgs84ToGcj02` / `debounce` / `throttle` | 坐标转换与性能优化 |
| UI 辅助 | `showModal` / `hideModal` / `toast` | 弹窗管理与消息提示 |
| 地图控制 | `initMap` / `switchLayer` / `renderAllAirportMarker` | 图层切换与标记渲染 |
| 机场选择 | `selectStartAirport` / `filterAirportByRange` | 机场搜索与筛选 |
| 航线绘制 | `drawRouteLine` / `updateRangeCircle` / `drawPlaneMarker` | 可视化航线与飞机 |
| 座位系统 | `renderAllSeat` / `clickSeat` / `highlightSelectedSeat` | 座位图渲染与交互 |
| 场景系统 | `renderSceneList` / `updateSelectedSeatColor` | 场景列表与颜色管理 |
| 飞行控制 | `startFlyTimer` / `flyStep` / `finishFlight` | 飞行动画与计时 |
| 飞行记录 | `loadHistory` / `saveHistory` / `renderHistory` | 历史持久化 |
| 登机牌 | `generateBarcodeCanvas` | 条形码生成（HTML 中无对应 canvas，实际为静态 SVG） |
| 设置中心 | `renderSettingContent` / `showSettingWithOverlay` | 多标签设置面板 |
| 事件绑定 | `bindUIEvents` | 全局 UI 事件总线 |

---

## 📂 项目结构（当前）

```
airplane/
└── index.html    ← 唯一源代码文件（CSS + HTML + JS 全包含）
```

### 可扩展为多文件结构（建议）

```
airplane/
├── index.html              ← 入口
├── css/
│   └── style.css           ← 样式
├── js/
│   ├── app.js              ← 启动与全局状态
│   ├── map.js              ← 地图初始化与图层
│   ├── airports.js         ← 机场数据库
│   ├── flight.js           ← 飞行控制与动画
│   ├── seat.js             ← 座位系统
│   ├── scene.js            ← 场景管理
│   ├── ui.js               ← 弹窗/Toast/模态管理
│   ├── storage.js          ← 存储封装
│   ├── settings.js         ← 设置中心
│   └── utils.js            ← 坐标转换/插值/工具函数
└── assets/
    └── icons/              ← 场景 SVG 图标
```

---

## 🎨 设计风格

- **深色主题**：`#1a1a2e` 背景，白色文字，玻璃拟态面板
- **动效系统**：`cubic-bezier(.16,1,.3,1)` 缓出指数 + 弹簧曲线
- **CSS 变量驱动**：`--safe-top/bottom/left/right` 安全区域适配
- **字体栈**：`system-ui` / `-apple-system` / `Segoe UI` / `Microsoft YaHei`

---