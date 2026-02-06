import { 
	Plugin, 
	TFile, 
	Notice,
	MarkdownView
} from 'obsidian';
import { DualPaneFollowMode } from './src/followMode';
import { DualPanePluginSettings, DEFAULT_SETTINGS } from './src/types';
import { t, setLanguage, detectObsidianLanguage } from './src/i18n';
import { DualPaneSettingTab } from './src/settings';

/**
 * Dual Pane Sync Plugin - 双栏同步阅读插件
 * 
 * 简单专注的双栏阅读体验：
 * - 点击图标开启/关闭跟随模式
 * - 支持快捷键翻页
 * - 可调整重合行数
 */
export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;
	followMode: DualPaneFollowMode;

	async onload() {
		await this.loadSettings();

		// 自动检测 Obsidian 语言设置
		const detectedLang = detectObsidianLanguage();
		setLanguage(detectedLang);
		console.log('双栏同步阅读插件：检测到语言', detectedLang);

		// 初始化跟随模式
		this.followMode = new DualPaneFollowMode(this.app.workspace, this.settings);

		// 添加功能区图标 - 点击直接开启/关闭
		this.addRibbonIcon('columns', t('ribbonTooltip'), () => {
			this.followMode.toggleFollowMode();
		});

		// 添加命令：切换跟随模式
		this.addCommand({
			id: 'toggle-follow-mode',
			name: t('cmdToggle'),
			callback: () => {
				this.followMode.toggleFollowMode();
			}
		});

		// 添加命令：上一页
		this.addCommand({
			id: 'follow-mode-page-up',
			name: t('cmdPageUp'),
			callback: () => {
				this.followMode.pageScroll('up');
			}
		});

		// 添加命令：下一页
		this.addCommand({
			id: 'follow-mode-page-down',
			name: t('cmdPageDown'),
			callback: () => {
				this.followMode.pageScroll('down');
			}
		});

		// 添加命令：连翻两页（上）
		this.addCommand({
			id: 'follow-mode-double-page-up',
			name: t('cmdDoublePageUp'),
			callback: () => {
				this.followMode.pageScroll('up');
				setTimeout(() => this.followMode.pageScroll('up'), 30);
			}
		});

		// 添加命令：连翻两页（下）
		this.addCommand({
			id: 'follow-mode-double-page-down',
			name: t('cmdDoublePageDown'),
			callback: () => {
				this.followMode.pageScroll('down');
				setTimeout(() => this.followMode.pageScroll('down'), 30);
			}
		});

		// 添加设置面板
		this.addSettingTab(new DualPaneSettingTab(this.app, this));

		// 注册清理函数
		this.register(() => {
			if (this.followMode) {
				this.followMode.stopFollowMode();
			}
		});
	}

	onunload() {
		if (this.followMode) {
			this.followMode.stopFollowMode();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
