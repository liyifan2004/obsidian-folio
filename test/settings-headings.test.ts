/**
 * 设置页**分组标题**的守卫。
 *
 * ## 这个文件在防什么
 *
 * Obsidian 官方规则 `settings-tab/no-problematic-settings-headings` 禁止
 * 设置分组标题里出现：插件名、`settings`、`options`、`general`。
 *
 * 这条规则是 **error 级**，而且同 fleet 的 obsidian-media-speed-enhancer
 * 1.0.42 就是因为「设置标题重复插件名」被商店审查打回、插件从目录列表下架。
 *
 * ## 为什么官方 eslint 规则不够
 *
 * 官方规则只检查 `setName("字面量")` 这种**直接字面量参数**。
 * 写成 `setName(t('ribbonTooltip'))` 就**查不出来** ——
 * 而本插件所有文案都走 `t()` 间接引用，规则全程沉默。
 *
 * 2026-11-12 实测发现：设置页第一个分组标题用的正是
 * `t('ribbonTooltip')` = "MultiFolio: 多栏工作区" —— **含插件名**。
 * lint 全绿，审查会打回。
 *
 * 所以这里按**实际渲染出来的文案**逐语言断言，而不是按源码。
 */
import { describe, expect, it } from "vitest";
import { DualPaneSettingTab } from "../src/settings";
import {
	__createdSettings,
	createContainerEl,
	type Plugin,
} from "./mocks/obsidian";
import {
	DEFAULT_SETTINGS,
	getAvailableLanguages,
	setLanguage,
	t,
	type Language,
} from "../src/types";

function makeTab(): DualPaneSettingTab {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS },
		saveSettings: async () => {
			/* noop */
		},
	} as unknown as Plugin;
	const tab = new DualPaneSettingTab(
		{} as unknown as ConstructorParameters<typeof DualPaneSettingTab>[0],
		plugin as unknown as ConstructorParameters<typeof DualPaneSettingTab>[1]
	);
	tab.containerEl = createContainerEl();
	return tab;
}

/** 拿到声明式路径实际渲染出来的分组标题。 */
function declarativeHeadings(): string[] {
	const defs = makeTab().getSettingDefinitions() as unknown as Array<{
		heading?: string;
	}>;
	return defs.map((d) => d.heading ?? "");
}

describe("设置页分组标题", () => {
	it("声明式路径的分组标题不含插件名", () => {
		for (const lang of getAvailableLanguages()) {
			setLanguage(lang);
			for (const heading of declarativeHeadings()) {
				expect(heading).not.toMatch(/MultiFolio/i);
			}
		}
		setLanguage("en");
	});

	it("声明式路径的分组标题不含被禁用的泛化词", () => {
		// 官方规则同时禁止 settings / options / general。
		for (const lang of getAvailableLanguages()) {
			setLanguage(lang);
			for (const heading of declarativeHeadings()) {
				expect(heading).not.toMatch(/\bsettings\b/i);
				expect(heading).not.toMatch(/\boptions\b/i);
				expect(heading).not.toMatch(/\bgeneral\b/i);
			}
		}
		setLanguage("en");
	});

	it("9 种语言的分组标题都非空（漏翻译会静默回退英文）", () => {
		for (const lang of getAvailableLanguages()) {
			setLanguage(lang);
			for (const heading of declarativeHeadings()) {
				expect(heading.trim().length).toBeGreaterThan(0);
			}
		}
		setLanguage("en");
	});

	it("分组标题在两条路径里一致", () => {
		for (const lang of getAvailableLanguages() as Language[]) {
			setLanguage(lang);

			// 命令式路径：setHeading() 的 Setting 行。
			__createdSettings.length = 0;
			const tab = makeTab();
			tab.display();
			const imperative = __createdSettings
				.filter((s) => s.heading)
				.map((s) => s.name ?? "");

			expect(imperative.length).toBe(declarativeHeadings().length);
			expect(imperative.sort()).toEqual(declarativeHeadings().sort());
		}
		setLanguage("en");
	});

	it("第一个分组用的是功能分类名，不是 Ribbon 的 tooltip", () => {
		// ribbonTooltip 是 Ribbon 图标的 tooltip（"MultiFolio: 多栏工作区"），
		// 含插件名。它只能用在 Ribbon 上，不能用作设置分组标题。
		expect(t("ribbonTooltip")).toMatch(/MultiFolio/i);
		expect(t("settingsGeneral")).not.toMatch(/MultiFolio/i);
	});
});
