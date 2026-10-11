/*
 * 维基资料检查：确认 airportDB 的新字段已正确合并，且详情页能正常渲染。
 * 用法： node tools/tests/wiki-data.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

let fail = 0;
const chk = (n, ok, extra) => {
    console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  ' + extra : ''));
    if (!ok) fail++;
};

// 从源码中解析 airportDB（直接求值，确保与运行期一致）
const m = html.match(/const airportDB = (\[[\s\S]*?\n\];)/);
chk('能定位 airportDB', !!m);
const db = eval(m[1].replace(/;$/, ''));

chk('机场总数为 69', db.length === 69, db.length);
chk('三字码唯一', new Set(db.map(a => a.code)).size === db.length);
chk('坐标均合法', db.every(a =>
    Number.isFinite(a.lat) && Number.isFinite(a.lng) &&
    a.lng > 73 && a.lng < 136 && a.lat > 3 && a.lat < 54));

// 字段完整度
const counts = {
    fullName: db.filter(a => a.fullName).length,
    province: db.filter(a => a.province).length,
    runways: db.filter(a => a.runways).length,
    runwayLength: db.filter(a => a.runwayLength).length,
    elevation: db.filter(a => a.elevation !== undefined && a.elevation !== null && a.elevation !== '').length,
    openedYear: db.filter(a => a.openedYear).length,
    intro: db.filter(a => a.intro).length
};
chk('全称全部录入 (69)', counts.fullName === 69, counts.fullName);
chk('省份全部录入 (69)', counts.province === 69, counts.province);
chk('跑道数量全部录入 (69)', counts.runways === 69, counts.runways);
chk('跑道长度全部录入 (69)', counts.runwayLength === 69, counts.runwayLength);
chk('启用年份全部录入 (69)', counts.openedYear === 69, counts.openedYear);
chk('简介全部录入 (69)', counts.intro === 69, counts.intro);
chk('海拔至少 68 座', counts.elevation >= 68, counts.elevation);

// 数值字段必须是数字类型（不能是字符串，否则详情页拼接会出错）
chk('runways 为数字类型', db.every(a => a.runways === undefined || typeof a.runways === 'number'));
chk('runwayLength 为数字类型', db.every(a => a.runwayLength === undefined || typeof a.runwayLength === 'number'));
chk('elevation 为数字类型', db.every(a => a.elevation === undefined || typeof a.elevation === 'number'));
chk('openedYear 为数字类型', db.every(a => a.openedYear === undefined || typeof a.openedYear === 'number'));

// 数值合理性
const badRunway = db.filter(a => a.runwayLength && (a.runwayLength < 800 || a.runwayLength > 6000));
chk('跑道长度在 800~6000 米', badRunway.length === 0, badRunway.map(a => a.code + ':' + a.runwayLength).join(','));
const badYear = db.filter(a => a.openedYear && (a.openedYear < 1900 || a.openedYear > 2030));
chk('启用年份在 1900~2030', badYear.length === 0, badYear.map(a => a.code + ':' + a.openedYear).join(','));
const badElev = db.filter(a => typeof a.elevation === 'number' && (a.elevation < -200 || a.elevation > 5000));
chk('海拔在 -200~5000 米', badElev.length === 0, badElev.map(a => a.code + ':' + a.elevation).join(','));

// 没有空字符串残留（空值应被省略，而不是写成 ""）
const emptyStr = db.filter(a =>
    ['fullName', 'province', 'intro'].some(k => a[k] === '') ||
    ['runways', 'runwayLength', 'elevation', 'openedYear'].some(k => a[k] === ''));
chk('无空字符串字段残留', emptyStr.length === 0, emptyStr.map(a => a.code).join(','));

// 简介可读性
const intros = db.map(a => a.intro).filter(Boolean);
const minIntro = Math.min(...intros.map(s => s.length));
chk('简介均不少于 30 字', minIntro >= 30, '最短 ' + minIntro + ' 字');
chk('简介无乱码字符', !intros.some(s => /\uFFFD/.test(s)));

console.log(fail === 0 ? '\nRESULT: OK' : '\nRESULT: ' + fail + ' FAILED');
process.exit(fail ? 1 : 0);
