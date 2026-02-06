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

		// 添加命令：打开独立双栏视图（仅阅读）
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
			name: '启动跟随模式（原生编辑+接续预览）',
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
		// 监听文件重命名事件
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.handleFileRename(file, oldPath);
				}
			})
		);

		// 监听文件删除事件
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.handleFileDelete(file);
				}
			})
		);

		// 监听文件修改事件
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

	/**
	 * 激活独立双栏视图 - 仅阅读模式
	 */
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

		// 检查是否已存在该文件的双栏视图
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

		// 设置视图状态 - 仅阅读模式
		await leaf.setViewState({ 
			type: VIEW_TYPE_DUAL_PANE, 
			active: true,
			state: {
				file: targetFile.path
			}
		});

		workspace.revealLeaf(leaf);
	}
}
