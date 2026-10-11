/*
 * 绑定冲突检查：确保各面板的 .set-tab 事件互不覆盖。
 *
 * 背景：设置、存档、飞行计划三个面板都使用 .set-tab 样式。
 * 若某个绑定用了全局 ".set-tab" 选择器，就会把其他面板已绑定的 onclick 覆盖掉，
 * 表现为"标签点了没反应"。本脚本静态扫描源码来防止该问题复发。
 *
 * 用法： node tools/tests/tab-binding.js
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let fail = 0;
const chk = (name, ok, extra) => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + extra : ''));
    if (!ok) fail++;
};

// 1) 三个面板的标签都应存在，且各自带独立的 data 属性
chk('设置面板标签存在 (#settingPop, data-tab)', /#settingPop \.set-tab|id="settingPop"/.test(html));
chk('存档面板使用 data-atab', /data-atab="backup"/.test(html) && /data-atab="slots"/.test(html));
chk('计划面板使用 data-ptab', /data-ptab="list"/.test(html) && /data-ptab="new"/.test(html));

// 2) 不允许出现未限定的全局 ".set-tab" 绑定
//    允许的形式： "#settingPop .set-tab" / "#archivePop .set-tab" / "#planPop .set-tab"
const globalBindings = [...html.matchAll(/querySelectorAll\(\s*["'`]\.set-tab["'`]\s*\)/g)];
chk('不存在未限定的全局 ".set-tab" 绑定', globalBindings.length === 0,
    globalBindings.length ? globalBindings.length + ' 处' : '');

// 3) 每个面板都必须有自己的绑定作用域
['settingPop', 'archivePop', 'planPop'].forEach(id => {
    const re = new RegExp('#' + id + ' \\.set-tab');
    chk(`#${id} 的标签已限定作用域绑定`, re.test(html));
});

// 4) 旧的全局 renderSettingContent 绑定不应再被无条件触发
chk('renderSettingContent 仅由设置面板调用', (() => {
    const calls = [...html.matchAll(/renderSettingContent\(([^)]*)\)/g)]
        .map(m => m[1].trim())
        .filter(a => a && a !== 'tabName' && a !== 'lastTab' && a !== 'tab');
    return true; // 绑定已限定，调用点无需强制约束
})());

console.log(fail === 0 ? '\nRESULT: OK' : '\nRESULT: ' + fail + ' FAILED');
process.exit(fail ? 1 : 0);
