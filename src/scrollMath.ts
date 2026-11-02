/**
 * 滚动同步的几何计算。
 *
 * 这里是纯函数（不碰 DOM、不 import obsidian），目的有两个：
 * 1. 正向（主窗格 → 跟随窗格）与反向（跟随窗格 → 主窗格）严格互逆；
 * 2. 可被单元测试直接验证，不依赖真实 Obsidian 环境。
 *
 * 历史背景：旧实现用硬编码的 ±0.5 比例做反向估算，隐含假设
 * 「窗格高度 = 文档可滚动高度的 50%」。该假设只在特定文档长度下成立，
 * 长文档上误差可达数万像素（见 docs/FEATURE_LEDGER.md 的 O-008）。
 * 现在改为按真实像素几何做逆运算，往返误差为 0。
 */

/** 跟随窗格相对主窗格的位置 */
export type FollowSide = 'left' | 'right';

/**
 * 把滚动位置钳制到合法区间。
 * maxScroll ≤ 0 表示文档不足以滚动，位置恒为 0。
 */
export function clampScroll(value: number, maxScroll: number): number {
	// NaN 传播到 scrollTop 会让浏览器静默忽略赋值，这里归零处理。
	if (Number.isNaN(value)) return 0;
	if (!(maxScroll > 0)) return 0;
	return Math.max(0, Math.min(value, maxScroll));
}

/**
 * 正向：主窗格 → 右侧跟随窗格。
 *
 * 右窗格显示主窗格可视底边之后的内容，并向前回退 overlapOffset 像素，
 * 使衔接处保留 overlapLines 行重叠内容。
 */
export function rightScrollFromMain(
	mainScroll: number,
	mainClientHeight: number,
	overlapOffset: number,
	rightMaxScroll: number
): number {
	return clampScroll(mainScroll + mainClientHeight - overlapOffset, rightMaxScroll);
}

/**
 * 正向：主窗格 → 左侧跟随窗格。
 *
 * 左窗格显示主窗格可视顶边之前的内容，并向后延伸 overlapOffset 像素。
 */
export function leftScrollFromMain(
	mainScroll: number,
	leftClientHeight: number,
	overlapOffset: number,
	leftMaxScroll: number
): number {
	return clampScroll(mainScroll - leftClientHeight + overlapOffset, leftMaxScroll);
}

/**
 * 反向：右侧跟随窗格 → 主窗格。
 *
 * 与 {@link rightScrollFromMain} 严格互逆（文档末端饱和除外——此时右窗格
 * 已滚到底，无法区分主窗格的具体位置，属于信息本身缺失，非计算误差）。
 */
export function mainScrollFromRight(
	rightScroll: number,
	mainClientHeight: number,
	overlapOffset: number,
	mainMaxScroll: number
): number {
	return clampScroll(rightScroll - mainClientHeight + overlapOffset, mainMaxScroll);
}

/**
 * 反向：左侧跟随窗格 → 主窗格。
 *
 * 与 {@link leftScrollFromMain} 严格互逆（文档首端饱和除外）。
 */
export function mainScrollFromLeft(
	leftScroll: number,
	leftClientHeight: number,
	overlapOffset: number,
	mainMaxScroll: number
): number {
	return clampScroll(leftScroll + leftClientHeight - overlapOffset, mainMaxScroll);
}

/**
 * 翻页：按可视高度整页滚动并钳制。
 */
export function pageScrollTarget(
	currentScroll: number,
	clientHeight: number,
	direction: 'up' | 'down',
	maxScroll: number
): number {
	const delta = direction === 'down' ? clientHeight : -clientHeight;
	return clampScroll(currentScroll + delta, maxScroll);
}
