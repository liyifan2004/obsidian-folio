import { 
	Plugin, 
	TFile, 
	Notice,
	MarkdownView,
	Menu
} from 'obsidian';
import { DualPaneFollowMode } from './src/followMode';
import { DualPanePluginSettings, DEFAULT_SETTINGS } from './src/types';
import { DualPaneSettingTab } from './src/settings';

/**
 * Dual Pane Sync Plugin - 双栏同步阅读插件
 * 
 * 仅提供跟随模式：
 * - 左侧：Obsidian 原生编辑器/预览（可编辑）
 * - 右侧：接续预览，自动跟随滚动
 * - 支持双向滚动
 */
export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;
	followMode: DualPaneFollowMode;

	async onload() {
		await this.loadSettings();

		// 初始化跟随模式
		this.followMode = new DualPaneFollowMode(this.app.workspace, this.settings);

		// 添加功能区图标
		this.addRibbonIcon('columns', '双栏同步阅读', (evt: MouseEvent) => {
			this.showModeMenu(evt);
		});

		// 添加命令：启动跟随模式
		this.addCommand({
			id: 'start-follow-mode',
			name: '启动跟随模式',
			callback: () => {
				this.followMode.startFollowMode();
			}
		});

		// 添加命令：停止跟随模式
		this.addCommand({
			id: 'stop-follow-mode',
			name: '停止跟随模式',
			callback: () => {
				this.followMode.stopFollowMode();
			}
		});

		// 添加命令：切换跟随模式
		this.addCommand({
			id: 'toggle-follow-mode',
			name: '切换跟随模式',
			callback: () => {
				this.followMode.toggleFollowMode();
			}
		});

		// 添加命令：上一页
		this.addCommand({
			id: 'follow-mode-page-up',
			name: '跟随模式: 上一页',
			callback: () => {
				this.followMode.pageScroll('up');
			}
		});

		// 添加命令：下一页
		this.addCommand({
			id: 'follow-mode-page-down',
			name: '跟随模式: 下一页',
			callback: () => {
				this.followMode.pageScroll('down');
			}
		});

		// 添加命令：连翻两页（上）
		this.addCommand({
			id: 'follow-mode-double-page-up',
			name: '跟随模式: 连翻两页（上）',
			callback: () => {
				this.followMode.pageScroll('up');
				setTimeout(() => this.followMode.pageScroll('up'), 30);
			}
		});

		// 添加命令：连翻两页（下）
		this.addCommand({
			id: 'follow-mode-double-page-down',
			name: '跟随模式: 连翻两页（下）',
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

	/**
	 * 显示模式选择菜单
	 */
	showModeMenu(evt: MouseEvent): void {
		const menu = new Menu();

		if (this.followMode.isFollowing()) {
			menu.addItem((item) => {
				item.setTitle('停止跟随模式')
					.setIcon('x')
					.onClick(() => {
						this.followMode.stopFollowMode();
					});
			});
		} else {
			menu.addItem((item) => {
				item.setTitle('启动跟随模式')
					.setIcon('columns')
					.onClick(() => {
						this.followMode.startFollowMode();
					});
			});
		}

		menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
