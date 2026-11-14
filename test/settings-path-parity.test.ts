/**
 * 两条渲染路径的**约束一致**与**落盘**守卫。
 *
 * ## 这个文件在防什么
 *
 * folio 有两条设置页渲染路径：
 *   - 声明式（Obsidian 1.13+）：`getSettingDefinitions()` + `setControlValue()`；
 *   - 命令式（Obsidian 1.8.7–1.12）：`display()` 里的 `new Setting(...)`。
 *
 * 两条路径表达的是**同一组设置**，但代码是两处。历史上它们悄悄漂移过：
 *
 * 1. **约束各写一遍**。声明式写 `max: 10`，命令式写 `setLimits(0, 10, 1)`。
 *    改了一处另一处不跟着变 —— 1.13+ 的用户能写出 `overlapLines = 50`，
 *    1.12 的用户写不出来。`overlapLines` 参与滚动偏移计算，
 *    50 行重叠在双栏阅读里是严重的视觉错位，而用户拿不到任何提示。
 * 2. **落盘没被断言**。`saveSettings()` 的桩是空实现，
 *    于是「改了设置但没写盘」对所有断言隐形 —— 界面显示改成功了，
 *    重启后全部丢失。
 *
 * ## 断言的对象
 *
 * 用户能感知的东西：滑块能拖到哪、下拉里有哪些选项、改完会不会保住。
 * 不是「某个中间结构的记录」。
 *
 * 反证（2026-11-15 实测，修复前）：
 *   - 删掉 `setControlValue` 里的 `await this.plugin.saveSettings()` → 64/64 通过
 *   - 删掉命令式 `onChange` 里的 `await this.plugin.saveSettings()` → 64/64 通过
 *   - 声明式滑块 max 改成 99 → 64/64 通过
 */
import { describe, expect, it, beforeEach } from "vitest";
import { DualPaneSettingTab, OVERLAP_LINES_LIMITS } from "../src/settings";
import {
	__createdControls,
	__setApiVersion,
	createContainerEl,
	type Plugin,
} from "./mocks/obsidian";
import { DEFAULT_SETTINGS, setLanguage } from "../src/types";

type CountingPlugin = Plugin & {
	settings: typeof DEFAULT_SETTINGS;
	saveSettings: () => Promise<void>;
	saveCount: number;
};

function makePlugin(): CountingPlugin {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS },
		saveCount: 0,
		saveSettings: async () => {
			plugin.saveCount++;
		},
	};
	return plugin as unknown as CountingPlugin;
}

function makeTab(plugin: CountingPlugin = makePlugin()): DualPaneSettingTab {
	const tab = new DualPaneSettingTab(
		{} as unknown as ConstructorParameters<typeof DualPaneSettingTab>[0],
		plugin as unknown as ConstructorParameters<typeof DualPaneSettingTab>[1],
	);
	tab.containerEl = createContainerEl();
	return tab;
}

/** 声明式路径的控件约束。 */
function declarativeConstraints(): {
	slider: { min?: number; max?: number; step?: number };
	dropdownOptions: string[];
} {
	const defs = makeTab().getSettingDefinitions() as unknown as {
		items?: {
			control?: {
				key?: string;
				type?: string;
				min?: number;
				max?: number;
				step?: number;
				options?: Record<string, string>;
			};
		}[];
	}[];
	const items = defs.flatMap((d) => d.items ?? []);
	const overlap = items.find((i) => i.control?.key === "overlapLines");
	const language = items.find((i) => i.control?.key === "language");
	return {
		slider: {
			min: overlap?.control?.min,
			max: overlap?.control?.max,
			step: overlap?.control?.step,
		},
		dropdownOptions: Object.keys(language?.control?.options ?? {}),
	};
}

/** 命令式路径的控件约束 —— 走真实的 display()。 */
function imperativeConstraints(): {
	slider: { min?: number; max?: number; step?: number };
	dropdownOptions: string[];
} {
	__setApiVersion("1.12.3");
	__createdControls.length = 0;
	const tab = makeTab();
	try {
		tab.display();
	} finally {
		__setApiVersion("1.13.0");
	}
	const slider = __createdControls.find((c) => c.kind === "slider");
	const dropdown = __createdControls.find((c) => c.kind === "dropdown");
	return {
		slider: { min: slider?.min, max: slider?.max, step: slider?.step },
		dropdownOptions: dropdown?.options ?? [],
	};
}

describe("两条路径的滑块约束一致", () => {
	beforeEach(() => {
		__createdControls.length = 0;
	});

	it("声明式与命令式的 min / max / step 完全相同", () => {
		const declarative = declarativeConstraints();
		const imperative = imperativeConstraints();

		expect(declarative.slider.min).toBe(imperative.slider.min);
		expect(declarative.slider.max).toBe(imperative.slider.max);
		expect(declarative.slider.step).toBe(imperative.slider.step);
	});

	it("约束等于共享常量（不是两处各写一遍）", () => {
		const declarative = declarativeConstraints();
		const imperative = imperativeConstraints();

		expect(declarative.slider).toEqual({
			min: OVERLAP_LINES_LIMITS.min,
			max: OVERLAP_LINES_LIMITS.max,
			step: OVERLAP_LINES_LIMITS.step,
		});
		expect(imperative.slider).toEqual({
			min: OVERLAP_LINES_LIMITS.min,
			max: OVERLAP_LINES_LIMITS.max,
			step: OVERLAP_LINES_LIMITS.step,
		});
	});
});

describe("两条路径的语言选项一致", () => {
	it("下拉选项集合完全相同（用户在 1.13+ 下也能选到全部语言）", () => {
		const declarative = declarativeConstraints().dropdownOptions.sort();
		const imperative = imperativeConstraints().dropdownOptions.sort();

		expect(declarative.length).toBeGreaterThan(1);
		expect(declarative).toEqual(imperative);
	});
});

describe("两条路径都会落盘", () => {
	beforeEach(() => {
		__createdControls.length = 0;
	});

	it("声明式路径改滑块会调用 saveSettings", async () => {
		const plugin = makePlugin();
		const tab = makeTab(plugin);

		await tab.setControlValue("overlapLines", 7);

		expect(plugin.settings.overlapLines).toBe(7);
		expect(plugin.saveCount, "声明式路径没有落盘 —— 用户重启后设置会丢").toBe(1);
	});

	it("命令式路径拖滑块会调用 saveSettings", async () => {
		__setApiVersion("1.12.3");
		__createdControls.length = 0;
		const plugin = makePlugin();
		const tab = makeTab(plugin);
		tab.display();

		const slider = __createdControls.find((c) => c.kind === "slider");
		expect(slider, "命令式路径没有创建滑块").toBeDefined();

		await slider!.change(7);

		expect(plugin.settings.overlapLines).toBe(7);
		expect(plugin.saveCount, "命令式路径没有落盘 —— 用户重启后设置会丢").toBe(1);

		__setApiVersion("1.13.0");
	});

	it("命令式路径换语言会调用 saveSettings", async () => {
		__setApiVersion("1.12.3");
		__createdControls.length = 0;
		const plugin = makePlugin();
		const tab = makeTab(plugin);
		tab.display();

		const dropdown = __createdControls.find((c) => c.kind === "dropdown");
		expect(dropdown, "命令式路径没有创建语言下拉").toBeDefined();

		await dropdown!.change("ja");
		setLanguage("en");

		expect(plugin.settings.language).toBe("ja");
		expect(plugin.saveCount, "命令式路径换语言没有落盘").toBe(1);

		__setApiVersion("1.13.0");
	});
});
