/**
 * Obsidian API 的最小桩模块。
 *
 * 只在测试里使用（通过 vitest.config.mts 的 alias 把 "obsidian" 指到这里）。
 * 只实现被测代码真正用到的那部分 API，行为尽量贴近真实 Obsidian。
 * 类形状与真实声明保持结构兼容，这样测试代码也能通过 tsc。
 */

import type { Vault } from "obsidian";

export class TAbstractFile {
	vault: Vault = undefined as unknown as Vault;
	path = "";
	name = "";
	parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
	basename = "";
	extension = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];

	isRoot(): boolean {
		return this.path === "";
	}
}

/** 与 Obsidian 一致：统一分隔符、去掉首尾斜杠 */
export function normalizePath(input: string): string {
	return String(input ?? "")
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

// ---------------------------------------------------------------- i18n 桩

/**
 * Obsidian 界面语言。src/types.ts 通过 getLanguage() 检测界面语言，
 * 测试里默认 "zh-cn"，需要其他语言用 __setLanguage() 临时切换。
 */
let mockLanguage = "zh-cn";

export function __setLanguage(language: string): void {
	mockLanguage = language;
}

export function __getLanguage(): string {
	return mockLanguage;
}

export function getLanguage(): string {
	return mockLanguage;
}

/**
 * Runtime feature probe (Obsidian 1.13+). The stub reports the version the
 * test asks for; `__setApiVersion()` flips it so tests can exercise both
 * the declarative and the imperative rendering path.
 */
let mockApiVersion = "1.13.0";

export function __setApiVersion(version: string): void {
	mockApiVersion = version;
}

export function requireApiVersion(version: string): boolean {
	const parse = (v: string): number[] =>
		v.split(".").map((n) => parseInt(n, 10) || 0);
	const [a, b, c] = parse(mockApiVersion);
	const [x, y, z] = parse(version);
	if (a !== x) return a > x;
	if (b !== y) return b > y;
	return c >= z;
}

// ---------------------------------------------------------------- 类型桩

export class App {
	vault!: unknown;
	fileManager!: unknown;
	workspace!: unknown;
	metadataCache!: unknown;
}

export class Plugin {
	app!: App;
	manifest!: unknown;

	constructor(app?: App) {
		if (app) this.app = app;
	}

	addRibbonIcon(): HTMLElement {
		return undefined as unknown as HTMLElement;
	}

	addStatusBarItem(): HTMLElement {
		return undefined as unknown as HTMLElement;
	}

	addCommand(): void {
		/* noop */
	}

	addSettingTab(): void {
		/* noop */
	}

	registerEvent(): void {
		/* noop */
	}

	async loadData(): Promise<unknown> {
		return null;
	}

	async saveData(): Promise<void> {
		/* noop */
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement = undefined as unknown as HTMLElement;

	constructor(public app: App, public plugin: Plugin) {}

	display(): void {
		/* noop */
	}

	/**
	 * Declarative settings API (Obsidian 1.13+). The real implementation
	 * re-renders from the definitions; the stub records the call so tests can
	 * assert that the refresh path picks the right one.
	 */
	update(): void {
		/* noop */
	}
}

/**
 * Minimal DOM stand-in for the settings pane.
 *
 * The imperative renderer calls `containerEl.empty()` and then Obsidian's
 * `createDiv` / `createEl` / `createSpan` helpers. The stub only needs to
 * satisfy those calls so the render path can be exercised without a browser.
 */
export function createContainerEl(): HTMLElement {
	const make = (tag: string): HTMLElement => {
		const el = {
			tagName: tag,
			children: [] as HTMLElement[],
			classes: new Set<string>(),
			textContent: "",
			style: {},
			appendChild(child: HTMLElement) {
				el.children.push(child);
				return child;
			},
			addClass(...cls: string[]) {
				for (const c of cls) el.classes.add(c);
			},
			removeClass(...cls: string[]) {
				for (const c of cls) el.classes.delete(c);
			},
			toggleClass(cls: string, on: boolean) {
				if (on) el.classes.add(cls);
				else el.classes.delete(cls);
			},
			hasClass(cls: string) {
				return el.classes.has(cls);
			},
			setText(text: string) {
				el.textContent = text;
			},
			empty() {
				el.children.length = 0;
			},
			setCssProps(_props: Record<string, string>) {
				/* noop */
			},
			setAttribute(_name: string, _value: string) {
				/* noop */
			},
			removeAttribute(_name: string) {
				/* noop */
			},
			createDiv(options?: { cls?: string; text?: string }): HTMLElement {
				const child = make("div");
				if (options?.cls) child.addClass(options.cls);
				if (options?.text) child.setText(options.text);
				el.appendChild(child);
				return child;
			},
			createSpan(options?: { cls?: string; text?: string }): HTMLElement {
				const child = make("span");
				if (options?.cls) child.addClass(options.cls);
				if (options?.text) child.setText(options.text);
				el.appendChild(child);
				return child;
			},
			createEl(tag: string, options?: { cls?: string; text?: string }): HTMLElement {
				const child = make(tag);
				if (options?.cls) child.addClass(options.cls);
				if (options?.text) child.setText(options.text);
				el.appendChild(child);
				return child;
			},
		};
		return el as unknown as HTMLElement;
	};
	return make("div");
}

export class Setting {
	/** The control column — where custom render blocks put their content. */
	controlEl: HTMLElement = createContainerEl();

	constructor(_el: unknown) {}

	setName(): this {
		return this;
	}

	setDesc(): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	setTooltip(): this {
		return this;
	}

	/** Used by the custom sections to span the full row width. */
	setClass(_cls: string): this {
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

	addExtraButton(): this {
		return this;
	}
}

export class Notice {
	constructor(
		public message: string | DocumentFragment,
		public timeout?: number
	) {}

	setMessage(message: string | DocumentFragment): this {
		this.message = message;
		return this;
	}

	hide(): void {
		/* noop */
	}
}

export class MenuItem {
	setTitle(_title: string): this {
		return this;
	}

	setIcon(_icon: string): this {
		return this;
	}

	setSection(_section: string): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onClick(_callback: (evt: MouseEvent | KeyboardEvent) => unknown): this {
		return this;
	}
}

export class Menu {
	addItem(_callback?: (item: MenuItem) => void): this {
		return this;
	}

	addSeparator(): this {
		return this;
	}

	showAtMouseEvent(_evt: MouseEvent): this {
		return this;
	}

	showAtPosition(_position: { x: number; y: number }): this {
		return this;
	}

	hide(): void {
		/* noop */
	}
}

/** 与真实 Obsidian 一致：给元素挂一个 Lucide 图标。桩里什么都不做。 */
export function setIcon(_el: HTMLElement, _iconId: string): void {
	/* noop */
}

export class MarkdownView {
	file: TFile | null = null;
}

export const Platform = { isDesktopApp: true, isMobileApp: false };
