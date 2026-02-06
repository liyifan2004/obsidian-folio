// 编辑器模式类型
export type EditorMode = 'edit' | 'preview' | 'source';

// 插件设置接口
export interface DualPanePluginSettings {
	scrollSyncEnabled: boolean;
	pageScrollStep: number;
	showToolbar: boolean;
	syncKeyboard: boolean;
	autoRefresh: boolean;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	scrollSyncEnabled: true,
	pageScrollStep: 0.95,  // 调整默认值，更接近满屏
	showToolbar: true,
	syncKeyboard: true,
	autoRefresh: true
};

// 视图状态接口
export interface DualPaneViewState extends Record<string, unknown> {
	file?: string;
	mode?: EditorMode;
}

// 内容分割信息
export interface ContentSplitInfo {
	leftStart: number;      // 左栏起始偏移（像素）
	leftEnd: number;        // 左栏结束偏移（像素）
	rightStart: number;     // 右栏起始偏移（像素）
	rightEnd: number;       // 右栏结束偏移（像素）
	totalHeight: number;    // 内容总高度
}
