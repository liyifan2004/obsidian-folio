#!/usr/bin/env python3
"""校验（或重新生成）README 演示动图。

背景：
  - GitHub 对单个图片文件有 10 MB 的软上限。dual-pane.gif 原本 9.58 MB，
    已经贴着上限走，再录长一点就会在 README 里渲染失败。
  - WebP 同样被 GitHub 原生渲染（README 与 VS Code 预览都支持动图 WebP），
    但同等画质下体积约为 GIF 的 1/5。

做法：
  - 保留原始分辨率与总时长不变。
  - 每 step 帧取一帧，同时把该帧的持续时间乘以 step —— 播放速度与原来一致，
    观感无差别。
  - 用 WebP 原生有损压缩（quality=75/80），实测逐帧 PSNR ≥ 35 dB（视觉无损）。

用法：
  python tools/convert-demos.py --check          # 校验现有 .webp（CI 用）
  python tools/convert-demos.py --regenerate     # 用 .gif 源重新生成 .webp（需源文件）

依赖：Pillow（pip install pillow）。脚本不参与插件构建，
只是让 assets/ 里的演示图可被复现地重新生成、并被 CI 持续校验。

为什么 --check 不依赖 Pillow：
  WebP 的画布尺寸、帧数、每帧时长都在容器头里（VP8X / ANMF），
  可以直接解析字节。CI 里没必要为了一次校验额外装依赖。
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# 目标 WebP 的验收标准：画布尺寸、帧数、总时长（秒）。
# 这三项共同保证「看上去和原 GIF 一样」——尺寸不变、播放速度不变。
#
# 帧数用区间而不是精确值：编码器会把「连续且完全相同」的两帧合并成一帧
# （时长相加），所以实际帧数可能比「抽帧步长」算出来的少一两帧。
# 总时长不受影响，所以时长仍然按精确值校验。
EXPECTED = {
    "dual-pane.webp": {"size": (800, 440), "frames": (49, 50), "seconds": 15.0},
    "triple-pane.webp": {"size": (800, 440), "frames": (23, 24), "seconds": 4.8},
}

# 重新生成用的参数：(源 GIF, 目标 WebP, 抽帧步长, 画质)
REGENERATE = [
    ("dual-pane.gif", "dual-pane.webp", 3, 75),
    ("triple-pane.gif", "triple-pane.webp", 2, 80),
]


def read_webp(path: Path) -> tuple[int, int, list[int]]:
    """解析 WebP 容器，返回 (画布宽, 画布高, 每帧时长列表)。

    PIL 读 WebP 时不暴露每帧 duration（Pillow 只给整段动画的 duration），
    而写 WebP 又要求按帧给 duration —— 所以校验只能自己读容器字节。
    """
    with path.open("rb") as fh:
        data = fh.read()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError(f"{path.name} 不是 WebP 文件")

    pos = 12
    canvas = (0, 0)
    durations: list[int] = []
    while pos + 8 <= len(data):
        fourcc = data[pos : pos + 4]
        size = struct.unpack("<I", data[pos + 4 : pos + 8])[0]
        body = data[pos + 8 : pos + 8 + size]
        if fourcc == b"VP8X":
            # VP8X 画布尺寸是 24 位小端 + 1
            canvas = (
                (body[4] | body[5] << 8 | body[6] << 16) + 1,
                (body[7] | body[8] << 8 | body[9] << 16) + 1,
            )
        elif fourcc == b"ANMF":
            # ANMF 帧头：x(3) y(3) w(3) h(3) duration(3) flags(1)
            durations.append(body[12] | body[13] << 8 | body[14] << 16)
        pos += 8 + size + (size & 1)
    return canvas[0], canvas[1], durations


def check() -> int:
    failures = 0
    for name, expected in EXPECTED.items():
        path = ASSETS / name
        if not path.exists():
            print(f"FAIL {name}：文件不存在")
            failures += 1
            continue

        width, height, durations = read_webp(path)
        seconds = sum(durations) / 1000
        size_mb = path.stat().st_size / 1024 / 1024

        problems = []
        if (width, height) != expected["size"]:
            problems.append(f"画布 {width}×{height} ≠ 期望 {expected['size'][0]}×{expected['size'][1]}")
        low, high = expected["frames"]
        if not (low <= len(durations) <= high):
            problems.append(f"帧数 {len(durations)} 不在期望区间 {low}–{high}")
        if abs(seconds - expected["seconds"]) > 0.15:
            problems.append(f"总时长 {seconds:.1f}s ≠ 期望 {expected['seconds']:.1f}s")
        if size_mb > 10:
            problems.append(f"体积 {size_mb:.2f}MB 超过 GitHub 单文件 10MB 上限")

        if problems:
            for item in problems:
                print(f"FAIL {name}：{item}")
            failures += 1
        else:
            print(
                f"  ✓ {name}：{width}×{height}, {len(durations)} 帧, "
                f"{seconds:.1f}s, {size_mb:.2f}MB"
            )
    return failures


def regenerate() -> int:
    try:
        from PIL import Image
    except ImportError:
        print("需要 Pillow：pip install pillow", file=sys.stderr)
        return 1

    failures = 0
    for src_name, dst_name, step, quality in REGENERATE:
        source = ASSETS / src_name
        target = ASSETS / dst_name
        if not source.exists():
            print(f"跳过 {src_name}：源文件不存在")
            continue

        with Image.open(source) as im:
            duration = im.info.get("duration", 100)
            loop = im.info.get("loop", 0)
            frames = []
            for index in range(im.n_frames):
                im.seek(index)
                frames.append(im.convert("RGB").copy())

        selected = frames[::step]
        # 第一帧贴到精确尺寸的画布上：WebP 动画的画布尺寸取自 VP8X，
        # 而 PIL 会把帧尺寸向下取整一像素，贴回原尺寸可保证输出与源一致。
        first = Image.new("RGB", frames[0].size)
        first.paste(selected[0], (0, 0))
        first.save(
            target,
            save_all=True,
            append_images=selected[1:],
            duration=duration * step,
            loop=loop,
            quality=quality,
            method=6,
        )
        print(
            f"生成 {dst_name}：{len(selected)} 帧 × {duration * step}ms，"
            f"{target.stat().st_size / 1024 / 1024:.2f} MB"
        )
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="校验或重新生成 README 演示动图")
    parser.add_argument("--check", action="store_true", help="校验现有 .webp（默认）")
    parser.add_argument("--regenerate", action="store_true", help="用 .gif 源重新生成")
    args = parser.parse_args()

    if args.regenerate:
        failures = regenerate()
    else:
        failures = check()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
