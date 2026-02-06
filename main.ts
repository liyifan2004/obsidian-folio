import { 
	Plugin, 
	WorkspaceLeaf, 
	TFile, 
	Notice,
	MarkdownView,
	Menu
} from 'obsidian';
import { DualPaneSyncView, VIEW_TYPE_DUAL_PANE } from './src/dualPaneView';
import { DualPanePluginSettings, DEFAULT_SETTINGS, DualPaneViewState } from './src/types';
import { DualPaneSettingTab } from './src/settings';
import { DualPaneFollowMode } from './src/followMode';

export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;
	followMode: DualPaneFollowMode;

	async onload() {
		await this.loadSettings();

		// 初始化跟随模式
		this.followMode = new DualPaneFollowMode(this.app.workspace);

		// 注册独立双栏视图（仅阅读模式）
		this.registerView(
			VIEW_TYPE_DUAL_PANE,
			(leaf) => new DualPaneSyncView(leaf, this.settings)
		);

		// 添加功能区图标（带弹出菜单）
		this.addRibbonIcon('columns', '双栏同步视图', (evt: MouseEvent) => {
			this.showModeMenu(evt);
		});

		// 添加命令：打开独立双栏视图
		this.addCommand({
			id: 'open-dual-pane-view',
			name: '打开独立双栏视图（仅阅读）',
			callback: () => {
				this.activateView();
			}
		});

		// 添加命令：启动跟随模式
		this.addCommand({
			id: 'start-follow-mode',
			name: '启动跟随模式（可编辑）',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						this.followMode.startFollowMode();
					}
					return true;
				}
				return false;
			}
		});

		// 添加命令：停止跟随模式
		this.addCommand({
			id: 'stop-follow-mode',
			name: '停止跟随模式',
			checkCallback: (checking: boolean) => {
				if (this.followMode.isFollowing()) {
					if (!checking) {
						this.followMode.stopFollowMode();
					}
					return true;
				}
				return false;
			}
		});

		// 添加命令：跟随模式翻页（供快捷键使用）
		this.addCommand({
			id: 'follow-mode-page-up',
			name: '跟随模式: 上一页',
			callback: () => {
				if (this.followMode.isFollowing()) {
					this.followMode.pageScroll('up');
				}
			}
		});

		this.addCommand({
			id: 'follow-mode-page-down',
			name: '跟随模式: 下一页',
			callback: () => {
				if (this.followMode.isFollowing()) {
					this.followMode.pageScroll('down');
				}
			}
		});

		this.addCommand({
			id: 'follow-mode-double-page-up',
			name: '跟随模式: 连翻两页（上）',
			callback: () => {
				if (this.followMode.isFollowing()) {
					this.followMode.pageScroll('up');
					setTimeout(() => this.followMode.pageScroll('up'), 50);
				}
			}
		});

		this.addCommand({
			id: 'follow-mode-double-page-down',
			name: '跟随模式: 连翻两页（下）',
			callback: () => {
				if (this.followMode.isFollowing()) {
					this.followMode.pageScroll('down');
					setTimeout(() => this.followMode.pageScroll('down'), 50);
				}
			}
		});

		// 注册全局快捷键监听
		this.registerGlobalHotkeys();

		// 注册文件事件监听
		this.registerFileEvents();

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
	 * 注册全局快捷键监听
	 */
	registerGlobalHotkeys(): void {
		this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
			// 如果不在跟随模式，不处理
			if (!this.followMode.isFollowing()) return;

			// 构建快捷键字符串
			const parts: string[] = [];
			if (e.ctrlKey) parts.push('Ctrl');
			if (e.metaKey) parts.push('Cmd');
			if (e.altKey) parts.push('Alt');
			if (e.shiftKey) parts.push('Shift');
			parts.push(e.key);

			const hotkey = parts.join('+');
			const hotkeys = this.settings.followModeHotkeys;

			// 匹配快捷键并执行相应操作
			if (hotkey === hotkeys.pageUp) {
				e.preventDefault();
				this.followMode.pageScroll('up');
			} else if (hotkey === hotkeys.pageDown) {
				e.preventDefault();
				this.followMode.pageScroll('down');
			} else if (hotkey === hotkeys.doublePageUp) {
				e.preventDefault();
				this.followMode.pageScroll('up');
				setTimeout(() => this.followMode.pageScroll('up'), 50);
			} else if (hotkey === hotkeys.doublePageDown) {
				e.preventDefault();
				this.followMode.pageScroll('down');
				setTimeout(() => this.followMode.pageScroll('down'), 50);
			}
		});
	}

	/**
	 * 显示模式选择菜单
	 */
	showModeMenu(evt: MouseEvent): void {
		const menu = new Menu();
		const activeFile = this.app.workspace.getActiveFile();

		menu.addItem((item) => {
			item.setTitle('打开独立双栏视图（仅阅读）')
				.setIcon('book-open')
				.onClick(() => {
					this.activateView();
				});
		});

		if (activeFile) {
			menu.addItem((item) => {
				item.setTitle('启动跟随模式（可编辑）')
					.setIcon('git-pull-request')
					.onClick(() => {
						this.followMode.startFollowMode();
					});
			});
		}

		menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
	}

	/**
	 * 注册文件事件监听
	 */
	registerFileEvents() {
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.handleFileRename(file, oldPath);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.handleFileDelete(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile) {
					this.handleFileModify(file);
				}
			})
		);
	}

	handleFileRename(file: TFile, oldPath: string) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			if (view.currentFile && view.currentFile.path === file.path) {
				view.setFile(file);
				new Notice(`双栏视图：文件已重命名`);
			}
		}
	}

	handleFileDelete(file: TFile) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			if (view.currentFile && view.currentFile.path === file.path) {
				view.clearContent();
				new Notice('双栏视图：当前文件已被删除');
			}
		}
	}

	handleFileModify(file: TFile) {
		if (!this.settings.autoRefresh) return;
		
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			if (view.currentFile && view.currentFile.path === file.path) {
				view.refresh();
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			view.updateSettings(this.settings);
		}
	}

	async activateView(file?: TFile) {
		const { workspace } = this.app;
		
		let targetFile: TFile | null | undefined = file;
		if (!targetFile) {
			targetFile = this.app.workspace.getActiveFile();
		}
		
		if (!targetFile) {
			new Notice('请先打开一个文件');
			return;
		}

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			if (view.currentFile && view.currentFile.path === targetFile.path) {
				workspace.revealLeaf(leaf);
				return;
			}
		}

		const leaf = workspace.getLeaf('tab');
		
		if (!leaf) {
			new Notice('无法创建视图');
			return;
		}

		await leaf.setViewState({ 
			type: VIEW_TYPE_DUAL_PANE, 
			active: true,
			state: { file: targetFile.path }
		});

		workspace.revealLeaf(leaf);
	}
}
