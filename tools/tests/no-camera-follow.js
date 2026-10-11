/*
 * 视角跟随检查：确保"逐帧移动地图"没有被重新引入。
 *
 * 历史问题：flyStep 每帧调用 map.setView() 让视角跟随飞机，
 * 会持续触发瓦片重排/重绘，表现为飞机"一卡一卡、左右摇摆"。
 *
 * 现行设计：
 *   - 默认不跟随，地图完全不动
 *   - 提供手动"回到飞机位置"按钮
 *   - 可选自动跟随，但只在偏离超过阈值时居中，且检查频率被节流
 *
 * 用法： node tools/tests/no-camera-follow.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// 去掉注释后再做残留检查，避免注释里提到的旧函数名造成误报
const code = html
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/[^\n]*$/gm, '');

let fail = 0;
const chk = (n, ok, extra) => {
    console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  ' + extra : ''));
    if (!ok) fail++;
};

// 取出 flyStep 函数体（逐帧执行的代码）。
// 用括号配对提取，而不是依赖固定缩进的正则 —— 否则文件行距一变就会静默匹配到空串，
// 让"逐帧检查"全部假通过。
function extractFunction(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    const open = src.indexOf('{', start);
    if (open === -1) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(open + 1, i);
        }
    }
    return null;
}
const body = extractFunction(html, 'flyStep');
chk('能找到 flyStep 函数', body !== null && body.length > 100,
    body === null ? '未找到' : body.length + ' 字符');

// 1) 逐帧循环内不得直接移动地图
chk('flyStep 内无 map.setView', !/map\.setView/.test(body));
chk('flyStep 内无 map.panTo', !/map\.panTo/.test(body));
chk('flyStep 内无 map.panBy', !/map\.panBy/.test(body));
chk('flyStep 内无 map.setZoom', !/map\.setZoom/.test(body));
chk('flyStep 内无 map.flyTo', !/map\.flyTo/.test(body));
chk('flyStep 内无 map.invalidateSize', !/map\.invalidateSize/.test(body));

// 2) 自动跟随必须被节流（不能每帧检查）
chk('flyStep 内自动跟随带时间节流', /lastFollowCheck/.test(body) && />\s*500/.test(body));
chk('flyStep 内不直接调用 centerOnPlane', !/centerOnPlane\(/.test(body));

// 3) 居中逻辑本身必须有阈值，避免持续重排
chk('存在 FOLLOW_THRESHOLD 阈值', /FOLLOW_THRESHOLD\s*=/.test(html));
const mf = extractFunction(html, 'maybeAutoFollow') || '';
chk('maybeAutoFollow 使用阈值判断', /FOLLOW_THRESHOLD/.test(mf));

// 4) 默认不跟随
chk('autoFollow 默认 false', /autoFollow:\s*false/.test(html));

// 5) UI 按钮已接线
chk('存在"回到飞机位置"按钮', /id="centerOnPlaneBtn"/.test(html));
chk('存在自动跟随开关', /id="toggleFollowBtn"/.test(html));
chk('居中按钮已绑定事件', /getElementById\("centerOnPlaneBtn"\)\.onclick/.test(html));
chk('跟随开关已绑定事件', /getElementById\("toggleFollowBtn"\)\.onclick/.test(html));

// 6) 结束飞行时复位跟随状态
chk('stopAllFlyTask 复位 autoFollow', /autoFollow = false/.test(html));

// 7) 飞机本身仍需逐帧更新（只移动标记，不移动地图）
chk('flyStep 仍更新飞机位置', /setLatLng/.test(body));
chk('flyStep 仍更新机头角度', /rotate\(/.test(body));
chk('机头角度有最短转向处理', /\+ 540\) % 360\) - 180/.test(html));

// 8) 机头旋转不能带 CSS 过渡（会与逐帧赋值互相追赶造成抖动）
chk('plane-icon 无 transform 过渡',
    !/\.plane-icon\{[^}]*transition:[^}]*transform/.test(html));

console.log(fail === 0 ? '\nRESULT: OK' : '\nRESULT: ' + fail + ' FAILED');
process.exit(fail ? 1 : 0);
