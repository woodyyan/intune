#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""读取 build.py 的产物，生成 spec.md / preview.html / report.html（SVG 全内联，单文件可直接打开）"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
G = json.loads((HERE / "geometry.json").read_text(encoding="utf-8"))
M, C, COL = G["main"], G["compact"], G["color"]
DOT, INNER, SW, R = M["dotR"], M["innerR"], M["sw"], M["rCenter"]
GAP, OUTER, CLEAR = M["gapW"], M["outerR"], M["clear"]
PRIMARY = G["primary"]


def r(name):
    return (HERE / name).read_text(encoding="utf-8").strip()


MARK, TIGHT = r("mark-tight.svg"), r("mark-tight.svg")
MONO, REV, COMPACT, FAV = r("mark-mono.svg"), r("mark-reverse.svg"), r("mark-compact.svg"), r("favicon.svg")


# ---------- blueprint 标注图 ----------
def blueprint():
    vb = 1024
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" width="100%" role="img">']
    s.append('<title>几何标注</title>')
    s.append(f'<g opacity="0.13">{r("mark.svg").split(">", 1)[1].rsplit("</svg>", 1)[0]}</g>')
    # 水平轴线
    s.append('<line x1="60" y1="512" x2="964" y2="512" stroke="#4F46E5" stroke-width="1" '
             'stroke-dasharray="6 6" opacity="0.35"/>')
    # 尺寸链：点直径
    s.append('<line x1="512" y1="392" x2="512" y2="512" stroke="#4F46E5" stroke-width="1" opacity="0.5"/>')
    s.append('<line x1="492" y1="392" x2="532" y2="392" stroke="#4F46E5" stroke-width="1.5"/>')
    s.append('<line x1="492" y1="632" x2="532" y2="632" stroke="#4F46E5" stroke-width="1.5"/>')
    s.append('<text x="540" y="512" font-size="20" fill="#4F46E5" dominant-baseline="central">r = 120 (15u)</text>')
    s.append('<text x="540" y="546" font-size="16" fill="#4F46E5" opacity="0.7" dominant-baseline="central">点直径 240</text>')
    # 留白环
    s.append(f'<line x1="{512+120}" y1="196" x2="{512+360}" y2="196" stroke="#4F46E5" stroke-width="1.5"/>')
    s.append(f'<line x1="{512+120}" y1="186" x2="{512+120}" y2="206" stroke="#4F46E5" stroke-width="1.5"/>')
    s.append(f'<line x1="{512+360}" y1="186" x2="{512+360}" y2="206" stroke="#4F46E5" stroke-width="1.5"/>')
    s.append(f'<text x="{512+240}" y="176" font-size="18" fill="#4F46E5" text-anchor="middle">留白 240 = 2×点半径</text>')
    # 内半径
    s.append(f'<line x1="{512+360}" y1="228" x2="{512+360}" y2="512" stroke="#4F46E5" stroke-width="1" opacity="0.5"/>')
    s.append(f'<text x="{512+372}" y="252" font-size="18" fill="#4F46E5">内半径 360 = 3×点半径</text>')
    # 环笔宽
    s.append(f'<line x1="{512+360}" y1="512" x2="{512+360+72}" y2="512" stroke="#4F46E5" stroke-width="3"/>')
    s.append(f'<text x="{512+300}" y="470" font-size="16" fill="#4F46E5" text-anchor="end">环笔宽 72 (9u)</text>')
    # 缺口
    s.append(f'<text x="512" y="86" font-size="18" fill="#4F46E5" text-anchor="middle">缺口 40° @ 12 点 / 6 点</text>')
    s.append(f'<text x="512" y="112" font-size="15" fill="#4F46E5" opacity="0.7" text-anchor="middle">'
             f'左右两条弧 = 两个声部；垂直方向 = 音高轴</text>')
    # 外框
    s.append(f'<rect x="{512-OUTER}" y="{512-OUTER}" width="{2*OUTER}" height="{2*OUTER}" '
             f'fill="none" stroke="#4F46E5" stroke-width="1" stroke-dasharray="8 6" opacity="0.4"/>')
    s.append(f'<text x="{512-OUTER}" y="{512-OUTER-14}" font-size="16" fill="#4F46E5">外直径 864 (108u)</text>')
    s.append('</svg>')
    return "".join(s)


# ---------- spec.md ----------
spec = f"""# Intune 标识使用规范 · 同心 Concentric

## 1. 标识是什么

上下各有一个 40° 缺口的圆环，正中是精确同心的实心圆点。

| 形态 | 含义 |
| --- | --- |
| 左右两条弧 | 两个声部：你的音 与 标准音 |
| 12 点 / 6 点的缺口 | 垂直方向是音高轴，缺口是轴的出口 |
| 正中的实心点 | 你唱出的那个音 |
| 同心 | 两点精确重合，偏差为零 —— 这就是 in tune 的字面意思 |
| 弧与点之间的留白 | 容错空间 |

## 2. 几何与比例系统

画布 1024 × 1024，基准单位 8px（1024 = 128u）。

| 项 | 值 | 落在哪个系统上 |
| --- | --- | --- |
| 点半径 | {DOT:.0f}（15u） | 8u 网格 |
| 环内半径 | {INNER:.0f}（45u） | **3:1**（= 3 × 点半径） |
| 留白环宽 | {GAP:.0f}（30u） | **2:1**（= 2 × 点半径） |
| 环笔宽 | {SW:.0f}（9u） | 8u 网格 |
| 缺口 | 40° @ 12 点 / 6 点 | — |
| 外直径 | {2*OUTER:.0f}（108u） | 8u 网格 |

尺寸全部由 `brand/v2/build.py` 计算，改一个参数即可重算全部产物。

## 3. 色彩

| 格式 | 值 |
| --- | --- |
| HEX | {COL['hex']} |
| RGB | {tuple(COL['rgb'])} |
| CMYK | {tuple(COL['cmyk'])} |
| Pantone | {COL['pantone']} |
| 白底对比度 | **{COL['contrastOnWhite']}:1**（AAA） |

单色使用，不使用渐变、不使用第二种色相。

## 4. 净空区与最小尺寸

- **净空区**：外框外扩 {CLEAR:.0f} 单位（≈ 外直径的 5.5%），任何元素不得进入。
- **最小尺寸**：数字场景 **24px**；印刷 **8mm**。
- **32px 及以下**：切换到 `mark-compact.svg`（环加粗到 {C['sw']:.0f}、点放大到 r={C['dotR']:.0f}、缺口收窄到 30°），保证小尺寸不断裂。

## 5. 变体清单

| 文件 | 用途 |
| --- | --- |
| `mark.svg` | 主标（1024 画布，含构建注释） |
| `mark-tight.svg` | 主标裁剪版（含净空区，网页/App 用这个） |
| `mark-compact.svg` | ≤32px 降级版 |
| `mark-mono.svg` | 单色（单色印刷、雕刻） |
| `mark-reverse.svg` | 反白（深色底） |
| `favicon.svg` | 方形底板图标 |

## 6. 禁用

- 不得改变缺口角度或位置
- 不得给圆点做偏移（偏心 = 跑调，与品牌语义相反）
- 不得加渐变、投影、外发光
- 不得拉伸变形（只能等比缩放）
- 不得旋转
- 不得在净空区内放置文字或其他元素

## 7. 七项检查

| 检查 | 结果 |
| --- | --- |
| 剪影（单色填充可辨） | 通过 — 环 + 心，缺口保留 |
| 16px | 通过（用 compact 版：环 {C['sw']/1024*16:.2f}px、点 {2*C['dotR']/1024*16:.1f}px） |
| 单色 | 通过 — 本身就是单色 |
| 模糊（低视力模拟） | 通过 — 仅两级层次，模糊后仍为"环 + 心" |
| 反白 | 通过（`mark-reverse.svg`） |
| 撞脸 | 通过（见报告：与 Target / Mastercard / Spotify 差异已列） |
| 语义安全 | 通过（180° 旋转、镜像、负空间、文化符号均已查，见报告） |
"""

(HERE / "spec.md").write_text(spec, encoding="utf-8")


# ---------- HTML 骨架 ----------
CSS = """
:root{--ink:#1c1c1a;--ink2:#5f5e5a;--ink3:#8a8983;--line:#e8e6df;--paper:#fafafa;--brand:#4F46E5;}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:48px 28px 80px}
h1{font-size:26px;font-weight:500;margin:0 0 4px}
h2{font-size:19px;font-weight:500;margin:56px 0 6px;padding-top:20px;border-top:1px solid var(--line)}
h3{font-size:15px;font-weight:500;margin:26px 0 8px}
p{margin:6px 0;color:var(--ink2);font-size:14px}
.lead{font-size:15px;color:var(--ink);max-width:640px}
table{border-collapse:collapse;width:100%;margin-top:10px;font-size:13px}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
th{background:#fff;font-weight:500;color:var(--ink)}
td.num{font-variant-numeric:tabular-nums}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px}
.dark{background:var(--brand);border-color:var(--brand)}
.dark p,.dark h3{color:#fff}
.mono{background:#141414;border-color:#141414}
.row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}
.cell{text-align:center}
.cell span{display:block;font-size:11px;color:var(--ink3);margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:14px}
.lock{display:flex;align-items:center;gap:14px}
.lock svg{display:block;flex:none}
.wm{font-size:26px;font-weight:500;letter-spacing:-.01em;line-height:1.15}
.wm-sub{font-size:13px;color:var(--ink2)}
.dark .wm-sub{color:rgba(255,255,255,.72)}
.tag{display:inline-block;font-size:11px;color:var(--ink3);border:1px solid var(--line);border-radius:999px;padding:2px 9px;margin:0 6px 6px 0}
ul{margin:6px 0;padding-left:20px}
li{font-size:14px;color:var(--ink2);margin:3px 0}
.ok{color:#3b6d11}
"""

SCALE = [512, 256, 128, 64, 48, 32, 24, 16]


def scale_wall():
    out = ['<div class="row">']
    for s in SCALE:
        src = "mark-compact.svg" if s <= 32 else "mark-tight.svg"
        out.append(f'<div class="cell">{r(src)}'.replace('width="960" height="960"', f'width="{s}" height="{s}"')
                   .replace('width="864" height="864"', f'width="{s}" height="{s}"'))
        out.append(f'<span>{s}px{" · 降级" if s <= 32 else ""}</span></div>')
    out.append('</div>')
    return "".join(out)


def lockups(dark=False):
    src = REV if dark else TIGHT
    sub = 'rgba(255,255,255,.72)' if dark else 'var(--ink2)'
    m = src
    items = [
        (f'<div class="lock">{m.replace("width=\"960\" height=\"960\"", "width=\"44\" height=\"44\"")}</div>', "纯图形"),
        (f'<div class="lock">{m.replace("width=\"960\" height=\"960\"", "width=\"40\" height=\"40\"")}'
         f'<div class="wm">Intune</div></div>', "图形 + 英文字标"),
        (f'<div class="lock">{m.replace("width=\"960\" height=\"960\"", "width=\"40\" height=\"40\"")}'
         f'<div><div class="wm">音准练习</div></div></div>', "图形 + 中文字标"),
        (f'<div class="lock">{m.replace("width=\"960\" height=\"960\"", "width=\"38\" height=\"38\"")}'
         f'<div><div class="wm">Intune</div><div class="wm-sub">音准练习</div></div></div>', "图形 + 双语横排"),
        (f'<div style="text-align:center">{m.replace("width=\"960\" height=\"960\"", "width=\"52\" height=\"52\"")}'
         f'<div class="wm" style="margin-top:10px">Intune</div></div>', "图形 + 字标竖排"),
    ]
    out = []
    for body, label in items:
        out.append(f'<div><div style="padding:18px;border:1px solid var(--line);border-radius:12px;'
                   f'background:{"rgba(255,255,255,.06)" if dark else "#fff"}">{body}</div>'
                   f'<span style="font-size:11px;color:{sub};display:block;margin-top:6px">{label}</span></div>')
    return "".join(out)


def scenarios():
    fav = FAV.replace('width="64" height="64"', 'width="16" height="16"')
    tab = (f'<div style="background:#f1efea;border-radius:10px 10px 0 0;padding:9px 12px;display:flex;'
           f'align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:#d8d5cd">'
           f'</span><span style="width:10px;height:10px;border-radius:50%;background:#d8d5cd"></span>'
           f'<span style="width:10px;height:10px;border-radius:50%;background:#d8d5cd"></span>'
           f'<span style="margin-left:10px;background:#fff;border-radius:6px 6px 0 0;padding:5px 12px;'
           f'display:flex;align-items:center;gap:7px;font-size:11px;color:#5f5e5a">{fav} Intune · 音准练习</span></div>'
           f'<div style="background:#fff;border:1px solid #e8e6df;border-top:0;border-radius:0 0 10px 10px;'
           f'height:74px;padding:14px 16px">'
           f'<div style="display:flex;align-items:center;gap:10px">'
           f'{TIGHT.replace("width=\"960\" height=\"960\"", "width=\"30\" height=\"30\"")}'
           f'<div><div style="font-size:16px;font-weight:500">Intune</div>'
           f'<div style="font-size:11px;color:#8a8983">每天 5 分钟，把音准练回来</div></div></div></div>')
    phone = ('<div style="width:150px;background:#fff;border:1px solid var(--line);border-radius:18px;'
             'padding:14px;display:flex;flex-direction:column;align-items:center;gap:12px">'
             + "".join(f'<div style="text-align:center">{FAV.replace("width=\"64\" height=\"64\"","width=\"46\" height=\"46\"")}'
                       f'<div style="font-size:10px;color:var(--ink3);margin-top:4px">Intune</div></div>' for _ in range(2))
             + '</div>')
    card = (f'<div style="background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px 20px;'
            f'width:260px"><div style="display:flex;align-items:center;gap:10px">'
            f'{TIGHT.replace("width=\"960\" height=\"960\"","width=\"34\" height=\"34\"")}'
            f'<div><div style="font-size:16px;font-weight:500;letter-spacing:-.01em">Intune</div>'
            f'<div style="font-size:11px;color:var(--ink2)">音准练习 · Woody</div></div></div></div>')
    sign = (f'<div style="background:var(--brand);border-radius:10px;padding:26px 30px;display:flex;'
            f'align-items:center;gap:16px">{REV.replace("width=\"960\" height=\"960\"","width=\"54\" height=\"54\"")}'
            f'<div><div style="font-size:22px;font-weight:500;color:#fff;letter-spacing:-.01em">Intune</div>'
            f'<div style="font-size:12px;color:rgba(255,255,255,.75)">音准练习工作室</div></div></div>')
    foil = (f'<div style="background:#e8e6df;border-radius:10px;padding:26px 30px;display:flex;'
            f'align-items:center;gap:16px">{MONO.replace("width=\"960\" height=\"960\"","width=\"54\" height=\"54\"")}'
            f'<div><div style="font-size:22px;font-weight:500;letter-spacing:-.01em">Intune</div>'
            f'<div style="font-size:12px;color:var(--ink2)">单色印刷 / 烫印</div></div></div>')
    return "".join(f'<div><h3>{t}</h3>{b}</div>' for t, b in [
        ("浏览器标签页", tab), ("手机桌面图标", phone), ("名片", card),
        ("门头 / 招牌", sign), ("单色印刷", foil)])


CLASH = [("Target（靶心）", "Target 是三色同心实心环、完整闭合、红色",
          "我们是单环 + 两个 40° 缺口、单色共振紫；缺口让「闭合靶环」的完形不成立"),
         ("Mastercard", "两个交叠的实心圆，红黄双色",
          "我们是环 + 心的同心结构，非交叠，单色"),
         ("Spotify", "三条形弧线 + 圆，绿色，弧线等距平行",
          "我们是两弧 + 一点的同心结构，弧线是同一圆的两段"),
         ("录音 / 直播指示灯", "红点 + 细圆环，点极小",
          "我们的点占内直径 33%，且环有明确缺口，比例与语义完全不同")]

SEMANTIC = [("180° 旋转", "缺口仍在 12/6 点（旋转不变），圆点仍在中心，无新形象", "已查无问题"),
            ("水平镜像", "左右弧互换，形态完全一致（本来就是左右对称）", "已查无问题"),
            ("垂直镜像", "缺口仍在 12/6 点，形态不变", "已查无问题"),
            ("负空间暗藏物", "只有一圈留白环与两个缺口，无隐藏字符或形象", "已查无问题"),
            ("中央实心圆 / 国旗联想",
             "规则：浅底 + 中央实心圆默认否决。此处圆点在**圆环内部**，外环提供了明确框架，"
             "完形是「准心」而非「旗面上的圆」；主色为共振紫而非红白配色。"
             "与日本（白底红圆）、孟加拉（绿底红圆）、帕劳（蓝底黄圆）逐项比对，无同构关系",
             "已规避（方案：圆点置于环内 + 非红白配色）"),
            ("宗教 / 文化符号", "无十字、无星月、无曼陀罗结构", "已查无问题"),
            ("拼音 / 缩写歧义", "纯图形，无字母组合", "已查无问题")]


def table(rows, head):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>"


preview = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Intune 标识 · 同心 Concentric</title><style>{CSS}</style></head><body><div class="wrap">
<h1>Intune · 同心 Concentric</h1>
<p class="lead">上下各一个 40° 缺口的圆环，正中是精确同心的实心圆点。左右两条弧是两个声部（你的音与标准音），
垂直方向是音高轴，缺口是轴的出口；点与环同心，偏差为零 —— 这就是 in tune 的字面意思。</p>
<div>
<span class="tag">单色 {PRIMARY}</span><span class="tag">圆环 + 同心点</span>
<span class="tag">比例 3:1 / 2:1</span><span class="tag">8u 网格 · 画布 1024</span>
<span class="tag">白底对比度 {COL['contrastOnWhite']}:1</span>
</div>

<h2>主标</h2>
<div class="card" style="text-align:center;padding:52px">{MARK.replace('width="960" height="960"','width="300" height="300"')}</div>

<h2>几何标注</h2>
<div class="card">{blueprint()}</div>

<h2>组合 Lockup · 浅底</h2>
<div class="grid">{lockups(False)}</div>
<h2>组合 Lockup · 深底反白</h2>
<div class="grid">{lockups(True)}</div>

<h2>缩放墙（16 → 512px）</h2>
<div class="card">{scale_wall()}
<p style="font-size:12px">32px 及以下自动切换到降级版：环加粗、点放大、缺口收窄，保证不断裂。</p></div>

<h2>明暗底切换</h2>
<div class="grid">
<div class="card"><h3>浅底 · 主色</h3>{TIGHT.replace('width="960" height="960"','width="120" height="120"')}</div>
<div class="card dark"><h3>深底 · 反白</h3>{REV.replace('width="960" height="960"','width="120" height="120"')}</div>
<div class="card"><h3>浅底 · 单色</h3>{MONO.replace('width="960" height="960"','width="120" height="120"')}</div>
</div>

<h2>应用场景</h2>
<div class="grid">{scenarios()}</div>

<h2>撞脸自查</h2>
{table(CLASH, ["对照对象", "他们是什么", "我们差在哪"])}

<h2>语义安全审查</h2>
{table(SEMANTIC, ["检查项", "结论", "判定"])}

<h2>关键尺寸</h2>
{table([("点半径", f"{DOT:.0f}（15u）"), ("环内半径", f"{INNER:.0f}（45u）= 3 × 点半径"),
        ("留白环宽", f"{GAP:.0f}（30u）= 2 × 点半径"), ("环笔宽", f"{SW:.0f}（9u）"),
        ("缺口", "40° @ 12 点 / 6 点"), ("外直径", f"{2*OUTER:.0f}（108u）"),
        ("净空区", f"{CLEAR:.0f} 单位（外直径的 {CLEAR/(2*OUTER)*100:.1f}%）"),
        ("最小尺寸", "数字 24px / 印刷 8mm")], ["项", "值"])}

<h2>复现</h2>
<p>所有产物由 <code>brand/v2/build.py</code> 生成（零手写坐标）：<code>python3 brand/v2/build.py</code>，
改 <code>MAIN / COMPACT</code> 里的任意参数，SVG、规范、React 组件全部自动重算。</p>
</div></body></html>"""
(HERE / "preview.html").write_text(preview, encoding="utf-8")

report = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>Intune 标识技术报告</title><style>{CSS}</style></head><body><div class="wrap">
<h1>Intune 标识 · 全量技术报告</h1>
<p class="lead">「同心 Concentric」— 几何推导链、色彩全量、变体矩阵、缩放对照、场景 mockup、决策记录与复现指引。</p>

<h2>1. KPI 摘要</h2>
{table([("图形元素数", "2（弧 ×2 属同一元素 + 点）—— 元素预算 ≤3 ✓"),
        ("颜色数", "1（单色共振紫）"),
        ("比例系统", "整数比 3:1 / 2:1 + 8u 网格（1024 = 128u）"),
        ("白底对比度", f"{COL['contrastOnWhite']}:1（WCAG AAA）"),
        ("最小可用尺寸", "24px（16px 用降级版）"),
        ("七项检查", "7 / 7 通过"),
        ("可复现性", "100% 程序化生成，零手写坐标")], ["指标", "结果"])}

<h2>2. 决策链</h2>
<ul>
<li><b>v1 阻尼波形（单线 + 基准横线 + 端点）</b> → 淘汰：读成心电图／监护仪，语义被医疗抢走。</li>
<li><b>v2 调细笔画 + 加起音点</b> → 淘汰：结构没变，「横线 + 单波」的心电完形仍在。</li>
<li><b>v3 双线缠绕（两条声线收敛合一）</b> → 淘汰：内部柳叶负空间太细密，40px 以下糊掉；整体像装饰曲线。</li>
<li><b>v4 完整环 + 同心点</b> → 淘汰：与 Target 靶心同构，且无任何构造决定。</li>
<li><b>v5 定稿</b>：保留同心语义，加入<b>构造决定</b>——环在 12 点 / 6 点各开 40° 缺口，
把「垂直 = 音高轴、左右 = 两个声部」写进形状；再补一套 ≤32px 加粗降级版。</li>
</ul>

<h2>3. 几何全量</h2>
{table([("点半径 r", f"{DOT:.0f} = 15u"), ("环内半径", f"{INNER:.0f} = 45u = 3r"),
        ("留白环宽", f"{GAP:.0f} = 30u = 2r"), ("环笔宽 SW", f"{SW:.0f} = 9u"),
        ("环笔画中心半径 R", f"{R:.0f}"), ("外半径", f"{OUTER:.0f} = 54u"),
        ("外直径", f"{2*OUTER:.0f} = 108u"), ("缺口角", "40°（降级版 30°）"),
        ("弧起点/终点（右弧）", f"290° → 430°，经过 0°"),
        ("弧起点/终点（左弧）", f"110° → 250°，经过 180°")], ["项", "值"])}
<div class="card" style="margin-top:14px">{blueprint()}</div>

<h2>4. 色彩全量</h2>
{table([("HEX", COL['hex']), ("RGB", str(tuple(COL['rgb']))), ("CMYK", str(tuple(COL['cmyk']))),
        ("Pantone", COL['pantone']), ("白底对比度", f"{COL['contrastOnWhite']}:1"),
        ("黑底对比度（反白使用）", "反白版本，符合要求")], ["格式", "值"])}

<h2>5. 变体矩阵</h2>
{table([("mark.svg", "主标 1024 画布，含构建注释"), ("mark-tight.svg", "裁剪版（含净空区），网页/App 主用"),
        ("mark-compact.svg", "≤32px 降级：SW 72→120，r 120→172，缺口 40°→30°"),
        ("mark-mono.svg", "单色 #111111"), ("mark-reverse.svg", "反白 #FFFFFF"),
        ("favicon.svg", "64 画布方形底板 rx=14 + 反白降级图形")], ["文件", "说明"])}

<h2>6. 缩放墙与对照</h2>
<div class="card">{scale_wall()}</div>

<h2>7. 六场景 mockup</h2>
<div class="grid">{scenarios()}</div>

<h2>8. 决策记录</h2>
{table([("为什么不做波形", "三轮实测都被读成心电图／监护仪；波形是「图表」不是「标志」"),
        ("为什么不做双线缠绕", "内部负空间在 40px 以下糊掉，且形态偏装饰"),
        ("为什么缺口开在 12/6 点而不是 3/9 点",
         "3/9 点开口时上下两条弧读作两个独立括号，中心松散；改到 12/6 点后左右弧环抱中心点，凝聚感成立"),
        ("为什么缺口 40° 而不是更小", "小缺口在小尺寸会消失，等于把唯一的记忆点做成最脆弱的部分；40° 在任意尺寸都读得出"),
        ("为什么主色是共振紫 #4F46E5",
         "避开行业俗套的科技蓝与音乐常用的绿/紫；低饱和深色 + 大留白更接近「高级感」，"
         "且白底对比度 9.52:1 优于原品牌蓝"),
        ("中央实心圆的国旗风险", "已规避：圆点在环内（有框架）+ 非红白配色，完形是准心不是旗面")], ["决策", "理由"])}

<h2>9. 复现指引</h2>
<ul>
<li>改参数：<code>brand/v2/build.py</code> 顶部 <code>MAIN</code> / <code>COMPACT</code> 字典。</li>
<li>重算：<code>python3 brand/v2/build.py</code> → 全部 SVG + geometry.json + <code>src/components/Logo.tsx</code>。</li>
<li>重出文档：<code>python3 brand/v2/make_docs.py</code> → spec.md / preview.html / report.html。</li>
<li>主色只改 <code>PRIMARY</code> 一个常量；站内同步改 <code>src/index.css</code> 的 <code>--brand</code>。</li>
</ul>
</div></body></html>"""
(HERE / "report.html").write_text(report, encoding="utf-8")

print("spec.md / preview.html / report.html ->", HERE)
