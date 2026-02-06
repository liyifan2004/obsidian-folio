// 插件设置接口
export interface DualPanePluginSettings {
	scrollSyncEnabled: boolean;
	pageScrollStep: number;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	scrollSyncEnabled: true,
	pageScrollStep: 0.9
};
