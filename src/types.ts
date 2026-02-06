// 编辑器模式类型：阅读和编辑是主状态
export type EditorMode = 'edit' | 'preview';

// 翻页模式
export type PageScrollMode = 'single' | 'both';

// 插件设置接口
export interface DualPanePluginSettings {
	scrollSyncEnabled: boolean;
	pageScrollStep: number;
	pageScrollMode: PageScrollMode;
	overlapLines: number;  // 两侧重合行数（解决工具栏遮挡问题）
	showToolbar: boolean;
	syncKeyboard: boolean;
	autoRefresh: boolean;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	scrollSyncEnabled: true,
	pageScrollStep: 0.95,
	pageScrollMode: 'single',
	overlapLines: 2,  // 默认 2 行重合，解决工具栏遮挡问题
	showToolbar: true,
	syncKeyboard: true,
	autoRefresh: true
};

// 视图状态接口
export interface DualPaneViewState extends Record<string, unknown> {
	file?: string;
	mode?: EditorMode;
	isSourceMode?: boolean;
}

// 内容分割信息
export interface ContentSplitInfo {
	leftStart: number;
	leftEnd: number;
	rightStart: number;
	rightEnd: number;
	totalHeight: number;
}
