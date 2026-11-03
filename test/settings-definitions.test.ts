import { describe, expect, it } from "vitest";
import { DualPaneSettingTab } from "../src/settings";
import {
	__setApiVersion,
	createContainerEl,
	type Plugin,
} from "./mocks/obsidian";
import { DEFAULT_SETTINGS, setLanguage } from "../src/types";

/**
 * 设置页双轨结构的回归测试。
 *
 * 背景：本插件 minAppVersion = 1.8.7（< 1.13），因此 `display()` 必须保留
 * ——官方 eslint 规则 `obsidianmd/settings-tab/require-display` 在
 * minAppVersion < 1.13.0 时强制要求它。同时 1.13+ 又希望用声明式 API
 * 进设置搜索索引。两条路径并存是官方支持的用法。
 *
 * 这里锁定三件事：
 *   1. 声明式定义存在，且把两个可绑定设置项声明为 control（可被搜索索引）；
 *   2. 自定义区块用 `render` 而不是 control（它们不是设置项，只是说明）；
 *   3. 语言切换后的刷新在两条路径上分别调用正确的 API
 *      （1.13+ 用 update()，旧版用 display()）。
 */

/** 最小可用的插件桩：设置页只用到 plugin.settings 与 plugin.saveSettings()。 */
function makePlugin(): Plugin & {
	settings: typeof DEFAULT_SETTINGS;
	saveSettings: () => Promise<void>;
} {
	return {
		settings: { ...DEFAULT_SETTINGS },
		saveSettings: async () => {
			/* noop */
		},
	} as unknown as Plugin & {
		settings: typeof DEFAULT_SETTINGS;
		saveSettings: () => Promise<void>;
	};
}

function makeTab(): DualPaneSettingTab {
	// The mock's `App`/`Plugin` are structural stand-ins, not the real
	// classes, so cast through `unknown` at the boundary.
	const tab = new DualPaneSettingTab(
		{} as unknown as ConstructorParameters<typeof DualPaneSettingTab>[0],
		makePlugin() as unknown as ConstructorParameters<typeof DualPaneSettingTab>[1],
	);
	// The imperative renderer needs a container to render into.
	tab.containerEl = createContainerEl();
	return tab;
}

/** 定义项是联合类型，这里只取判定所需的公共字段。 */
type AnyItem = {
	name?: string;
	desc?: string;
	control?: { key?: string; type?: string };
	render?: unknown;
	searchable?: boolean;
	items?: AnyItem[];
};

describe("声明式设置定义", () => {
	it("返回非空数组（否则 1.13+ 不会接管渲染，会退回 display()）", () => {
		const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
		expect(Array.isArray(defs)).toBe(true);
		expect(defs.length).toBeGreaterThan(0);
	});

	it("两个可绑定设置项声明为 control，才能进设置搜索索引", () => {
		const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
		const controls = defs.flatMap((d) => d.items ?? []).filter((i) => i.control);
		const keys = controls.map((c) => c.control?.key).sort();

		expect(keys).toEqual(["language", "overlapLines"]);
	});

	it("overlapLines 声明为 slider，语言声明为 dropdown", () => {
		const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
		const items = defs.flatMap((d) => d.items ?? []);
		const overlap = items.find((i) => i.control?.key === "overlapLines");
		const language = items.find((i) => i.control?.key === "language");

		expect(overlap?.control?.type).toBe("slider");
		expect(language?.control?.type).toBe("dropdown");
	});

	it("自定义区块用 render 而非 control（它们是说明，不是设置项）", () => {
		const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
		const items = defs.flatMap((d) => d.items ?? []);
		const rendered = items.filter((i) => typeof i.render === "function");

		// 命令列表 / 功能说明 / 支持链接 三个自定义区块
		expect(rendered.length).toBe(3);
		for (const r of rendered) {
			expect(r.control).toBeUndefined();
			// 说明性内容不该出现在设置搜索结果里
			expect(r.searchable).toBe(false);
		}
	});

	it("每个定义项都有可读的名字（搜索索引依赖它）", () => {
		const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
		for (const d of defs) {
			for (const item of d.items ?? []) {
				expect(item.name, "定义项缺少 name").toBeTruthy();
			}
		}
	});
});

describe("控件读写绑定", () => {
	it("getControlValue 从 plugin.settings 读", () => {
		const tab = makeTab();
		tab.getControlValue("overlapLines");
		expect(tab.getControlValue("overlapLines")).toBe(DEFAULT_SETTINGS.overlapLines);
		expect(tab.getControlValue("language")).toBe(DEFAULT_SETTINGS.language);
	});

	it("setControlValue 写入 plugin.settings", async () => {
		const tab = makeTab();
		await tab.setControlValue("overlapLines", 7);
		expect(tab.getControlValue("overlapLines")).toBe(7);
	});
});

describe("语言切换后的刷新路径", () => {
	it("1.13+ 走 update()，不会退回 display()", async () => {
		__setApiVersion("1.13.0");
		const tab = makeTab();

		let updateCalls = 0;
		let displayCalls = 0;
		tab.update = () => {
			updateCalls++;
		};
		tab.display = () => {
			displayCalls++;
		};

		await tab.setControlValue("language", "ja");
		setLanguage("en");

		expect(updateCalls).toBe(1);
		expect(displayCalls).toBe(0);
	});

	it("1.13 以下走命令式渲染（旧版唯一的渲染器）", async () => {
		__setApiVersion("1.12.3");
		const tab = makeTab();

		let updateCalls = 0;
		tab.update = () => {
			updateCalls++;
		};

		// Count how often the imperative renderer repopulates the container.
		let emptyCalls = 0;
		const container = tab.containerEl;
		const originalEmpty = container.empty.bind(container);
		(container as unknown as { empty: () => void }).empty = () => {
			emptyCalls++;
			originalEmpty();
		};

		await tab.setControlValue("language", "ja");
		setLanguage("en");

		// The imperative path re-rendered, and the declarative one did not.
		expect(emptyCalls).toBeGreaterThan(0);
		expect(updateCalls).toBe(0);

		// 复位，避免影响后续用例
		__setApiVersion("1.13.0");
	});
});
