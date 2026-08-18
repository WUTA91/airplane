# 🧠 Airplan · 飞行计划 — CodeWiki

> 深度代码分析文档 · 覆盖架构 / 算法 / DOM / CSS / 数据流 / 函数速查

---

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 文件结构](#2-文件结构)
- [3. DOM 架构](#3-dom-架构)
- [4. CSS 设计系统](#4-css-设计系统)
- [5. JavaScript 模块详解](#5-javascript-模块详解)
  - [5.1 存储层](#51-存储层)
  - [5.2 工具函数层](#52-工具函数层)
  - [5.3 全局状态](#53-全局状态)
  - [5.4 地图引擎](#54-地图引擎)
  - [5.5 机场系统](#55-机场系统)
  - [5.6 座位系统](#56-座位系统)
  - [5.7 场景系统](#57-场景系统)
  - [5.8 飞行控制](#58-飞行控制)
  - [5.9 UI 模态管理](#59-ui-模态管理)
  - [5.10 设置中心](#510-设置中心)
  - [5.11 事件总线](#511-事件总线)
- [6. 核心算法解析](#6-核心算法解析)
- [7. 数据流图](#7-数据流图)
- [8. 持久化数据结构](#8-持久化数据结构)
- [9. 函数速查表](#9-函数速查表)
- [10. 启动流程](#10-启动流程)
- [11. 已知问题与扩展建议](#11-已知问题与扩展建议)

---

## 1. 项目概览

**Airplan** 是一个单文件 Web 应用（Single-File Architecture），将「专注计时」与「飞行模拟」结合，所有 HTML / CSS / JavaScript 内联在 `index.html` 中（约 2125 行）。

| 指标 | 数值 |
|------|------|
| 总行数 | ~2125 |
| CSS 行数 | 353 |
| DOM 行数 | 186 |
| JS 行数 | 1542 |
| 函数数量 | 62 |
| 全局状态字段 | ~30 |
| 机场数量 | 69 |
| 专注场景 | 11 预设 + 自定义 |
| 外部依赖 | Leaflet.js 1.9.4 (CDN) |
| 浏览器兼容 | Chrome / Safari / Firefox / Edge |

---

## 2. 文件结构

```
index.html
├── <head>
│   ├── Meta 标签（viewport / charset）
│   ├── <title> — 版本号含在标题中
│   ├── Leaflet CSS (CDN)
│   └── Leaflet JS (CDN)
├── <style>  ← 全部 CSS（353 行）
├── <body>
│   ├── #map ← Leaflet 地图容器
│   ├── .setting-overlay ← 设置背景遮罩
│   ├── .ui-layer ← 所有 UI 浮层（首页/模态/弹窗）
│   ├── .custom-attribution ← 地图版权信息
│   └── <script> ← 全部 JavaScript（1542 行）
```

---

## 3. DOM 架构

### 3.1 层级关系（z-index 体系）

```
z-index  1  → #map（地图底图）
z-index 10  → .ui-layer（所有 UI 浮层）
z-index 20  → .back-btn（返回按钮）/ .airport-modal
z-index 450 → routePane（航线/范围圆 Leaflet pane）
z-index 100 → #toastTip（Toast 提示，动态创建）
```

### 3.2 DOM 树形结构

```
<body>
├── <div id="map">                          ← 地图容器
├── <div class="setting-overlay">           ← 设置遮罩层
│
├─【首页 UI】
├── .ui-layer.top-nav#homeTopNav            ← 顶部导航（起飞/记录/维基/设置）
├── .ui-layer.greet-wrapper#homeGreetWrapper ← 问候语 + 机场信息
└── .ui-layer.left-menu#homeLeftMenu        ← 左侧菜单（准备起飞/飞行计划/排行榜/存档）
│
├─【模态弹窗】（均含 .ui-layer，初始 display:none）
├── #airportModal                           ← 机场选择（时间滑块 + 机场列表 + 搜索）
├── #destSearchPop                          ← 终点机场搜索
├── #seatModal                              ← 座位选择 + 场景面板
├── #addScenePop                            ← 添加自定义场景
├── #ticketModal                            ← 登机牌
├── #takeoffModal                           ← 起飞确认
├── #cruiseModal                            ← 巡航界面（控制按钮 + 图层面板 + 信息面板）
├── #settingPop                             ← 设置中心（账号/飞行设置/关于）
├── #historyPop                             ← 飞行记录
│
├─【动态创建】
├── #toastTip                               ← Toast 提示（JS 动态生成）
│
└── .custom-attribution#customAttribution   ← 地图版权
```

### 3.3 Modal 显隐机制

所有模态弹窗使用 **双状态切换**：

```javascript
// 显示：先设 display，再追加 .show class 触发 CSS 过渡
el.style.display = 'flex' | 'block';
void el.offsetWidth;                    // 强制重绘
el.classList.add('show');

// 移除：先删 .show，等 360ms 过渡结束后再 display:none
el.classList.remove('show');
setTimeout(() => {
    if (!el.classList.contains('show')) el.style.display = 'none';
}, 360);
```

**为什么用 `void el.offsetWidth`？** 强制浏览器在 `display` 变更后、`class` 追加前执行一次重绘（reflow），否则 CSS transition 不会触发。

---

## 4. CSS 设计系统

### 4.1 CSS 变量

```css
:root {
    /* 安全区域（iPhone 刘海/底部横条） */
    --safe-top:    env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left:   env(safe-area-inset-left, 0px);
    --safe-right:  env(safe-area-inset-right, 0px);

    /* 品牌色 */
    --primary:       #ffffff;
    --primary-soft:  rgba(255,255,255,.18);
    --primary-glow:  rgba(255,255,255,.35);
    --bg-dark:       #1a1a2e;
    --panel:         rgba(0,0,0,0.65);

    /* 缓动函数 */
    --ease-out-expo: cubic-bezier(.16, 1, .3, 1);    /* 标准缓出 */
    --ease-spring:   cubic-bezier(.34, 1.56, .64, 1); /* 弹簧回弹 */
}
```

### 4.2 响应式策略

全部使用 `clamp()` 实现无断点自适应，避免媒体查询：

| 元素 | clamp 表达式 |
|------|-------------|
| `.top-nav` 字号 | `clamp(14px, 4vw, 18px)` |
| `.greet-text` | `clamp(22px, 6vw, 32px)` |
| `.menu-btn` 宽度 | `clamp(130px, 38vw, 160px)` |
| `.menu-btn` 内边距 | `clamp(10px, 3vw, 12px) clamp(14px, 4vw, 20px)` |

### 4.3 动画系统

```css
/* 首页 UI 入场 */
.top-nav    → fadeInDown  .6s var(--ease-out-expo)
.greet-wrapper → fadeInLeft .6s var(--ease-out-expo)

/* UI 隐藏（飞行中）*/
.hide-home-ui → opacity:0 + translateY(-14px) + blur(4px)  过渡 .4s

/* 模态弹窗 */
.ui-layer    → 默认 pointer-events:none，子元素 pointer-events:auto
.modal-wrap  → translateY(20px) scale(.98) → translateY(0) scale(1)

/* 导航下划线 hover */
.top-nav span::after → width: 0 → width: 100%  过渡 .25s
```

### 4.4 核心 CSS 类速查

| 类名 | 用途 |
|------|------|
| `.ui-layer` | 所有浮层基础样式（绝对定位 z-index:10 + pointer-events 穿透） |
| `.hide-home-ui` | 飞行中隐藏首页 UI |
| `.show` | 模态弹窗显示态 |
| `.airport-modal` / `.seat-modal` / `.ticket-modal` | 各弹窗专属样式 |
| `.back-btn` | 圆形返回按钮（40×40 半透明） |
| `.menu-btn` | 左侧菜单按钮（毛玻璃） |
| `.scene-btn` | 场景选择按钮 |
| `.seat-box` | 座位格子 |
| `.active` | 选中态（多元素复用） |
| `.range-circle` / `.route-line` | Leaflet 覆盖物自定义样式 |
| `.airport-marker` / `.plane-marker-div` | Leaflet divIcon 容器 |

---

## 5. JavaScript 模块详解

### 5.1 存储层

#### `setStorage(key, val)` / `getStorage(key, def)` — 行 549-555

```javascript
function setStorage(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function getStorage(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch(e) { return def; }
}
```

**设计要点**：
- 统一使用 `JSON.stringify/parse`，直接存对象
- `try/catch` 包裹，兼容隐私模式下 localStorage 不可用的场景
- 读不到或解析失败时返回默认值 `def`

**存储 Key 清单**：

| Key | 类型 | 说明 |
|-----|------|------|
| `startAirCode` | `string \| null` | 当前起飞机场三字码 |
| `hasSetStart` | `boolean` | 是否已设置起飞机场 |
| `userNick` | `string` | 用户昵称 |
| `sceneSave` | `object[]` | 场景列表（预设+自定义） |
| `flyHistory` | `object[]` | 飞行记录数组（最多100条） |
| `defaultMapStyle` | `string` | 默认地图图层 |
| `customTileUrl` | `string` | 自定义瓦片 URL |
| `settingTab` | `string` | 设置页当前标签 |

---

### 5.2 工具函数层

#### `wgs84ToGcj02(lat, lng)` — 行 557-591

**WGS84 → GCJ02 坐标转换**（国家测绘局标准偏移算法）。

```javascript
function wgs84ToGcj02(lat, lng) {
    const a = 6378137.0;          // 地球长半径
    const ee = 0.006693421622965943; // 第一偏心率平方
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    // ... 计算偏移量并返回 [lat + dLat, lng + dLng]
}
```

**调用时机**：
- 地图图层为高德（卫星/路网）时，所有机场坐标需转为 GCJ02
- 地图图层为 OSM / 自定义时，使用原始 WGS84 坐标
- 切换图层时触发 `rerenderAllGeoElements()` 批量重绘

#### `toMapCoord(lat, lng)` — 行 585-590

坐标系统一入口：

```javascript
function toMapCoord(lat, lng) {
    if (globalState.currentCoordSystem === 'gcj02') {
        return wgs84ToGcj02(lat, lng);
    }
    return [lat, lng];
}
```

#### `debounce(fn, wait=250)` / `throttle(fn, limit=120)` — 行 592-607

```javascript
// 防抖：最后一次触发后等待 wait 毫秒执行
// 用于：搜索框输入（200ms）
function debounce(fn, wait=250) { /* ... */ }

// 节流：limit 毫秒内最多执行一次
// 用于：时间滑块 input（120ms）
function throttle(fn, limit=120) { /* ... */ }
```

#### `randomFlightNumber()` — 行 610-616

生成随机航班号：`AA1234` 格式（2 字母 + 4 数字）。

---

### 5.3 全局状态

#### `globalState` 对象 — 行 730-763

```javascript
let globalState = {
    // 机场与航线
    initAirport: airportDB.find(a => a.code === "PEK"),  // 默认初始机场（北京首都）
    startAir: null,       // 起飞机场对象
    endAir: null,         // 目的机场对象
    startAirCode: null,   // 起飞机场三字码（持久化用）

    // 座位与场景
    selectSeat: null,     // 选中座位号（如 "12A"）
    currScene: baseSceneList[0],  // 当前专注场景
    currSceneColor: sceneColorMap[baseSceneList[0].cls], // 场景颜色

    // 飞行参数
    flyMin: 60,           // 飞行分钟数
    flyKmPerMin: 13.33,   // 速度 = 800km/h ÷ 60
    totalKm: 0,           // 总距离
    remainMin: 0,         // 剩余分钟
    doneKm: 0,            // 已飞行距离

    // 飞行状态
    flyTimer: null,       // setInterval 引用（已弃用，改用 rAF）
    isFlyPause: false,    // 是否暂停
    isFlying: false,      // 是否飞行中
    userInteracting: false,// 用户是否正在拖拽地图

    // 地图对象
    map: null,            // Leaflet Map 实例
    currentTile: null,    // 当前瓦片图层
    currentCoordSystem: 'gcj02', // 当前坐标系
    rangeCircle: null,    // 范围圆 Leaflet 对象
    routeLine: null,      // 航线 Leaflet 对象
    planeMarker: null,    // 飞机标记 Leaflet 对象
    airportMarkers: [],   // 机场标记数组
    routePane: null,      // 自定义 Leaflet pane（z-index:450）
    customTileUrl: '',    // 自定义瓦片 URL
    defaultMapStyle: 'sat', // 默认地图样式

    // UI 状态
    showLabels: true,     // 是否显示标注
    hasSetStart: false,   // 是否已设置起飞机场
    activeModals: [],     // 当前活动模态（未使用）
    planePos: { lat: 0, lng: 0 }, // 飞机当前坐标
    flyStartTime: 0,      // 飞行开始时间戳
    flyElapsedSeconds: 0  // 已飞行秒数
};
```

#### 其他全局变量

```javascript
let flyHistory = [];           // 飞行记录数组
const MAX_HISTORY = 100;       // 最大记录数
let userSceneList = [];        // 用户自定义场景列表
let userNick = "请输入昵称";    // 用户昵称
const MAX_SCENE_NUM = 14;      // 最大场景数
let map;                       // Leaflet Map 引用
let amapSat, amapSatLabel, amapRoad, osmLayer, customLayer; // 瓦片图层
let flyAnimId = null;          // requestAnimationFrame ID
let lastFlyTime = 0;           // 上一帧时间戳
let toastTimer = null;         // Toast 定时器
```

---

### 5.4 地图引擎

#### `initMap()` — 行 928-971

**初始化流程**：

```
1. 检查 Leaflet 是否加载 → 否则 alert
2. 创建 5 种瓦片图层：
   - amapSat      高德卫星影像
   - amapSatLabel 高德标注层（半透明叠加）
   - amapRoad     高德路网
   - osmLayer     OpenStreetMap
   - customLayer  自定义（延迟创建）
3. 创建 Leaflet Map 实例（禁用默认 zoomControl 和 attributionControl）
4. 创建自定义 pane 'routePane'（z-index:450，用于航线和范围圆）
5. 从 localStorage 读取默认样式 → switchLayer()
6. 延迟 300ms 调用 map.invalidateSize()（解决容器尺寸未就绪）
7. renderAllAirportMarker() → 渲染所有机场标记
8. bindUIEvents() → 绑定所有 UI 事件
9. updateHomeAirportInfo() → 更新首页机场信息
```

#### `switchLayer(type)` — 行 973-1029

**图层切换逻辑**：

| type 值 | 瓦片源 | 坐标系 | 标注 | 备注 |
|---------|--------|--------|------|------|
| `'sat'` | 高德卫星 | GCJ02 | 有 | 默认 |
| `'satLabel'` | 高德卫星 | GCJ02 | 有 | 与 sat 完全一致，UI 中不可达 |
| `'road'` | 高德路网 | GCJ02 | 无 | |
| `'osm'` | OpenStreetMap | WGS84 | 无 | UI 中不可达 |
| `'custom'` | 用户自定义 URL | WGS84 | 无 | |

**关键行为**：
- 切换时若坐标系变化 → 调用 `rerenderAllGeoElements()` 批量更新所有覆盖物位置
- 自定义图层若 URL 为空 → toast 提示并直接返回（保持当前图层不变）
- 飞行中隐藏 `satLabel` 和 `osm` 选项（但图层面板中实际不存在这两项，该代码为死代码）
- **注意**：`satLabel` 分支与 `sat` 完全一致，且不在 UI 图层面板中，属于不可达代码
- **注意**：图层面板 HTML 仅定义了 3 项（`sat` / `road` / `custom`），`satLabel` 和 `osm` 并不存在

#### `renderAllAirportMarker()` — 行 1094-1127

遍历 `airportDB`，为每个机场创建 `L.marker`（使用 `L.divIcon` 自定义 HTML 标记）。

**标记结构**：
```html
<div class="airport-marker">
    <span>PEK</span>
</div>
```

**点击逻辑**：
- 飞行中 → toast 拒绝
- 未设置起点 → `selectStartAirport()` 设为起点
- 已设置起点且点击的是起点 → toast 提示
- 已设置起点且点击的是其他机场 → toast 提示"起点已固定"

#### `showFlightAirportMarkers()` — 行 1135-1149

飞行中只显示起点和终点的机场标记，隐藏其余。

---

### 5.5 机场系统

#### `filterAirportByRange(min, keyword='')` — 行 1182-1223

**核心筛选逻辑**：

```
输入：min（分钟）, keyword（搜索词）
  │
  ├─ 有 keyword → 忽略时间范围，按三字码/城市名匹配
  │
  └─ 无 keyword → 按时间范围筛选（±10分钟）
      maxKm = (min + 10) × 13.33
      minKm = Math.max(0, (min - 10) × 13.33)
      筛选距离在 [minKm, maxKm] 内的机场
```

**输出**：动态生成机场列表 DOM（`.airport-list-item`），显示三字码、名称、预计分钟、距离。

#### `selectStartAirport(airObj)` — 行 1225-1236

设置起飞机场并持久化：
```javascript
globalState.startAir = airObj;
globalState.hasSetStart = true;
globalState.startAirCode = airObj.code;
setStorage('startAirCode', airObj.code);
setStorage('hasSetStart', true);
updateRangeCircle(globalState.flyMin);  // 绘制范围圆
filterAirportByRange(globalState.flyMin); // 刷新列表
```

#### `confirmDestAir(endAir)` — 行 1256-1277

确认终点机场：
```javascript
globalState.endAir = endAir;
globalState.totalKm = getDistance(start, end);
globalState.remainMin = Math.max(1, Math.ceil(totalKm / 13.33));
drawRouteLine();          // 绘制航线
renderAllSeat();          // 渲染座位图
renderSceneList();        // 渲染场景列表
```

#### `getDistance(lat1,lng1,lat2,lng2)` — 行 1167-1173

**Haversine 公式**计算球面距离：

```javascript
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;  // 地球半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2)
            + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
            * Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
```

#### `updateRangeCircle(minute)` — 行 1151-1165

以起飞机场为圆心，`minute × 13.33 km` 为半径绘制范围圆，并自动 `fitBounds` 调整地图视图。

---

### 5.6 座位系统

#### `renderAllSeat()` — 行 1279-1303

动态生成 30 排 × 4 列座位图：

```
每排结构：
┌────┬────┬────┬────┬────┐
│ 1A │ 1C │ 01 │ 1D │ 1F │
└────┴────┴────┴────┴────┘
  ↑    ↑     ↑    ↑    ↑
seat  seat  行号  seat  seat
```

每个座位是 `<div class="seat-box" data-seat="1A">`，内含一个隐藏的 `<span class="seat-icon">` 用于显示场景图标。

#### `clickSeat(seatId)` — 行 1345-1349

选中座位 → 显示场景选择面板（`.scene-pop`）。

#### `highlightSelectedSeat()` — 行 1305-1332

更新座位图状态：
- 清除所有座位的 `.active` 类和背景色
- 为选中座位添加 `.active` 和场景背景色
- 显示/隐藏座位上的场景图标
- 更新座位号显示（`#currSeatNum`）

---

### 5.7 场景系统

#### 数据结构

```javascript
// 预设场景（11 种）
const baseSceneList = [
    { name: "学习", cls: "tag-study", icon: '<svg>...</svg>' },
    { name: "工作", cls: "tag-work", icon: '<svg>...</svg>' },
    // ... 共 11 个
];

// 场景颜色映射
const sceneColorMap = {
    "tag-study": "#207830",
    "tag-work":  "#184477",
    // ... 11 种颜色
};

// 用户自定义场景（持久化）
let userSceneList = [];
```

#### `renderSceneList()` — 行 1366-1422

渲染场景网格：
- 先渲染用户自定义场景（可删除）
- 再渲染预设场景
- 选中态使用 `.selected` class
- 自定义场景有 `×` 删除按钮

#### 自定义场景流程

```
点击 "+" → openAddScenePop()
  → 显示预设图标选择器（.presetSceneRow）
  → 用户选择图标 + 输入名称
  → saveCustomScene()
      → 检查名称唯一性
      → 随机分配一个 cls（颜色）
      → 追加到 userSceneList
      → setStorage("sceneSave", userSceneList)
      → renderSceneList() 刷新
```

---

### 5.8 飞行控制

#### `startFlyTimer()` — 行 1457-1531

**核心动画引擎**：

```
1. 清理旧动画（cancelAnimationFrame + clearInterval）
2. 计算参数：
   - totalSeconds = remainMin × 60
   - stepKmPerSecond = totalKm / totalSeconds
3. 记录起始坐标（GCJ02 转换后）
4. 声明局部变量 prevTime = performance.now()
5. 启动 requestAnimationFrame 循环
```

#### `flyStep(timestamp)` — 行 1481-1531

**每帧执行**：

```javascript
function flyStep(timestamp) {
    if (globalState.isFlyPause) { /* 跳过 */ return; }

    const delta = (timestamp - prevTime) / 1000;  // 秒
    prevTime = timestamp;

    if (delta > 0.5) return;  // 防止切后台后跳帧

    // 1. 更新已飞距离
    globalState.doneKm += stepKmPerSecond * delta;
    globalState.flyElapsedSeconds += delta;

    // 2. 更新 UI（剩余里程 / 剩余时间 / 已飞时间 / 已飞里程）
    remainKm = totalKm - doneKm;
    currMin = Math.ceil(remainKm / 13.33);
    document.getElementById("leftKm").innerText = Math.round(remainKm);
    document.getElementById("rightMin").innerText = currMin;

    // 3. 计算飞机位置（Slerp 球面插值）
    ratio = doneKm / totalKm;
    target = slerp(startLat, startLng, endLat, endLng, ratio);
    globalState.planePos = { lat: target.lat, lng: target.lng };

    // 4. 更新飞机标记位置和朝向
    planeMarker.setLatLng([lat, lng]);
    planeIcon.style.transform = `rotate(${bearing}deg)`;

    // 5. 地图跟随（用户未交互时）
    if (!userInteracting) {
        map.setView([lat, lng], map.getZoom(), { animate: false });
    }

    // 6. 检查是否到达
    if (doneKm >= totalKm) { finishFlight(); return; }

    flyAnimId = requestAnimationFrame(flyStep);
}
```

#### `slerp(lat1, lng1, lat2, lng2, t)` — 行 1424-1444

**球面大地线插值**（Spherical Linear Interpolation）：

```javascript
function slerp(lat1, lng1, lat2, lng2, t) {
    // 1. 转为弧度
    // 2. 计算中心角 d = arccos(cosD)
    // 3. 若 d < 1e-8 → 退化为线性插值
    // 4. 否则按球面插值公式计算：
    //    a = sin((1-t)·d) / sin(d)
    //    b = sin(t·d) / sin(d)
    //    x = a·cos(lat1)·cos(lng1) + b·cos(lat2)·cos(lng2)
    //    y = a·cos(lat1)·sin(lng1) + b·cos(lat2)·sin(lng2)
    //    z = a·sin(lat1) + b·sin(lat2)
    //    lat = atan2(z, sqrt(x²+y²))
    //    lng = atan2(y, x)
    return { lat, lng };
}
```

**为什么用 Slerp 而不是线性插值？** 因为飞机沿地球表面飞行，经纬度线性插值在长距离时路径会凹入地球内部，Slerp 保证路径始终在大圆上。

#### `finishFlight()` — 行 1556-1565

```javascript
function finishFlight() {
    cancelAnimationFrame(flyAnimId);
    globalState.isFlying = false;
    toast("航班顺利降落！");
    saveFlightRecord('completed');  // 保存记录
    stopAllFlyTask();              // 清理所有飞行资源
    hideModal('cruiseModal');
}
```

#### `stopAllFlyTask()` — 行 1567-1617

**清理清单**：
- 取消 rAF 和 interval
- 重置飞行状态标志
- 移除地图覆盖物（航线、范围圆、飞机标记）
- 若飞行中断（未到达）→ 保存 `interrupted` 记录
- 重置所有飞行相关状态字段
- 恢复首页 UI 和机场标记

---

### 5.9 UI 模态管理

#### `closeAllModals(except)` — 行 865-878

```javascript
const allModals = [
    'airportModal', 'seatModal', 'ticketModal',
    'takeoffModal', 'cruiseModal', 'destSearchPop',
    'addScenePop', 'settingPop', 'historyPop'
];
```

遍历所有模态，关闭除 `except` 外的全部弹窗。

#### `showModal(id)` / `hideModal(id)` — 行 881-907

**显示流程**：
1. `closeAllModals(id)` — 关闭其他弹窗
2. 设置 `display`（flex 或 block）
3. `void el.offsetWidth` — 强制重绘
4. `classList.add('show')` — 触发过渡动画
5. 更新地图版权可见性
6. 若为设置弹窗 → 显示遮罩层

**隐藏流程**：
1. `classList.remove('show')`
2. 360ms 后检查是否仍无 `.show` → 设 `display:none`
3. 刷新版权可见性

#### `toast(msg)` — 行 910-926

动态创建 `#toastTip` 元素，居中显示，2 秒后淡出。

---

### 5.10 设置中心

#### `renderSettingContent(tab)` — 行 1649-1752

**三个标签页**：

| Tab | 内容 |
|-----|------|
| `account` | 昵称编辑、账户状态、剩余次数、重置起飞机场 |
| `flyset` | 巡航速度（只读）、默认地图样式选择、自定义瓦片 URL |
| `about` | 版本号、制作团队、数据源、机场数量 |

**动态渲染模式**：每次切换 tab 时重新 `innerHTML` 生成内容，然后重新绑定事件监听器。

---

### 5.11 事件总线

#### `bindUIEvents()` — 行 1768-2088

**集中绑定所有 UI 事件**，分为以下区域：

| 区域 | 事件 | 处理器 |
|------|------|--------|
| 时间滑块 | `input` (throttle 120ms) | 更新范围圆 + 机场列表 |
| 确认选座 | `click` | 显示登机牌 |
| 准备登机 | `click` | 显示起飞确认 |
| 出发 | `click` | 进入巡航 |
| 暂停/继续 | `click` | 切换飞行状态 |
| 缩放 | `click` | map.zoomIn/Out |
| 图层面板 | `click` | switchLayer |
| 结束飞行 | `click` | confirm → stopAllFlyTask |
| 返回按钮 | `click` | hideModal |
| 搜索框 | `input` (debounce 200ms) | filterAirportByRange |
| 设置标签 | `click` | renderSettingContent |
| 添加场景 | `click` | 显示预设图标选择器 |
| 保存场景 | `click` | 验证 + 追加到 userSceneList |
| 地图交互 | `dragstart/zoomstart` | setUserInteracting |
| 窗口 resize | `debounce 250ms` | map.invalidateSize |

---

## 6. 核心算法解析

### 6.1 WGS84 → GCJ02 坐标转换

**原理**：国家测绘局（GCJ-02「火星坐标系」）对 WGS84 坐标施加非线性偏移。

**算法步骤**：
1. 计算经纬度相对于参考点 (105°E, 35°N) 的偏移
2. 通过 `transformLat` / `transformLng` 计算偏移量（含三角函数和多项式）
3. 根据地球曲率参数修正
4. 返回偏移后的坐标

**精度**：在中国大陆范围内误差 < 100 米，满足地图显示需求。

### 6.2 Haversine 距离计算

**公式**：
```
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
d = 2R · atan2(√a, √(1-a))
```

**精度**：球面距离，误差约 0.3%（地球非完美球体），对于本应用的「估算飞行时间」场景完全足够。

### 6.3 Slerp 球面插值

**原理**：在单位球面上，沿两点间的大圆弧进行匀速插值。

**关键公式**：
```
d = arccos(cosD)          // 中心角
a = sin((1-t)·d) / sin(d) // 起点权重
b = sin(t·d) / sin(d)     // 终点权重
```

**退化处理**：当 `d < 1e-8` 时（两点极近），退化为线性插值避免除零。

### 6.4 机场筛选算法

```
输入：时间（分钟）, 搜索词
  │
  ├─ 有搜索词 → 全库匹配（三字码/城市名包含）
  │
  └─ 无搜索词 → 距离范围筛选
      速度 = 13.33 km/min
      最大距离 = (时间 + 10) × 速度
      最小距离 = Math.max(0, (时间 - 10) × 速度)
      筛选 + 按距离排序
```

**±10 分钟缓冲**：确保用户调整滑块时列表不会频繁变化。

---

## 7. 数据流图

### 7.1 航线选择流程

```
用户点击机场标记
    │
    ▼
selectStartAirport(airObj)
    ├─ 更新 globalState.startAir
    ├─ setStorage('startAirCode')
    ├─ updateRangeCircle() → 绘制范围圆 + fitBounds
    └─ filterAirportByRange() → 渲染机场列表
          │
          ▼
    用户选择终点 / 搜索终点
          │
          ▼
    confirmDestAir(endAir)
        ├─ 计算 totalKm (Haversine)
        ├─ 计算 remainMin
        ├─ drawRouteLine() → 绘制航线
        ├─ renderAllSeat() → 渲染座位图
        └─ renderSceneList() → 渲染场景列表
```

### 7.2 飞行流程

```
用户点击 "出发!"
    │
    ▼
enterCruiseBtn.onclick
    ├─ hideModal('takeoffModal')
    ├─ showModal('cruiseModal')
    ├─ hideAllHomeUI()
    ├─ globalState.isFlying = true
    ├─ showFlightAirportMarkers()
    ├─ drawPlaneMarker()
    └─ startFlyTimer()
          │
          ▼
      requestAnimationFrame 循环
          │
          ├─ 每帧：更新 doneKm → Slerp 计算位置 → 更新标记
          │
          └─ doneKm >= totalKm → finishFlight()
                ├─ saveFlightRecord('completed')
                ├─ stopAllFlyTask()
                └─ hideModal('cruiseModal')
```

### 7.3 持久化流

```
                    ┌──────────────┐
                    │ localStorage │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   startAirCode       sceneSave          flyHistory
   hasSetStart        userNick
   defaultMapStyle    settingTab
   customTileUrl
        │                  │                  │
        ▼                  ▼                  ▼
   启动时读取          启动时读取          飞行结束时写入
   initMap()          window.onload       saveFlightRecord()
```

---

## 8. 持久化数据结构

### 8.1 飞行记录

```typescript
interface FlightRecord {
    start: string;      // 起点三字码 "PEK"
    startName: string;  // 起点名称 "北京首都"
    end: string;        // 终点三字码 "DLC"
    endName: string;    // 终点名称 "大连周水子"
    totalKm: number;    // 总距离（四舍五入）
    minutes: number;    // 飞行分钟数
    time: string;       // 完成时间 "14:32"
    status: 'completed' | 'interrupted';
}
```

### 8.2 场景数据

```typescript
interface Scene {
    name: string;   // 场景名称
    cls: string;    // CSS 类名（决定颜色）
    icon: string;   // SVG 图标字符串
}
```

### 8.3 存储 Key 完整清单

| Key | 类型 | 默认值 | 写入时机 |
|-----|------|--------|----------|
| `startAirCode` | `string \| null` | `null` | 选择起飞机场 |
| `hasSetStart` | `boolean` | `false` | 选择起飞机场 |
| `userNick` | `string` | `"请输入昵称"` | 昵称失焦 |
| `sceneSave` | `Scene[]` | `[...baseSceneList]` | 添加/删除场景 |
| `flyHistory` | `FlightRecord[]` | `[]` | 飞行结束/中断 |
| `defaultMapStyle` | `string` | `"sat"` | 设置变更 |
| `customTileUrl` | `string` | `""` | 设置变更 |
| `settingTab` | `string` | `"account"` | 切换标签 |

---

## 9. 函数速查表

| 函数 | 行号 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| `setStorage` | 549 | key, val | void | localStorage 写入 |
| `getStorage` | 552 | key, def | any | localStorage 读取 |
| `wgs84ToGcj02` | 557 | lat, lng | [lat, lng] | 坐标偏移转换 |
| `transformLat` | 570 | x, y | number | 纬度偏移分量 |
| `transformLng` | 577 | x, y | number | 经度偏移分量 |
| `toMapCoord` | 585 | lat, lng | [lat, lng] | 坐标系自适应 |
| `debounce` | 592 | fn, wait | function | 防抖 |
| `throttle` | 599 | fn, limit | function | 节流 |
| `randomFlightNumber` | 610 | - | string | 随机航班号 |
| `loadHistory` | 768 | - | void | 加载飞行记录 |
| `saveHistory` | 771 | - | void | 保存飞行记录 |
| `renderHistory` | 774 | - | void | 渲染飞行记录列表 |
| `hideAllHomeUI` | 795 | - | void | 隐藏首页 UI |
| `showAllHomeUI` | 798 | - | void | 显示首页 UI |
| `updateGreetText` | 802 | - | void | 更新问候语 |
| `getNowHM` | 815 | - | string | 获取 HH:MM |
| `getNowDateStr` | 819 | - | string | 获取 DDMMM |
| `updateHomeAirportInfo` | 825 | - | void | 更新首页机场信息 |
| `setAttributionVisible` | 843 | visible | void | 设置版权可见性 |
| `updateAttributionMode` | 848 | - | void | 更新版权样式模式 |
| `refreshAttributionVisibility` | 855 | - | void | 刷新版权显示状态 |
| `closeAllModals` | 865 | except | void | 关闭所有弹窗 |
| `showModal` | 881 | id | void | 显示弹窗 |
| `hideModal` | 895 | id | void | 隐藏弹窗 |
| `toast` | 910 | msg | void | Toast 提示 |
| `initMap` | 928 | - | void | 初始化地图 |
| `switchLayer` | 973 | type | void | 切换地图图层 |
| `updateAirportMarkersPosition` | 1031 | - | void | 更新机场标记位置 |
| `rerenderAllGeoElements` | 1040 | - | void | 重绘所有地理元素 |
| `drawRouteLine` | 1057 | - | void | 绘制航线 |
| `getBearing` | 1068 | lat1,lng1,lat2,lng2 | number | 计算方位角 |
| `getRouteBearing` | 1076 | - | number | 当前航线方位角 |
| `createPlaneMarker` | 1082 | lat, lng | L.marker | 创建飞机标记 |
| `renderAllAirportMarker` | 1094 | - | void | 渲染所有机场标记 |
| `hideAirportMarkers` | 1129 | - | void | 隐藏机场标记 |
| `showAirportMarkers` | 1132 | - | void | 显示机场标记 |
| `showFlightAirportMarkers` | 1135 | - | void | 仅显示起/终点标记 |
| `updateRangeCircle` | 1151 | minute | void | 更新范围圆 |
| `getDistance` | 1167 | lat1,lng1,lat2,lng2 | number | Haversine 距离 |
| `getAirportMinutes` | 1175 | air | number | 计算机场飞行时间 |
| `filterAirportByRange` | 1182 | min, keyword | void | 筛选机场列表 |
| `selectStartAirport` | 1225 | airObj | void | 选择起飞机场 |
| `openDestSearch` | 1238 | targetAir | void | 打开终点搜索 |
| `confirmDestAir` | 1256 | endAir | void | 确认终点机场 |
| `renderAllSeat` | 1279 | - | void | 渲染座位图 |
| `highlightSelectedSeat` | 1305 | - | void | 高亮选中座位 |
| `updateSceneIconDisplay` | 1343 | - | void | 更新场景图标显示 |
| `clickSeat` | 1345 | seatId | void | 点击座位 |
| `updateSelectedSeatColor` | 1351 | - | void | 更新座位颜色 |
| `renderSceneList` | 1366 | - | void | 渲染场景列表 |
| `slerp` | 1424 | lat1,lng1,lat2,lng2, t | {lat,lng} | 球面插值 |
| `drawPlaneMarker` | 1446 | - | void | 绘制飞机标记 |
| `startFlyTimer` | 1457 | - | void | 启动飞行计时 |
| `flyStep` | 1481 | timestamp | void | 飞行动画帧 |
| `updateCruiseDisplay` | 1533 | - | void | 更新巡航显示 |
| `saveFlightRecord` | 1540 | status | void | 保存飞行记录 |
| `finishFlight` | 1556 | - | void | 完成飞行 |
| `stopAllFlyTask` | 1567 | - | void | 停止所有飞行任务 |
| `generateBarcodeCanvas` | 1619 | canvasId, text | void | 生成条形码（HTML 中无对应 canvas 元素，实际不执行） |
| `renderSettingContent` | 1649 | tab | void | 渲染设置内容 |
| `showSettingWithOverlay` | 1754 | - | void | 显示设置弹窗 |
| `hideSettingWithOverlay` | 1763 | - | void | 隐藏设置弹窗 |
| `bindUIEvents` | 1768 | - | void | 绑定所有 UI 事件 |
| `handleTakeoff` | 1935 | - | void | 处理起飞按钮 |
| `setUserInteracting` | 1849 | - | void | 标记用户交互中（嵌套于 bindUIEvents 内部） |

---

## 10. 启动流程

```
window.onload
    │
    ├─ 1. userSceneList = getStorage("sceneSave", [...baseSceneList])
    ├─ 2. userNick = getStorage("userNick", "请输入昵称")
    ├─ 3. loadHistory()
    ├─ 4. globalState.hasSetStart = getStorage('hasSetStart', false)
    ├─ 5. globalState.startAirCode = getStorage('startAirCode', null)
    ├─ 6. 若有 startAirCode → 从 airportDB 查找并设置 globalState.startAir
    │
    ├─ 7. homeUiList.push(...)  ← 收集首页 UI 元素
    │
    ├─ 8. updateGreetText()     ← 立即更新问候语
    ├─ 9. setInterval(updateGreetText, 60000)  ← 每分钟刷新
    │
    └─ 10. initMap()
            │
            ├─ 创建瓦片图层
            ├─ 创建 Leaflet Map
            ├─ 创建 routePane
            ├─ switchLayer(defaultStyle)
            ├─ setTimeout(map.invalidateSize, 300)
            ├─ renderAllAirportMarker()
            ├─ bindUIEvents()
            └─ updateHomeAirportInfo()
```

---

## 11. 已知问题与扩展建议

### 11.1 代码层面

| 问题 | 位置 | 建议 |
|------|------|------|
| `nickEditInput` 事件绑定重复 | 行 1673 + 2019 | 合并为一次绑定 |
| `activeModals` 数组声明但未使用 | globalState | 移除或实现模态栈 |
| `flyTimer` 已弃用（改用 rAF） | globalState | 移除该字段 |
| `lastFlyTime` 声明但未使用 | 行 | 移除 |
| 设置页每次切换 tab 都 innerHTML 重建 | renderSettingContent | 可改为 display 切换 |
| 登机牌条形码 | ticket-modal | `generateBarcodeCanvas` 在 HTML 中找不到 `<canvas id="barcodeCanvas">`，函数静默退出；实际显示的是硬编码 SVG 静态条形码 |
| `switchLayer` 的 `satLabel` 分支 | 行 990 | 与 `sat` 完全一致且不在 UI 图层面板中，属于不可达代码 |
| 飞行中图层隐藏逻辑 | 行 1823 | 隐藏 `satLabel` 和 `osm` 的代码是死代码（DOM 中不存在这两项） |

### 11.2 架构层面

| 建议 | 说明 |
|------|------|
| 拆分多文件 | CSS / HTML / JS 分离，便于维护 |
| 引入构建工具 | Vite / Webpack 支持模块化 |
| TypeScript | 为 globalState 和函数添加类型 |
| 单元测试 | 坐标转换、距离计算、Slerp 可独立测试 |
| 场景颜色分配 | 当前随机分配 cls，应改为用户选择 |
| 飞行曲线 | 可加入起飞/降落阶段的变速动画 |
| 音效系统 | 起飞提示音、降落提示音 |
| 离线支持 | Service Worker + PWA |

### 11.3 功能扩展

| 功能 | 实现思路 |
|------|----------|
| 飞行计划 | 多段航线（中转飞行） |
| 排行榜 | 后端 + 数据库，按里程/时长排名 |
| 存档系统 | 导出/导入 JSON 数据 |
| 天气系统 | 接入天气 API，影响飞行参数 |
| 飞机模型 | 多种机型选择（速度/座位布局不同） |
| 夜间模式 | 地图瓦片切换为暗色主题 |

---

> 📌 **文档版本**：V1.0 · 对应项目版本 V1.2.1.3Beta2  
> 📌 **生成日期**：2026-08-18  
> 📌 **分析工具**：人工代码审查
