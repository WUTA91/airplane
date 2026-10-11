# -*- coding: utf-8 -*-
"""
把「机场资料填写表.csv」合并回 index.html 的 airportDB。

用法：
    python tools/merge_airport_data.py

特性：
  - 只读取 CSV 中"已填写"的列，留空的字段不会覆盖原有值（也不会写入空字段）
  - 以「三字码」为主键匹配，CSV 里的代码与代码库不一致会明确报错
  - 自动备份 index.html 到 _backup/ 后再写入
  - 幂等：重复运行结果一致，不会重复追加字段

安全：本脚本只改 airportDB 数组，不动文件的其它部分。
"""
import os
import re
import csv
import sys
import shutil
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(BASE, "index.html")
CSV = os.path.join(BASE, "机场资料填写表.csv")

# CSV 列名 -> 代码中的字段名（顺序即写入顺序）
FIELD_MAP = [
    ("全称", "fullName"),
    ("省份", "province"),
    ("跑道数量", "runways"),
    ("跑道长度(米)", "runwayLength"),
    ("海拔(米)", "elevation"),
    ("启用年份", "openedYear"),
    ("简介", "intro"),
]
# 数值型字段：填了就必须是数字
NUMERIC = {"runways", "runwayLength", "elevation", "openedYear"}


def die(msg):
    print("错误：" + msg)
    sys.exit(1)


def load_csv():
    if not os.path.exists(CSV):
        die("找不到 %s" % CSV)
    # utf-8-sig 兼容 Excel 保存时写入的 BOM
    with open(CSV, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            die("CSV 是空的")
        missing = [c for c, _ in FIELD_MAP if c not in reader.fieldnames]
        if missing:
            die("CSV 缺少列：" + "、".join(missing) + "（请勿改动表头）")
        if "三字码(勿改)" not in reader.fieldnames:
            die("CSV 缺少「三字码(勿改)」列，请使用原始模板")
        return list(reader)


def js_str(s):
    """转成安全的 JS 双引号字符串。"""
    s = str(s).strip()
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\r", " ").replace("\n", " ")
    return '"' + s + '"'


def js_val(field, raw):
    raw = str(raw).strip()
    if field in NUMERIC:
        # 允许用户写成 "3800" 或 "3800米"，提取其中的数字
        m = re.search(r"-?\d+(?:\.\d+)?", raw)
        if not m:
            raise ValueError("「%s」不是有效数字：%s" % (field, raw))
        num = m.group(0)
        return num[:-2] if num.endswith(".0") else num
    return js_str(raw)


def main():
    rows = load_csv()
    html = open(HTML, encoding="utf-8").read()

    # 捕获数组体的规则：从 "[" 之后的第一个换行开始，到末尾换行 + "];" 之前结束。
    # 这样重写时只需补回开头的一个换行，格式与原文件保持一致。
    m = re.search(r"(const airportDB = \[)\n(.*?)(\n\];)", html, re.S)
    if not m:
        die("在 index.html 中找不到 airportDB 数组")
    head, body, tail = m.group(1), m.group(2), m.group(3)

    # 解析现有条目：保留 code/name/lng/lat 的原始写法
    entries = {}
    order = []
    for line in body.splitlines():
        s = line.strip().rstrip(",")
        if not s.startswith("{"):
            continue
        cm = re.search(r'code\s*:\s*"([^"]+)"', s)
        if not cm:
            continue
        code = cm.group(1)
        entries[code] = s
        order.append(code)

    print("index.html 中现有机场：%d 座" % len(order))

    # 校验 CSV 与代码库一致
    csv_codes = [r["三字码(勿改)"].strip() for r in rows if r.get("三字码(勿改)", "").strip()]
    unknown = [c for c in csv_codes if c not in entries]
    if unknown:
        die("CSV 中有代码库里不存在的三字码：" + "、".join(unknown))
    dup = {c for c in csv_codes if csv_codes.count(c) > 1}
    if dup:
        die("CSV 中有重复的三字码：" + "、".join(sorted(dup)))

    by_code = {r["三字码(勿改)"].strip(): r for r in rows if r.get("三字码(勿改)", "").strip()}

    filled_total = 0
    changed = 0
    errors = []
    new_lines = []

    for code in order:
        orig = entries[code]
        row = by_code.get(code)
        if not row:
            new_lines.append("    " + orig + ",")
            continue

        # 先剥掉旧的可选字段，保证幂等（避免重复运行时字段叠加）
        base = re.sub(
            r',\s*(fullName|province|runways|runwayLength|elevation|openedYear|intro)\s*:\s*'
            r'(?:"(?:[^"\\]|\\.)*"|-?[\d.]+)',
            "", orig)

        extras = []
        for col, field in FIELD_MAP:
            raw = (row.get(col) or "").strip()
            if not raw:
                continue  # 留空 = 不写入该字段
            try:
                extras.append("%s:%s" % (field, js_val(field, raw)))
                filled_total += 1
            except ValueError as e:
                errors.append("%s -> %s" % (code, e))

        merged = base.rstrip()
        if not merged.endswith("}"):
            errors.append("%s -> 原始条目格式异常，已跳过" % code)
            new_lines.append("    " + orig + ",")
            continue
        merged = merged[:-1].rstrip()  # 去掉结尾的 }
        if extras:
            merged += "," + ",".join(extras)
        merged += "}"
        if merged != orig:
            changed += 1
        new_lines.append("    " + merged + ",")

    if errors:
        print("\n发现以下问题，未写入任何修改：")
        for e in errors:
            print("  - " + e)
        sys.exit(1)

    print("已填写字段数：%d" % filled_total)
    print("发生变化的机场：%d 座" % changed)

    if changed == 0:
        print("\n没有检测到需要写入的新资料，index.html 未改动。")
        return

    # 备份
    bak_dir = os.path.join(BASE, "_backup")
    os.makedirs(bak_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    bak = os.path.join(bak_dir, "index.html.%s.bak" % stamp)
    shutil.copy2(HTML, bak)
    print("已备份到：" + bak)

    # 保留数组开头/结尾原有的换行结构：捕获组 body 从紧随 "[" 的换行之后开始，
    # 因此前面必须补回一个换行，否则第一行会被拼到 "const airportDB = [" 后面。
    new_body = "\n" + "\n".join(new_lines)
    out = html[:m.start(2)] + new_body + html[m.end(2):]
    open(HTML, "w", encoding="utf-8").write(out)
    print("已写入：" + HTML)
    print("\n完成。请刷新页面查看维基内容。")


if __name__ == "__main__":
    main()
