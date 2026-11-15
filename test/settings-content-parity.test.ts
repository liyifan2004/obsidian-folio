/**
 * 两条渲染路径的**内容**对等守卫。
 *
 * ## 这个文件在防什么
 *
 * folio 的设置页有两条渲染路径：
 *   - 声明式（Obsidian 1.13+）：`getSettingDefinitions()` + 每项的 `render` 回调；
 *   - 命令式（1.8.7–1.12）：`display()` 里手写的 `new Setting(...)`。
 *
 * 两条路径表达同一组设置，但代码是两处。历史上它们漂移过 ——
 * 而且漂移的是**内容**，不是行数：
 *
 * 1. **命令列表的内容**。`renderCommands()` 把 7 个命令画成嵌套的
 *    `div.multifolio-command > span.multifolio-command-name`。
 *    把那个 for 循环整个删掉 —— 命令列表全没 —— 原来 64 个测试**全部通过**。
 * 2. **功能说明的内容**。`renderFeatures()` 画 3 张卡片（标题 + 描述）。
 *    声明式路径的 `renderCommands` 换成 `renderFeatures`（数量不变，内容完全不同）
 *    → 同样 64/64 通过。
 *
 * 根因是**断言的对象**：
 * 现有断言看的是「行名 + 控件类型」，那是中间结构的记录，
 * 不是用户能感知的东西。而命令名是通过 `createDiv({text})` 画进**嵌套容器**的，
 * 没有任何断言看得到它。
 *
 * ## 修法
 *
 * mock 现在记录每个元素直接创建的可见内容，`collectVisibleContent()`
 * 跨容器边界收集「用户能看到的文字」。
 *
 * 这个函数是从 `obsidian-jev-inbox-router` 搬过来的 —— 同 fleet 的机械复用，
 * 不是重新设计（JEV 那边先加的，理由也一样）。
 */
import { describe, expect, it, beforeEach } from "vitest";
import { DualPaneSettingTab } from "../src/settings";
import {
	Setting,
	__createdSettings,
	__setApiVersion,
	collectVisibleContent,
	collectVisibleContentWithClass,
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

/**
 * 声明式路径：跑每一项的 render，把它们产出的可见内容收起来。
 *
 * 分组标题（`group.heading`）由 Obsidian 自己渲染成 `<h3>`，
 * 不在 Setting 行里 —— 所以这里**不收**它，
 * 命令式路径那侧同理（标题行单独一行，不属于内容行）。
 * 标题一致性由 `test/settings-headings.test.ts` 负责。
 */
function declarativeVisibleContent(withClass = false): string[] {
	const tab = makeTab();
	const items = (tab.getSettingDefinitions() as unknown as {
		items?: {
			name?: string;
			desc?: string;
			control?: { key?: string };
			render?: (setting: unknown) => void;
		}[];
	}[]).flatMap((d) => d.items ?? []);

	const collect = withClass ? collectVisibleContentWithClass : collectVisibleContent;
	const out: string[] = [];
	for (const item of items) {
		// 用 mock 的 Setting 桩当宿主 —— 它自带 controlEl / setName / setDesc，
		// 正是 render 回调需要的形状。
		const host = new Setting(createContainerEl());
		// 真实 Obsidian 会用定义里的 name / desc 填好这一行，
		// 然后才调 render（或挂 control 控件）。
		if (item.name) host.setName(item.name);
		if (item.desc) host.setDesc(item.desc);
		if (item.render) {
			item.render(host);
		}
		// 信息列（行名 + 行描述）与控制列（正文）都要收 ——
		// 用户看到的是整行，不是其中一半。
		out.push(...collect(host.infoEl));
		out.push(...collect(host.controlEl));
	}
	return out;
}

/**
 * 命令式路径：跑真实的 display()，拿到渲染后的容器。
 *
 * 标题行（`setHeading()`）要单独挑出来 ——
 * 声明式路径的标题由 Obsidian 渲染成 `<h3>`（不在 Setting 行里），
 * 命令式路径的标题是一行 Setting。两边要按「标题 vs 内容」对齐后再比。
 */
function imperativeContainer(): HTMLElement {
	__setApiVersion("1.12.3");
	__createdSettings.length = 0;
	const tab = makeTab();
	try {
		tab.display();
	} finally {
		__setApiVersion("1.13.0");
	}
	return tab.containerEl;
}

/** 命令式路径的可见内容（去掉标题行）。 */
function imperativeVisibleContent(withClass = false): string[] {
	const collect = withClass ? collectVisibleContentWithClass : collectVisibleContent;
	return collect(imperativeContainer());
}

/**
 * 两条路径的标题。
 *
 * 声明式：`group.heading` 字段。
 * 命令式：`setHeading()` 产生的标题行。
 *
 * 两者都只含分组标题，不含自定义块的行名 ——
 * 自定义块在声明式路径里清掉了 infoEl，在命令式路径里也没写行名。
 */
function declarativeHeadings(): string[] {
	const defs = makeTab().getSettingDefinitions() as unknown as { heading?: string }[];
	return defs.map((d) => d.heading ?? "").filter((h) => h !== "");
}

function imperativeHeadings(): string[] {
	imperativeContainer();
	return __createdSettings
		.filter((s) => s.heading)
		.map((s) => s.name)
		.filter((n): n is string => typeof n === "string");
}

describe("两条路径的可见内容一致", () => {
	beforeEach(() => {
		__createdSettings.length = 0;
		setLanguage("en");
	});

	it("命令式路径画出了命令名（不是空列表）", () => {
		const content = imperativeVisibleContent(true);

		// 命令名画成 span.multifolio-command-name，文字是 7 个命令。
		const commandNames = content.filter((c) => c.includes("multifolio-command-name"));
		expect(commandNames.length, "命令列表的内容没有被画出来").toBe(7);
		expect(commandNames).toContain("span|multifolio-command-name|Toggle Dual Pane Mode");
	});

	it("命令式路径画出了功能卡片标题与描述", () => {
		const content = imperativeVisibleContent(true);

		const titles = content.filter((c) => c.includes("multifolio-feature-name"));
		const descs = content.filter((c) => c.includes("multifolio-feature-desc"));
		expect(titles.length, "功能说明的标题没有被画出来").toBe(3);
		expect(descs.length, "功能说明的描述没有被画出来").toBe(3);
	});

	it("两条路径的分组标题一致", () => {
		expect(declarativeHeadings().sort()).toEqual(imperativeHeadings().sort());
	});

	it("两条路径产出的可见内容完全相同", () => {
		const declarative = declarativeVisibleContent().sort();
		// 命令式路径的标题行也要拿掉 —— 标题单独比（上面那条），
		// 这里只比「内容」。
		//
		// 标题行在收集结果里是 `div|<标题文字>`（信息列里的名字）。
		// 不能按文字匹配 —— 「Documentation」既是分组标题，
		// 也是支持链接里的链接文字，按文字匹配会把链接一起删掉。
		// 所以这里按「行是不是标题行」来区分。
		const headingTexts = new Set(imperativeHeadings());
		const imperative = imperativeVisibleContent()
			.filter((c) => !(c.startsWith("div|") && headingTexts.has(c.slice(4))))
			.sort();

		expect(declarative.length, "声明式路径没产出可见内容").toBeGreaterThan(0);
		expect(declarative).toEqual(imperative);
	});

	it("命令列表的内容在两条路径里逐项相同", () => {
		const pick = (all: string[]) => all.filter((c) => c.includes("multifolio-command-name"));

		const declarative = pick(declarativeVisibleContent(true));
		const imperative = pick(imperativeVisibleContent(true));

		expect(imperative.length).toBeGreaterThan(0);
		expect(declarative).toEqual(imperative);
	});

	it("功能说明的内容在两条路径里逐项相同", () => {
		const pick = (all: string[]) =>
			all.filter((c) => c.includes("multifolio-feature-name") || c.includes("multifolio-feature-desc"));

		const declarative = pick(declarativeVisibleContent(true));
		const imperative = pick(imperativeVisibleContent(true));

		expect(imperative.length).toBeGreaterThan(0);
		expect(declarative).toEqual(imperative);
	});
});
