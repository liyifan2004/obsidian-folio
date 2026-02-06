import { 
	Plugin, 
	WorkspaceLeaf, 
	TFile, 
	Notice,
	MarkdownView,
	ViewState
} from 'obsidian';
import { DualPaneSyncView, VIEW_TYPE_DUAL_PANE } from './src/dualPaneView';
import { DualPanePluginSettings, DEFAULT_SETTINGS, EditorMode, DualPaneViewState } from './src/types';
import { DualPaneSettingTab } from './src/settings';
import { DualPaneFollowMode } from './src/followMode';

export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;
	followMode: DualPaneFollowMode;

	async onload() {
		await this.loadSettings();

		// 初始化跟随模式
		this.followMode = new DualPaneFollowMode(this.app.workspace);

		// 注册自定义视图（独立双栏模式）
		this.registerView(
			VIEW_TYPE_DUAL_PANE,
			(leaf) => new DualPaneSyncView(leaf, this.settings)
		);

		// 添加功能区图标
		this.addRibbonIcon('columns', '打开双栏同步视图', () => {
			this.activateView();
		});

		// 添加命令：打开独立双栏视图
		this.addCommand({
			id: 'open-dual-pane-view',
			name: '双栏视图: 打开独立双栏视图',
			callback: () => {
				this.activateView();
			}
		});

		// 添加命令：从当前笔记打开独立双栏视图
		this.addCommand({
			id: 'open-current-in-dual-pane',
			name: '双栏视图: 在当前笔记打开独立双栏视图',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						this.activateView(activeFile);
					}
					return true;
				}
				return false;
			}
		});

		// 添加命令：启动跟随模式
		this.addCommand({
			id: 'start-follow-mode',
			name: '双栏视图: 启动跟随模式（原生编辑+接续预览）',
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
			name: '双栏视图: 停止跟随模式',
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

		// 添加命令：切换跟随模式
		this.addCommand({
			id: 'toggle-follow-mode',
			name: '双栏视图: 切换跟随模式',
			callback: () => {
				this.followMode.toggleFollowMode();
			}
		});

		// 添加命令：翻页下一页
		this.addCommand({
			id: 'dual-pane-page-down',
			name: '双栏视图: 下一页（仅独立模式）',
			callback: () => {
				this.pageScroll('down');
			}
		});

		// 添加命令：翻页上一页
		this.addCommand({
			id: 'dual-pane-page-up',
			name: '双栏视图: 上一页（仅独立模式）',
			callback: () => {
				this.pageScroll('up');
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
		// 清理跟随模式
		if (this.followMode) {
			this.followMode.stopFollowMode();
		}
	}

	/**
	 * 获取当前活动视图的编辑模式和源码模式状态
	 */
	getCurrentEditorState(): { mode: EditorMode; isSourceMode: boolean } {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return { mode: 'preview', isSourceMode: false };
		
		// 通过检查视图状态确定模式
		const state = activeView.getState();
		if (state.mode === 'source') {
			// source 模式下，source: true 表示源码模式，source: false 表示实时预览编辑
			return { mode: 'edit', isSourceMode: state.source === true };
		}
		// preview 或默认状态
		return { mode: state.mode === 'preview' ? 'preview' : 'edit', isSourceMode: false };
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

		// 监听文件修改事件（可选：实时刷新内容）
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile) {
					this.handleFileModify(file);
				}
			})
		);
	}

	/**
	 * 处理文件重命名
	 */
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

	/**
	 * 处理文件删除
	 */
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

	/**
	 * 处理文件修改
	 */
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
	 * 激活双栏视图 - 在主编辑区打开（独立模式）
	 */
	async activateView(file?: TFile) {
		const { workspace } = this.app;
		
		// 确定要打开的文件
		let targetFile: TFile | null | undefined = file;
		if (!targetFile) {
			targetFile = this.app.workspace.getActiveFile();
		}
		
		if (!targetFile) {
			new Notice('请先打开一个文件');
			return;
		}

		// 获取当前编辑模式
		const { mode: editorMode, isSourceMode } = this.getCurrentEditorState();

		// 检查是否已存在该文件的双栏视图
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = (leaf.view as unknown) as DualPaneSyncView;
			if (view.currentFile && view.currentFile.path === targetFile.path) {
				// 复用已存在的视图
				workspace.revealLeaf(leaf);
				return;
			}
		}

		// 在标签页中打开（使用 tab 类型，与正常文件打开方式一致）
		const leaf = workspace.getLeaf('tab');
		
		if (!leaf) {
			new Notice('无法创建视图');
			return;
		}

		// 设置视图状态
		await leaf.setViewState({ 
			type: VIEW_TYPE_DUAL_PANE, 
			active: true,
			state: {
				file: targetFile.path,
				mode: editorMode,
				isSourceMode: isSourceMode
			}
		});

		// 激活该叶子
		workspace.revealLeaf(leaf);
	}

	pageScroll(direction: 'up' | 'down') {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		if (leaves.length === 0) {
			new Notice('请先打开双栏同步视图');
			return;
		}

		const view = (leaves[0].view as unknown) as DualPaneSyncView;
		view.pageScroll(direction);
	}
}
