import { 
	Plugin, 
	Menu, 
	Notice
} from 'obsidian';
import { DualPaneFollowMode, ViewMode } from './src/followMode';
import { DualPanePluginSettings, DEFAULT_SETTINGS, t, resolveLanguage, setLanguage } from './src/types';
import { DualPaneSettingTab } from './src/settings';

/**
 * MultiFolio - 多栏工作区插件
 *
 * Features:
 * - Dual Pane Mode: Main editor + Right follower (next screen)
 * - Triple Pane Mode: Left follower (prev) + Main editor + Right follower (next)
 * - Synchronized scrolling
 * - Page navigation commands
 * - Multi-language support (9 languages)
 */
export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;
	followMode: DualPaneFollowMode;

	async onload() {
		await this.loadSettings();
		
		// 按设置解析并应用语言（'auto' 跟随 Obsidian）
		setLanguage(resolveLanguage(this.settings.language));
		
		// 初始化跟随模式
		this.followMode = new DualPaneFollowMode(this.app.workspace, this.settings);

		// ========== 命令注册 ==========
		
		// 双栏模式命令
		this.addCommand({
			id: 'toggle-dual-pane',
			name: t('cmdToggle'),
			callback: () => this.toggleMode('dual')
		});

		// 三栏模式命令
		this.addCommand({
			id: 'toggle-triple-pane',
			name: t('cmdToggleTriple'),
			callback: () => this.toggleMode('triple')
		});

		// 停止同步命令
		this.addCommand({
			id: 'stop-follow-mode',
			name: t('cmdStop'),
			callback: () => {
				if (this.followMode.isFollowing()) {
					this.followMode.stopFollowMode();
				} else {
					new Notice(t('noticeStopped'));
				}
			}
		});

		// 翻页命令
		this.addCommand({
			id: 'page-up',
			name: t('cmdPageUp'),
			callback: () => this.followMode.pageScroll('up')
		});

		this.addCommand({
			id: 'page-down',
			name: t('cmdPageDown'),
			callback: () => this.followMode.pageScroll('down')
		});

		this.addCommand({
			id: 'double-page-up',
			name: t('cmdDoublePageUp'),
		callback: () => {
			this.followMode.pageScroll('up');
			window.setTimeout(() => this.followMode.pageScroll('up'), 50);
		}
		});

		this.addCommand({
			id: 'double-page-down',
			name: t('cmdDoublePageDown'),
		callback: () => {
			this.followMode.pageScroll('down');
			window.setTimeout(() => this.followMode.pageScroll('down'), 50);
		}
		});

		// ========== 工具栏图标 ==========
		this.addRibbonIcon('columns', t('ribbonTooltip'), (evt) => {
			this.showModeMenu(evt);
		});

		// ========== 设置标签页 ==========
		this.addSettingTab(new DualPaneSettingTab(this.app, this));
	}

	onunload() {
		// 静默清理资源（保留窗格标记以便重载后识别，O-002）
		if (this.followMode) {
			this.followMode.destroy();
		}
	}

	/**
	 * 显示模式选择菜单
	 */
	private showModeMenu(evt: MouseEvent): void {
		const isActive = this.followMode.isFollowing();
		const currentMode = this.followMode.getCurrentMode();

		const menu = new Menu();

		// 双栏模式选项
		menu.addItem((item) => {
			const label = t('menuDualMode');
			const status = isActive && currentMode === 'dual' 
				? ` (${t('modeActive')})` 
				: '';
			item
				.setTitle(label + status)
				.setIcon(isActive && currentMode === 'dual' ? 'check' : 'columns')
				.onClick(() => this.toggleMode('dual'));
		});

		// 三栏模式选项
		menu.addItem((item) => {
			const label = t('menuTripleMode');
			const status = isActive && currentMode === 'triple' 
				? ` (${t('modeActive')})` 
				: '';
			item
				.setTitle(label + status)
				.setIcon(isActive && currentMode === 'triple' ? 'check' : 'layout-grid')
				.onClick(() => this.toggleMode('triple'));
		});

		// 分隔线
		menu.addSeparator();

		// 停止选项
		menu.addItem((item) => {
			item
				.setTitle(t('menuStop'))
				.setIcon('square')
				.setDisabled(!isActive)
				.onClick(() => this.followMode.stopFollowMode());
		});

		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	/**
	 * 切换模式
	 */
	private async toggleMode(mode: ViewMode): Promise<void> {
		const isActive = this.followMode.isFollowing();
		const currentMode = this.followMode.getCurrentMode();

		if (isActive && currentMode === mode) {
			// 如果已经是当前模式，则停止
			this.followMode.stopFollowMode();
		} else {
			// 切换到指定模式
			await this.followMode.switchMode(mode);
		}
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<DualPanePluginSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
	}

	async saveSettings() {
		// 跟随引擎持有的 settings 与本对象为同一引用，doSync 每次实时读取，
		// 无需重建引擎实例（重建会造成监听器/定时器泄漏，O-001）
		await this.saveData(this.settings);
	}
}
