// 翻页模式
export type PageScrollMode = 'single' | 'both';

// 插件设置接口
export interface DualPanePluginSettings {
	scrollSyncEnabled: boolean;
	pageScrollStep: number;
	pageScrollMode: PageScrollMode;
	overlapLines: number;
	showToolbar: boolean;
	syncKeyboard: boolean;
	autoRefresh: boolean;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	scrollSyncEnabled: true,
	pageScrollStep: 0.95,
	pageScrollMode: 'single',
	overlapLines: 2,
	showToolbar: true,
	syncKeyboard: true,
	autoRefresh: true
};

// 视图状态接口
export interface DualPaneViewState extends Record<string, unknown> {
	file?: string;
}
