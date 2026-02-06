// 插件设置接口
export interface DualPanePluginSettings {
	overlapLines: number;  // 两侧重合行数
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	overlapLines: 2  // 默认 2 行重合
};
