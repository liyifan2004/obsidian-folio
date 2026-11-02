import { describe, expect, it } from "vitest";
import {
	clampScroll,
	leftScrollFromMain,
	mainScrollFromLeft,
	mainScrollFromRight,
	pageScrollTarget,
	rightScrollFromMain
} from "../src/scrollMath";

/**
 * 滚动几何的往返一致性测试。
 *
 * 旧实现（followMode.doSync）用硬编码的 ±0.5 比例反推主窗格位置，
 * 隐含「窗格高度 = 文档可滚动高度的 50%」的错误假设。
 * 这里锁定新实现的几何不变量：正向与反向严格互逆，往返误差为 0。
 */

const CLIENT = 800; // 窗格可视高度
const OVERLAP = 56; // 重叠偏移（2 行 × 28px）

describe("clampScroll", () => {
	it("把位置钳制到 [0, maxScroll]", () => {
		expect(clampScroll(-100, 1000)).toBe(0);
		expect(clampScroll(500, 1000)).toBe(500);
		expect(clampScroll(5000, 1000)).toBe(1000);
	});

	it("文档不足以滚动时恒为 0", () => {
		expect(clampScroll(500, 0)).toBe(0);
		expect(clampScroll(500, -100)).toBe(0);
	});

	it("非法输入退化为 0 而不是 NaN", () => {
		expect(clampScroll(NaN, 1000)).toBe(0);
		expect(clampScroll(Infinity, 1000)).toBe(1000);
	});
});

describe("右窗格：正向与反向严格互逆", () => {
	const maxScroll = 20000;

	it("往返误差为 0", () => {
		const step = Math.max(1, Math.floor(maxScroll / 50));
		for (let mainScroll = 0; mainScroll <= maxScroll; mainScroll += step) {
			const rightScroll = rightScrollFromMain(mainScroll, CLIENT, OVERLAP, maxScroll);

			// 文档末端饱和时右窗格已滚到底，主窗格位置不可知——信息缺失，非计算误差。
			const saturated = rightScroll >= maxScroll && mainScroll + CLIENT - OVERLAP > maxScroll;
			if (saturated) continue;

			const recovered = mainScrollFromRight(rightScroll, CLIENT, OVERLAP, maxScroll);
			expect(recovered).toBeCloseTo(mainScroll, 6);
		}
	});

	it("旧实现（±0.5 比例）在长文档上偏差巨大", () => {
		// 保留对照：说明为何必须换掉硬编码比例。
		// 旧实现的误差峰值出现在文档两端（主窗格在顶部/底部时）。
		const mainScroll = 10000;
		const rightScroll = rightScrollFromMain(mainScroll, CLIENT, OVERLAP, maxScroll);
		const ratio = rightScroll / maxScroll;

		const legacy = Math.max(0, ratio - 0.5) * maxScroll;
		const fixed = mainScrollFromRight(rightScroll, CLIENT, OVERLAP, maxScroll);

		expect(Math.abs(legacy - mainScroll)).toBeGreaterThan(9000);
		expect(fixed).toBeCloseTo(mainScroll, 6);
	});
});

describe("左窗格：正向与反向严格互逆", () => {
	const maxScroll = 20000;

	it("往返误差为 0", () => {
		const step = Math.max(1, Math.floor(maxScroll / 50));
		for (let mainScroll = 0; mainScroll <= maxScroll; mainScroll += step) {
			const leftScroll = leftScrollFromMain(mainScroll, CLIENT, OVERLAP, maxScroll);

			// 文档首端饱和时左窗格已滚到顶，主窗格位置不可知。
			const saturated = leftScroll <= 0 && mainScroll - CLIENT + OVERLAP < 0;
			if (saturated) continue;

			const recovered = mainScrollFromLeft(leftScroll, CLIENT, OVERLAP, maxScroll);
			expect(recovered).toBeCloseTo(mainScroll, 6);
		}
	});

	it("旧实现（±0.5 比例）在长文档上偏差巨大", () => {
		const mainScroll = 10000;
		const leftScroll = leftScrollFromMain(mainScroll, CLIENT, OVERLAP, maxScroll);
		const ratio = leftScroll / maxScroll;

		const legacy = Math.min(1, ratio + 0.5) * maxScroll;
		const fixed = mainScrollFromLeft(leftScroll, CLIENT, OVERLAP, maxScroll);

		expect(Math.abs(legacy - mainScroll)).toBeGreaterThan(9000);
		expect(fixed).toBeCloseTo(mainScroll, 6);
	});
});

describe("重叠量参与几何计算", () => {
	it("重叠为 0 时右窗格正好接在主窗格可视底边之后", () => {
		expect(rightScrollFromMain(1000, CLIENT, 0, 20000)).toBe(1000 + CLIENT);
	});

	it("重叠越大，右窗格越靠前", () => {
		const small = rightScrollFromMain(1000, CLIENT, 56, 20000);
		const large = rightScrollFromMain(1000, CLIENT, 560, 20000);
		expect(large).toBeLessThan(small);
		expect(small - large).toBe(504);
	});

	it("重叠量在正反两向对称生效", () => {
		const mainScroll = 5000;
		const rightScroll = rightScrollFromMain(mainScroll, CLIENT, OVERLAP, 20000);
		expect(mainScrollFromRight(rightScroll, CLIENT, OVERLAP, 20000)).toBeCloseTo(mainScroll, 6);
	});
});

describe("文档不足以滚动", () => {
	it("主窗格无滚动空间时跟随窗格定位到 0", () => {
		expect(rightScrollFromMain(0, CLIENT, OVERLAP, 0)).toBe(0);
		expect(leftScrollFromMain(0, CLIENT, OVERLAP, 0)).toBe(0);
	});

	it("右窗格在顶部时反推主窗格为 0", () => {
		// 右窗格顶部 = 主窗格顶边之后 clientHeight - overlap 处
		expect(mainScrollFromRight(0, CLIENT, OVERLAP, 20000)).toBe(0);
	});

	it("左窗格在顶部时反推主窗格为 clientHeight - overlap", () => {
		// 与正向公式严格互逆：leftScroll = mainScroll - clientHeight + overlap
		expect(mainScrollFromLeft(0, CLIENT, OVERLAP, 20000)).toBe(CLIENT - OVERLAP);
	});
});

describe("pageScrollTarget", () => {
	it("向下翻一整页", () => {
		expect(pageScrollTarget(1000, CLIENT, "down", 20000)).toBe(1000 + CLIENT);
	});

	it("向上翻一整页", () => {
		expect(pageScrollTarget(1000, CLIENT, "up", 20000)).toBe(1000 - CLIENT);
	});

	it("在文档开头上翻不越界", () => {
		expect(pageScrollTarget(100, CLIENT, "up", 20000)).toBe(0);
	});

	it("在文档末尾下翻不越界", () => {
		expect(pageScrollTarget(19500, CLIENT, "down", 20000)).toBe(20000);
	});
});
