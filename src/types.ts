// 编辑器模式类型：阅读和编辑是主状态
export type EditorMode = 'edit' | 'preview';

// 翻页模式
export type PageScrollMode = 'single' | 'both';

// 插件设置接口
export interface DualPanePluginSettings {
	scrollSyncEnabled: boolean;
	pageScrollStep: number;
	pageScrollMode: PageScrollMode;
	showToolbar: boolean;
	syncKeyboard: boolean;
	autoRefresh: boolean;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	scrollSyncEnabled: true,
	pageScrollStep: 0.95,
	pageScrollMode: 'single',  // 默认单栏翻页
	showToolbar: true,
	syncKeyboard: true,
	autoRefresh: true
};

// 视图状态接口
export interface DualPaneViewState extends Record<string, unknown> {
	file?: string;
	mode?: EditorMode;
	isSourceMode?: boolean;  // 源码模式是编辑状态下的开关
}

// 内容分割信息
export interface ContentSplitInfo {
	leftStart: number;      // 左栏起始偏移（像素）
	leftEnd: number;        // 左栏结束偏移（像素）
	rightStart: number;     // 右栏起始偏移（像素）
	rightEnd: number;       // 右栏结束偏移（像素）
	totalHeight: number;    // 内容总高度
}
