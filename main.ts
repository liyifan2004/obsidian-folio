import { 
	Plugin, 
	WorkspaceLeaf, 
	TFile, 
	Notice,
	MarkdownView
} from 'obsidian';
import { DualPaneSyncView, VIEW_TYPE_DUAL_PANE } from './src/dualPaneView';
import { DualPanePluginSettings, DEFAULT_SETTINGS } from './src/types';

export default class DualPaneSyncPlugin extends Plugin {
	settings: DualPanePluginSettings;

	async onload() {
		await this.loadSettings();

		// 注册自定义视图
		this.registerView(
			VIEW_TYPE_DUAL_PANE,
			(leaf) => new DualPaneSyncView(leaf, this.settings)
		);

		// 添加功能区图标
		this.addRibbonIcon('columns', '打开双栏同步视图', () => {
			this.activateView();
		});

		// 添加命令：打开双栏视图
		this.addCommand({
			id: 'open-dual-pane-view',
			name: '打开双栏同步视图',
			callback: () => {
				this.activateView();
			}
		});

		// 添加命令：翻页下一页
		this.addCommand({
			id: 'dual-pane-page-down',
			name: '双栏视图: 下一页',
			callback: () => {
				this.pageScroll('down');
			}
		});

		// 添加命令：翻页上一页
		this.addCommand({
			id: 'dual-pane-page-up',
			name: '双栏视图: 上一页',
			callback: () => {
				this.pageScroll('up');
			}
		});

		// 添加命令：从当前笔记打开双栏视图
		this.addCommand({
			id: 'open-current-in-dual-pane',
			name: '在当前笔记打开双栏视图',
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
	}

	onunload() {
		// 清理工作
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// 更新所有打开的视图
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		for (const leaf of leaves) {
			const view = leaf.view as DualPaneSyncView;
			view.updateSettings(this.settings);
		}
	}

	async activateView(file?: TFile) {
		const { workspace } = this.app;
		
		// 检查是否已存在双栏视图
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		
		if (leaves.length > 0) {
			// 复用已存在的视图
			leaf = leaves[0];
		} else {
			// 创建新的叶子面板 - 使用更兼容的方法
			// 尝试获取右侧叶子，如果不支持则分割当前叶子
			const rightLeaf = (workspace as any).getRightLeaf?.(false);
			
			if (rightLeaf) {
				leaf = rightLeaf;
			} else {
				// 获取当前活动的 markdown 视图作为参考
				let sourceLeaf: WorkspaceLeaf | null = null;
				
				// 尝试获取活动的 markdown 视图
				const activeView = workspace.getActiveViewOfType(MarkdownView);
				
				if (activeView && activeView.leaf) {
					sourceLeaf = activeView.leaf;
				} else {
					// 尝试获取任何活动的叶子
					sourceLeaf = workspace.activeLeaf || null;
				}
				
				// 如果没有可用的叶子，创建一个
				if (sourceLeaf) {
					leaf = workspace.createLeafBySplit(sourceLeaf);
				} else {
					// 最后的回退：创建一个新的叶子
					leaf = workspace.getLeaf('split');
				}
			}
			
			if (!leaf) {
				new Notice('无法创建视图');
				return;
			}
			
			await leaf.setViewState({ type: VIEW_TYPE_DUAL_PANE, active: true });
		}

		// 激活该叶子
		workspace.revealLeaf(leaf);

		// 如果有指定文件，在双栏视图中打开
		if (file) {
			const view = leaf.view as DualPaneSyncView;
			view.setFile(file);
		} else {
			// 如果没有指定文件，尝试使用当前活动文件
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				const view = leaf.view as DualPaneSyncView;
				view.setFile(activeFile);
			}
		}
	}

	pageScroll(direction: 'up' | 'down') {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DUAL_PANE);
		if (leaves.length === 0) {
			new Notice('请先打开双栏同步视图');
			return;
		}

		const view = leaves[0].view as DualPaneSyncView;
		view.pageScroll(direction);
	}
}
