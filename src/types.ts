// 插件设置接口
export interface DualPanePluginSettings {
	overlapLines: number;  // 两侧重合行数
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	overlapLines: 2  // 默认 2 行重合
};

// 重新导出 i18n
export { t, setLanguage, detectObsidianLanguage, getCurrentLanguage, translations } from './i18n';
export type { Language, Translations } from './i18n';
