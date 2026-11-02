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
}

export class Setting {
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
