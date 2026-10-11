/*
 * 条形码几何检查：确认生成的是密集细条，而不是粗黑块。
 * 用法： node tools/tests/barcode.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const rx = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [...html.matchAll(rx)].map(m => m[1]);
const src = blocks[blocks.length - 1];

const start = src.indexOf('const CODE128_PATTERNS');
const end = src.indexOf('// ========== 机场维基');
const code = src.slice(start, end);

const mod = eval('(function(){' + code +
    '\n;return {barcodeModules:barcodeModules, drawBarcodeSvg:drawBarcodeSvg, CODE128_PATTERNS:CODE128_PATTERNS};})()');

let fail = 0;
const chk = (n, ok, extra) => {
    console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  ' + extra : ''));
    if (!ok) fail++;
};

// 1) Code128 模式表合法性
//    索引 0..105 = 6 段 11 模块；索引 106（终止符）= 7 段 13 模块，为标准规定的例外
const dataPats = mod.CODE128_PATTERNS.slice(0, 106);
const badPat = dataPats.filter(p => {
    const d = p.split('').map(Number);
    return d.length !== 6 || d.reduce((a, b) => a + b, 0) !== 11;
});
chk('数据模式(0..105)均为 6 段 11 模块', badPat.length === 0, badPat.join(','));
const stop = mod.CODE128_PATTERNS[106];
chk('终止符为 7 段 13 模块',
    stop.length === 7 && stop.split('').map(Number).reduce((a, b) => a + b, 0) === 13, stop);
chk('模式表条目数 = 107', mod.CODE128_PATTERNS.length === 107, mod.CODE128_PATTERNS.length);

// 2) 模块序列结构（与实际调用一致：航班号+座位）
const payload = 'CZ8888' + '12A';
const bits = mod.barcodeModules(payload);
chk('以黑色起始条开头', bits[0] === '1');
chk('以黑色终止条结尾', bits[bits.length - 1] === '1');
chk('只含 0/1', /^[01]+$/.test(bits));
chk('黑白模块都非空', bits.includes('1') && bits.includes('0'));
// 11*(字符数+起始+校验+终止) + 终止符额外的 2 模块
chk('模块总数符合 Code128 长度', bits.length === 11 * (payload.length + 3) + 2, bits.length);

// 3) 确定性
chk('同一输入结果稳定', mod.barcodeModules('CZ8888') === mod.barcodeModules('CZ8888'));
chk('不同输入结果不同', mod.barcodeModules('CZ8888') !== mod.barcodeModules('CZ8889'));

// 4) 渲染几何：必须是细条密集
const fake = { _inner: '', viewBox: '' };
Object.defineProperty(fake, 'innerHTML', {
    get() { return this._inner; }, set(v) { this._inner = v; }
});
fake.setAttribute = function (k, v) { if (k === 'viewBox') this.viewBox = v; };
global.document = { getElementById: (id) => (id === 'ticketBarcode' ? fake : null) };

mod.drawBarcodeSvg('ticketBarcode', payload, 'CZ8888  12A');
const out = fake.innerHTML;

const widths = [...out.matchAll(/<rect x="[\d.]+" y="4" width="([\d.]+)"/g)].map(m => parseFloat(m[1]));
chk('生成了多根条 (>=25)', widths.length >= 25, widths.length + ' 根');
chk('无 NaN/Infinity', !/NaN|Infinity/.test(out));
chk('包含底部可读文字', /<text[^>]*>CZ8888  12A<\/text>/.test(out));

const wMin = Math.min(...widths), wMax = Math.max(...widths);
const wAvg = widths.reduce((a, b) => a + b, 0) / widths.length;
// moduleW 上限为 2.2px，故 1 模块宽的条最粗也就是 2.2px
chk('最细条 <= 2.2px', wMin <= 2.2 + 1e-6, wMin.toFixed(2) + 'px');
chk('平均条宽 < 4px', wAvg < 4, wAvg.toFixed(2) + 'px');
chk('粗细比 <= 5x', wMax / wMin <= 5, (wMax / wMin).toFixed(2) + 'x');

// 5) 不越界，且应横向铺开而不是缩在中间
const xs = [...out.matchAll(/<rect x="([\d.]+)" y="4" width="([\d.]+)"/g)]
    .map(m => ({ x: parseFloat(m[1]), w: parseFloat(m[2]) }));
const left = Math.min(...xs.map(o => o.x));
const right = Math.max(...xs.map(o => o.x + o.w));
chk('左边缘不越界', left >= 0, left.toFixed(2));
chk('右边缘不超 380', right <= 380, right.toFixed(2));
chk('条码横向铺开 (>60% 宽度)', (right - left) > 380 * 0.6, (right - left).toFixed(0) + 'px');

// 6) 极端输入
const mk = () => {
    const o = { _i: '' };
    Object.defineProperty(o, 'innerHTML', { get() { return this._i; }, set(v) { this._i = v; } });
    o.setAttribute = () => {};
    return o;
};
const e1 = mk(); global.document = { getElementById: () => e1 };
mod.drawBarcodeSvg('ticketBarcode', '', '');
chk('空输入不产生 NaN', !/NaN|Infinity/.test(e1.innerHTML));

const e2 = mk(); global.document = { getElementById: () => e2 };
mod.drawBarcodeSvg('ticketBarcode', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'LONG');
chk('超长输入不产生 NaN', !/NaN|Infinity/.test(e2.innerHTML));
const w2 = [...e2.innerHTML.matchAll(/width="([\d.]+)"/g)].map(m => parseFloat(m[1])).slice(1);
chk('超长输入下条仍可见 (>=0.6px)', Math.min(...w2) >= 0.6, Math.min(...w2).toFixed(2) + 'px');

console.log(fail === 0 ? '\nRESULT: OK' : '\nRESULT: ' + fail + ' FAILED');
process.exit(fail ? 1 : 0);
