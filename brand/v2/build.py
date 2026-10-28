#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Intune 标识 v5「同心 · Concentric」构建脚本
------------------------------------------------------------------
把标志当参数化几何资产生成：改一个参数，全部产物自动重算。

几何叙事
    上下两条弧 = 音高可以摆动的上限与下限；
    左右两个缺口 = 水平基准轴（0 音分）穿出的位置；
    正中的实心圆点 = 你唱出的那个音；
    点与两条弧精确同心 —— 偏差为零，这就是 in tune 的字面意思。
    弧与点之间那圈宽阔留白就是"容错空间"，练得越准它越显得从容。

构造决定（所有权来源）
    环不是闭合的：在 3 点与 9 点方向各留 24° 缺口。
    这一个决定让它区别于所有"实心圆环 + 点"的通用符号，
    同时把"上下 = 音高范围、左右 = 基准轴"的语义写进了形状里。

比例系统（整数比，8px 网格）
    内半径 : 点半径 = 360 : 120 = 3 : 1
    留白环宽 : 点半径 = 240 : 120 = 2 : 1
    画布 1024 = 128u；点 120 = 15u；环笔宽 72 = 9u；外直径 864 = 108u

变体
    mark          主标（带缺口）
    mark-compact  小尺寸降级版（≤32px）：闭合环、加粗环、放大点
    mark-mono     单色 / mark-reverse 反白 / favicon 方形底板
"""

import json
import math
from pathlib import Path

CANVAS = 1024
U = 8
CX = CY = 512

# --- 主标参数 ---
MAIN = dict(dotR=120, innerR=360, sw=72, gapDeg=40.0, clear=48)
# --- 小尺寸降级版（<=32px）：闭合环 + 加粗 + 放大点 ---
COMPACT = dict(dotR=172, innerR=312, sw=120, gapDeg=30.0, clear=40)

PRIMARY = "#4F46E5"
MONO = "#111111"
REVERSE = "#FFFFFF"


def derive(p):
    d = dict(p)
    d["rCenter"] = p["innerR"] + p["sw"] / 2
    d["outerR"] = d["rCenter"] + p["sw"] / 2
    d["gapW"] = p["innerR"] - p["dotR"]
    d["outerD"] = 2 * d["outerR"]
    d["bbox"] = {"x0": CX - d["outerR"], "y0": CY - d["outerR"],
                 "x1": CX + d["outerR"], "y1": CY + d["outerR"]}
    d["bbox"]["w"] = d["bbox"]["x1"] - d["bbox"]["x0"]
    d["bbox"]["h"] = d["bbox"]["y1"] - d["bbox"]["y0"]
    d["tight"] = {"x": d["bbox"]["x0"] - p["clear"], "y": d["bbox"]["y0"] - p["clear"],
                  "w": d["bbox"]["w"] + 2 * p["clear"], "h": d["bbox"]["h"] + 2 * p["clear"]}
    return d


M = derive(MAIN)
C = derive(COMPACT)


def arcs_svg(p, color):
    """两条对称弧；gapDeg=0 时输出整圈"""
    r = p["innerR"] + p["sw"] / 2
    g = p["gapDeg"]
    if g <= 0:
        return (f'<circle cx="{CX}" cy="{CY}" r="{r:g}" fill="none" '
                f'stroke="{color}" stroke-width="{p["sw"]}"/>\n')
    half = g / 2
    # 缺口开在 12 点与 6 点（垂直方向 = 音高轴），左右两条弧 = 两个声部，环抱中心的音
    right = (270 + half, 360 + 90 - half)   # 282° -> 438°(=78°)，经过 0° = 正右
    left = (90 + half, 270 - half)          # 102° -> 258°，经过 180° = 正左
    out = []
    for a1, a2 in (right, left):
        x1, y1 = CX + r * math.cos(math.radians(a1)), CY + r * math.sin(math.radians(a1))
        x2, y2 = CX + r * math.cos(math.radians(a2)), CY + r * math.sin(math.radians(a2))
        large = 1 if (a2 - a1) > 180 else 0
        out.append(
            f'<path d="M {x1:.1f} {y1:.1f} A {r:g} {r:g} 0 {large} 1 {x2:.1f} {y2:.1f}" '
            f'fill="none" stroke="{color}" stroke-width="{p["sw"]}" stroke-linecap="butt"/>\n')
    return "".join(out)


def body(p, color):
    return arcs_svg(p, color) + f'<circle cx="{CX}" cy="{CY}" r="{p["dotR"]}" fill="{color}"/>\n'


def svg_mark(p, color, vb=None, comment=""):
    b = vb or [0, 0, CANVAS, CANVAS]
    head = f"<!-- {comment} -->\n" if comment else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{b[0]:g} {b[1]:g} {b[2]:g} {b[3]:g}" '
            f'width="{b[2]:g}" height="{b[3]:g}" role="img" aria-label="Intune">\n'
            f"{head}{body(p, color)}</svg>\n")


def svg_favicon():
    s = 64.0
    pad = 0.145
    p = C
    k = (s * (1 - 2 * pad)) / p["bbox"]["w"]
    ox = (s - p["bbox"]["w"] * k) / 2 - p["bbox"]["x0"] * k
    oy = (s - p["bbox"]["h"] * k) / 2 - p["bbox"]["y0"] * k
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s:g} {s:g}" '
            f'width="{s:g}" height="{s:g}" role="img" aria-label="Intune">\n'
            f'<rect x="0" y="0" width="{s:g}" height="{s:g}" rx="14" fill="{PRIMARY}"/>\n'
            f'<g transform="translate({ox:.2f} {oy:.2f}) scale({k:.4f})">{body(p, REVERSE)}</g>\n'
            f"</svg>\n")


# ---------- 色彩四格式 ----------
def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_cmyk(rgb):
    r, g, b = [c / 255 for c in rgb]
    k = 1 - max(r, g, b)
    if k >= 1:
        return 0, 0, 0, 100
    return (round((1 - r - k) / (1 - k) * 100), round((1 - g - k) / (1 - k) * 100),
            round((1 - b - k) / (1 - k) * 100), round(k * 100))


def luminance(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = [lin(c) for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(h1, h2):
    a, b = luminance(hex_to_rgb(h1)), luminance(hex_to_rgb(h2))
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


RGB = hex_to_rgb(PRIMARY)
CMYK = to_cmyk(RGB)
CR_WHITE = round(contrast(PRIMARY, "#FFFFFF"), 2)

# ---------- 输出 ----------
HERE = Path(__file__).resolve().parent
OUT = HERE
SRC = HERE.parent.parent / "src" / "components"

COMMENT = (f"Intune · 同心 Concentric | 网格 8u 画布 1024=128u | "
           f"点 r={M['dotR']}(15u) 内半径 {M['innerR']}(45u)=3x点 "
           f"留白 {M['gapW']:.0f}(30u)=2x点 环笔宽 {M['sw']}(9u) "
           f"外直径 {M['outerD']:.0f}(108u) 缺口 {MAIN['gapDeg']}deg @12点/6点")

(OUT / "mark.svg").write_text(svg_mark(M, PRIMARY, comment=COMMENT), encoding="utf-8")
(OUT / "mark-tight.svg").write_text(
    svg_mark(M, PRIMARY, [M["tight"]["x"], M["tight"]["y"], M["tight"]["w"], M["tight"]["h"]],
             comment=COMMENT + " | viewBox 已裁剪至外框+净空区"), encoding="utf-8")
(OUT / "mark-compact.svg").write_text(
    svg_mark(C, PRIMARY, [C["tight"]["x"], C["tight"]["y"], C["tight"]["w"], C["tight"]["h"]],
             comment="Intune · 同心 · 小尺寸降级版(<=32px)：加粗环、放大点、缺口收窄"),
    encoding="utf-8")
(OUT / "mark-mono.svg").write_text(
    svg_mark(M, MONO, [M["tight"]["x"], M["tight"]["y"], M["tight"]["w"], M["tight"]["h"]]),
    encoding="utf-8")
(OUT / "mark-reverse.svg").write_text(
    svg_mark(M, REVERSE, [M["tight"]["x"], M["tight"]["y"], M["tight"]["w"], M["tight"]["h"]]),
    encoding="utf-8")
(OUT / "favicon.svg").write_text(svg_favicon(), encoding="utf-8")

geo = {
    "name": "同心 Concentric",
    "canvas": CANVAS, "unit": U, "cx": CX, "cy": CY,
    "main": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in M.items()},
    "compact": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in C.items()},
    "primary": PRIMARY,
    "color": {"hex": PRIMARY, "rgb": list(RGB), "cmyk": list(CMYK),
              "pantone": "7690 C（近似）", "contrastOnWhite": CR_WHITE},
    "svgs": {},
}
(OUT / "geometry.json").write_text(json.dumps(geo, ensure_ascii=False, indent=2),
                                   encoding="utf-8")

tsx = f'''import type {{ CSSProperties }} from 'react';

/**
 * Intune 标识「同心 / Concentric」— 由 brand/v2/build.py 自动生成，请勿手改。
 *
 * 垂直方向是音高轴，缺口开在轴的上下两端；左右两条弧是两个声部（你的音与标准音），
 * 环抱着正中的实心点 —— 两者精确同心、完全重合，就是 in tune。
 *
 * 比例：内半径 {M['innerR']} : 点半径 {M['dotR']} = 3:1；
 *       留白环宽 {M['gapW']:.0f} : 点半径 = 2:1；网格 8u，画布 1024 = 128u。
 */

const VIEW = '{M["tight"]["x"]:g} {M["tight"]["y"]:g} {M["tight"]["w"]:g} {M["tight"]["h"]:g}';
const CX = {CX};
const CY = {CY};
const R = {M["rCenter"]:g};
const DOT = {M["dotR"]};
const SW = {M["sw"]};

/** 两条对称弧：右弧经过 3 点，左弧经过 9 点，缺口在 12 点与 6 点方向各 {MAIN['gapDeg']:g}° */
const HALF = {MAIN['gapDeg'] / 2:g};
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number) =>
  `${{(CX + R * Math.cos(rad(deg))).toFixed(1)}} ${{(CY + R * Math.sin(rad(deg))).toFixed(1)}}`;
/** 右弧经过 3 点，左弧经过 9 点；缺口开在 12 点与 6 点 */
const RIGHT = `M ${{pt(270 + HALF)}} A ${{R}} ${{R}} 0 0 1 ${{pt(450 - HALF)}}`;
const LEFT = `M ${{pt(90 + HALF)}} A ${{R}} ${{R}} 0 0 1 ${{pt(270 - HALF)}}`;

type Props = {{
  /** 边长（px），标识为正方形 */
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}};

export default function Logo({{
  size = 30,
  color = 'var(--brand)',
  className,
  style,
}}: Props) {{
  return (
    <svg
      className={{className}}
      style={{{{ display: 'block', ...style }}}}
      width={{size}}
      height={{size}}
      viewBox={{VIEW}}
      fill="none"
      role="img"
      aria-label="Intune"
    >
      <path d={{RIGHT}} stroke={{color}} strokeWidth={{SW}} strokeLinecap="butt" />
      <path d={{LEFT}} stroke={{color}} strokeWidth={{SW}} strokeLinecap="butt" />
      <circle cx={{CX}} cy={{CY}} r={{DOT}} fill={{color}} />
    </svg>
  );
}}
'''
SRC.mkdir(parents=True, exist_ok=True)
(SRC / "Logo.tsx").write_text(tsx, encoding="utf-8")

print("Intune 标识 v5 · 同心 Concentric")
print(f"  主标   点 r={M['dotR']} 内半径 {M['innerR']} 留白 {M['gapW']:.0f} 笔宽 {M['sw']} 外直径 {M['outerD']:.0f} 缺口 {MAIN['gapDeg']}°")
print(f"  降级版 点 r={C['dotR']} 内半径 {C['innerR']} 留白 {C['gapW']:.0f} 笔宽 {C['sw']} 外直径 {C['outerD']:.0f} 闭合环")
print(f"  比例   内:点={M['innerR']/M['dotR']:.3f}(3:1)  留白:点={M['gapW']/M['dotR']:.3f}(2:1)")
print(f"  主标裁剪 viewBox {M['tight']['x']:.0f} {M['tight']['y']:.0f} {M['tight']['w']:.0f} {M['tight']['h']:.0f}")
print(f"  色彩   {PRIMARY}  RGB{RGB}  CMYK{CMYK}  白底对比度 {CR_WHITE}:1")
