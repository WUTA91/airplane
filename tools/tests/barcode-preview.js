/*
 * 把登机牌条形码渲染成 PNG 预览，便于肉眼确认效果。
 * 用法： node tools/tests/barcode-preview.js [输出路径]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const rx = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [...html.matchAll(rx)].map(m => m[1]);
const src = blocks[blocks.length - 1];
const s = src.indexOf('const CODE128_PATTERNS');
const e = src.indexOf('// ========== 机场维基');
const mod = eval('(function(){' + src.slice(s, e) +
    '\n;return {barcodeModules:barcodeModules};})()');

// 抓取一次真实绘制结果里的矩形。参数与 index.html 中的实际调用保持一致：
// 编码 航班号+座位，可读文字用两个空格分隔。
const fake = { _i: '', setAttribute() {}, set innerHTML(v) { this._i = v; }, get innerHTML() { return this._i; } };
global.document = { getElementById: () => fake };
const flightNum = 'CZ8888', seat = '12A';
const code2 = src.slice(s, e);
eval('(function(){' + code2 +
    '\n;drawBarcodeSvg("ticketBarcode",' + JSON.stringify(flightNum + seat) +
    ',' + JSON.stringify(flightNum + '  ' + seat) + ');})()');

const rects = [...fake.innerHTML.matchAll(/<rect x="([\d.]+)" y="4" width="([\d.]+)" height="(\d+)"/g)]
    .map(m => ({ x: +m[1], w: +m[2], h: +m[3] }));

// 用纯 JS 生成 PNG（无第三方依赖）
const W = 380, H = 60, SS = 4; // SS = 超采样倍数，边缘更平滑
const iw = W * SS, ih = H * SS;
const px = Buffer.alloc(iw * ih * 3, 255); // 白底

const setPx = (x, y) => {
    if (x < 0 || y < 0 || x >= iw || y >= ih) return;
    const o = (y * iw + x) * 3;
    px[o] = 0; px[o + 1] = 0; px[o + 2] = 0;
};

rects.forEach(r => {
    const x0 = Math.round(r.x * SS), x1 = Math.round((r.x + r.w) * SS);
    const y0 = Math.round(4 * SS), y1 = Math.round((4 + r.h) * SS);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(x, y);
});

// 下采样
const dw = W, dh = H;
const out = Buffer.alloc(dw * dh * 3, 255);
for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
        let sum = 0;
        for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
            sum += px[((y * SS + dy) * iw + (x * SS + dx)) * 3];
        }
        const v = Math.round(sum / (SS * SS));
        const o = (y * dw + x) * 3;
        out[o] = out[o + 1] = out[o + 2] = v;
    }
}

// 手写最小 PNG 编码器
function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = c ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(dw, 0); ihdr.writeUInt32BE(dh, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc((dw * 3 + 1) * dh);
for (let y = 0; y < dh; y++) {
    raw[y * (dw * 3 + 1)] = 0;
    out.copy(raw, y * (dw * 3 + 1) + 1, y * dw * 3, (y + 1) * dw * 3);
}
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
]);

const outPath = process.argv[2] || path.join(__dirname, 'barcode-preview.png');
fs.writeFileSync(outPath, png);
console.log('条形码数量: ' + rects.length + ' 根');
console.log('已输出预览: ' + outPath);
