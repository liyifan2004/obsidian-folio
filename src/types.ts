// 翻页模式
export type PageScrollMode = 'single' | 'both';

// 快捷键设置
export interface HotkeySettings {
	pageUp: string;      // 上一页快捷键
	pageDown: string;    // 下一页快捷键
	doublePageUp: string;    // 连翻两页-上
	doublePageDown: string;  // 连翻两页-下
}

// 插件设置接口
export interface DualPanePluginSettings {
	// 通用设置
	scrollSyncEnabled: boolean;
	overlapLines: number;
	
	// 独立双栏视图设置
	pageScrollStep: number;
	pageScrollMode: PageScrollMode;
	showToolbar: boolean;
	autoRefresh: boolean;
	
	// 跟随模式设置
	followModeHotkeys: HotkeySettings;
}

// 默认快捷键
export const DEFAULT_HOTKEYS: HotkeySettings = {
	pageUp: '',      // 默认不绑定
	pageDown: '',    // 默认不绑定
	doublePageUp: '',
	doublePageDown: ''
};

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	// 通用设置
	scrollSyncEnabled: true,
	overlapLines: 2,
	
	// 独立双栏视图设置
	pageScrollStep: 0.95,
	pageScrollMode: 'single',
	showToolbar: true,
	autoRefresh: true,
	
	// 跟随模式设置
	followModeHotkeys: { ...DEFAULT_HOTKEYS }
};

// 视图状态接口
export interface DualPaneViewState extends Record<string, unknown> {
	file?: string;
}
