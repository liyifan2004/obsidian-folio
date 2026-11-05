/**
 * 声明式 settings 的「render 回调契约」守卫。
 *
 * ## 这个文件在防什么
 *
 * Obsidian 1.13+ 的声明式渲染器有两条实测踩过的契约：
 *
 * 1. **`render()` 的返回值会被当作「行销毁前的清理函数」调用。**
 *    官方 d.ts（obsidian 1.14.4）的签名是
 *    `render: (setting: Setting, group: SettingGroup) => void | (() => void)`。
 *    如果实现写成表达式体并返回了非函数值
 *    （例如 `render: (s) => s.addDropdown(...)` 返回 Setting 组件对象），
 *    Obsidian 会把它当函数调用 →
 *    `TypeError: t is not a function` → **设置子页面永远打不开**。
 *    （社区插件 PKM-er/obsidian-editing-toolbar 4.1.6 的真实事故。）
 *
 * 2. **自定义块必须画进还活着的容器。**
 *    Obsidian 的 `Setting` 结构是 `settingEl > (infoEl, controlEl)`。
 *    `setting.settingEl.empty()` 会把 controlEl 一起清掉（脱离 DOM），
 *    之后往 controlEl 画的内容**不会出现在页面上**。
 *
 * 这两条都是「源码看起来对」但运行时会炸的缺陷 —— typecheck 过、lint 过、
 * 单测也可能全绿。本文件用**行为断言**把它们钉住。
 *
 * ## 为什么不复用 test/mocks/obsidian.ts 里的 Setting 桩
 *
 * 那个桩的 `empty()` 只清 children 数组，不跟踪「脱离」状态，
 * 也没有 `settingEl` / `infoEl` —— 而「A 被清空导致 B 失效」这类缺陷
 * 在「每个属性都是独立对象」的朴素桩里天然查不出来。
 * 所以这里自己造一个能跟踪脱离状态的 fake。
 */
import { describe, expect, it } from "vitest";
import { DualPaneSettingTab } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/types";

/** 模拟 Obsidian 的容器：empty() 会让子容器脱离 DOM。 */
class FakeEl {
	children: FakeEl[] = [];
	/** 被 empty() 清掉后为 false —— 表示「已脱离 DOM」。 */
	attached = true;
	classes: string[] = [];

	appendChild(child: FakeEl): FakeEl {
		this.children.push(child);
		return child;
	}

	createDiv(cls?: string): FakeEl {
		const el = new FakeEl();
		if (cls) el.classes.push(cls);
		this.appendChild(el);
		return el;
	}

	createSpan(cls?: string): FakeEl {
		const el = new FakeEl();
		if (cls) el.classes.push(cls);
		this.appendChild(el);
		return el;
	}

	createEl(tag: string): FakeEl {
		const el = new FakeEl();
		this.appendChild(el);
		return el;
	}

	addClass(cls: string): void {
		this.classes.push(cls);
	}

	setText(_text: string): void {
		/* noop */
	}

	/**
	 * 清空自身与全部后代，并把后代标记为「已脱离 DOM」。
	 *
	 * 关键：真实 Obsidian 的 settingEl.empty() 会**连带清掉 controlEl**
	 *（controlEl 是 settingEl 的子节点），清掉之后往 controlEl 里画的内容
	 * 不会出现在页面上。所以必须递归把子节点也标记为脱离。
	 */
	empty(): void {
		const walk = (el: FakeEl) => {
			el.attached = false;
			for (const child of el.children) walk(child);
			el.children.length = 0;
		};
		walk(this);
		this.attached = false;
	}
}

/**
 * 模拟 Obsidian 的 Setting。
 *
 * 父子关系与真实 Obsidian 一致：`settingEl > (infoEl, controlEl)`。
 */
class FakeSetting {
	settingEl = new FakeEl();
	infoEl = new FakeEl();
	controlEl = new FakeEl();
	name = "";

	constructor() {
		this.settingEl.appendChild(this.infoEl);
		this.settingEl.appendChild(this.controlEl);
	}

	setName(n: string): this {
		this.name = n;
		return this;
	}

	setDesc(): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	setClass(): this {
		return this;
	}

	addButton(): this {
		return this;
	}

	addToggle(): this {
		return this;
	}

	addText(): this {
		return this;
	}

	addTextArea(): this {
		return this;
	}

	addDropdown(): this {
		return this;
	}

	addSlider(): this {
		return this;
	}
}

/**
 * 模拟 Obsidian 1.13+ 声明式渲染器对 render 回调的处理。
 *
 * 返回值非 undefined 且非函数 → 抛 TypeError，与真实 Obsidian 一致
 * （`TypeError: t is not a function`）。
 */
function invokeRender(
	render: (setting: unknown, group: unknown) => unknown,
	setting: FakeSetting
): void {
	const result = render(setting, undefined);
	if (result !== undefined && result !== null) {
		if (typeof result !== "function") {
			throw new TypeError("t is not a function");
		}
		(result as () => void)();
	}
}

function makeTab(): DualPaneSettingTab {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS },
		saveSettings: async () => {
			/* noop */
		},
	};
	const tab = new DualPaneSettingTab(
		{} as unknown as ConstructorParameters<typeof DualPaneSettingTab>[0],
		plugin as unknown as ConstructorParameters<typeof DualPaneSettingTab>[1]
	);
	return tab;
}

type AnyItem = {
	name?: string;
	render?: (setting: unknown, group: unknown) => unknown;
	items?: AnyItem[];
};

function renderItems(): AnyItem[] {
	const defs = makeTab().getSettingDefinitions() as unknown as AnyItem[];
	return defs.flatMap((d) => d.items ?? []);
}

describe("声明式 render 回调契约", () => {
	it("每个 render 回调的返回值都必须是 undefined（不能返回组件对象）", () => {
		const items = renderItems();
		let checked = 0;
		for (const item of items) {
			const render = item.render;
			if (!render) continue;
			// **直接断言表达式体本身的返回值**，而不是「它调用的方法的返回值」。
			// `render: (s) => this.renderX(s)` 里 renderX 返回 undefined，
			// 于是表达式体也返回 undefined（安全）；
			// 但 `render: (s) => s.addDropdown(...)` 会返回 Setting 对象 ——
			// 守卫必须盯住**表达式体**这个边界。
			const result = render(new FakeSetting(), undefined);
			expect(result).toBeUndefined();

			// 再用真实 Obsidian 的语义跑一遍：返回值被当清理函数调用。
			expect(() => invokeRender(render, new FakeSetting())).not.toThrow();
			checked += 1;
		}
		// 必须真的覆盖到至少一个 render 回调，否则这个用例是空跑。
		expect(checked).toBeGreaterThan(0);
	});

	it("自定义块画进的容器没有被脱离 DOM", () => {
		const items = renderItems();
		let checked = 0;
		for (const item of items) {
			const render = item.render;
			if (!render) continue;
			const setting = new FakeSetting();
			invokeRender(render, setting);
			// controlEl 必须还「活着」—— 否则往里画的内容不会出现在页面上。
			expect(setting.controlEl.attached).toBe(true);
			checked += 1;
		}
		expect(checked).toBeGreaterThan(0);
	});
});
