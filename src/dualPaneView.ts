import { 
	ItemView, 
	WorkspaceLeaf, 
	TFile, 
	MarkdownRenderer,
	Component,
	App
} from 'obsidian';
import { DualPanePluginSettings, DEFAULT_SETTINGS } from './types';

export const VIEW_TYPE_DUAL_PANE = 'obsidian_view_sync';

export class DualPaneSyncView extends ItemView {
	containerEl: HTMLElement;
	
	// 左右面板元素
	leftPane: HTMLElement;
	rightPane: HTMLElement;
	leftContent: HTMLElement;
	rightContent: HTMLElement;
	
	// 当前文件
	currentFile: TFile | null = null;
	
	// 滚动同步锁（防止循环触发）
	private isScrolling: boolean = false;
	private scrollTimeout: number | null = null;
	
	// 渲染的组件（用于清理）
	private renderComponent: Component;
	
	// 设置（避免直接依赖插件实例）
	settings: DualPanePluginSettings;

	constructor(leaf: WorkspaceLeaf, settings?: DualPanePluginSettings) {
		super(leaf);
		this.settings = settings || DEFAULT_SETTINGS;
		this.renderComponent = new Component();
		this.renderComponent.load();
	}

	getViewType(): string {
		return VIEW_TYPE_DUAL_PANE;
	}

	getDisplayText(): string {
		return this.currentFile ? `双栏: ${this.currentFile.basename}` : '双栏同步视图';
	}

	getIcon(): string {
		return 'columns';
	}

	async onOpen() {
		this.containerEl = this.contentEl.createDiv('dual-pane-container');
		
		// 创建头部工具栏
		this.createToolbar();
		
		// 创建双栏面板
		this.createPanes();
		
		// 初始化样式
		this.containerEl.addClass('dual-pane-sync-view');
	}

	async onClose() {
		// 清理渲染组件
		this.renderComponent.unload();
		if (this.scrollTimeout) {
			window.clearTimeout(this.scrollTimeout);
		}
	}

	createToolbar() {
		const toolbar = this.containerEl.createDiv('dual-pane-toolbar');
		
		// 文件信息
		const fileInfo = toolbar.createDiv('dual-pane-file-info');
		fileInfo.setText('未选择文件');
		fileInfo.id = 'dual-pane-file-info';
		
		// 按钮组
		const buttonGroup = toolbar.createDiv('dual-pane-buttons');
		
		// 上一页按钮
		const prevBtn = buttonGroup.createEl('button', {
			cls: 'dual-pane-btn',
			text: '上一页'
		});
		prevBtn.addEventListener('click', () => this.pageScroll('up'));
		
		// 下一页按钮
		const nextBtn = buttonGroup.createEl('button', {
			cls: 'dual-pane-btn',
			text: '下一页'
		});
		nextBtn.addEventListener('click', () => this.pageScroll('down'));
		
		// 同步开关
		const syncLabel = buttonGroup.createEl('label', {
			cls: 'dual-pane-sync-toggle',
			text: '同步滚动'
		});
		const syncCheckbox = syncLabel.createEl('input', {
			type: 'checkbox'
		});
		syncCheckbox.checked = this.settings.scrollSyncEnabled;
		syncCheckbox.addEventListener('change', (e) => {
			this.settings.scrollSyncEnabled = (e.target as HTMLInputElement).checked;
		});
	}

	createPanes() {
		const panesWrapper = this.containerEl.createDiv('dual-panes-wrapper');
		
		// 左侧面板
		this.leftPane = panesWrapper.createDiv('dual-pane left-pane');
		this.leftContent = this.leftPane.createDiv('pane-content markdown-rendered');
		
		// 分隔线
		const divider = panesWrapper.createDiv('pane-divider');
		
		// 右侧面板
		this.rightPane = panesWrapper.createDiv('dual-pane right-pane');
		this.rightContent = this.rightPane.createDiv('pane-content markdown-rendered');
		
		// 设置滚动同步
		this.setupScrollSync();
		
		// 设置键盘导航
		this.setupKeyboardNav();
	}

	setupScrollSync() {
		// 左侧面板滚动事件
		this.leftPane.addEventListener('scroll', () => {
			if (!this.settings.scrollSyncEnabled || this.isScrolling) return;
			this.isScrolling = true;
			
			// 右侧面板跟随滚动
			this.syncScroll(this.leftPane, this.rightPane);
			
			this.resetScrollLock();
		});
		
		// 右侧面板滚动事件
		this.rightPane.addEventListener('scroll', () => {
			if (!this.settings.scrollSyncEnabled || this.isScrolling) return;
			this.isScrolling = true;
			
			// 左侧面板跟随滚动
			this.syncScroll(this.rightPane, this.leftPane);
			
			this.resetScrollLock();
		});
	}

	syncScroll(source: HTMLElement, target: HTMLElement) {
		// 获取源面板的滚动比例
		const scrollRatio = source.scrollTop / (source.scrollHeight - source.clientHeight);
		
		// 应用到目标面板
		if (target.scrollHeight > target.clientHeight) {
			target.scrollTop = scrollRatio * (target.scrollHeight - target.clientHeight);
		}
	}

	resetScrollLock() {
		if (this.scrollTimeout) {
			window.clearTimeout(this.scrollTimeout);
		}
		this.scrollTimeout = window.setTimeout(() => {
			this.isScrolling = false;
		}, 50);
	}

	setupKeyboardNav() {
		// 让面板可以接收键盘事件
		this.leftPane.setAttribute('tabindex', '0');
		this.rightPane.setAttribute('tabindex', '0');
		
		// 键盘事件
		this.containerEl.addEventListener('keydown', (e) => {
			if (e.key === 'PageDown' || e.key === ' ') {
				e.preventDefault();
				this.pageScroll('down');
			} else if (e.key === 'PageUp') {
				e.preventDefault();
				this.pageScroll('up');
			}
		});
	}

	async setFile(file: TFile) {
		this.currentFile = file;
		
		// 更新文件信息
		const fileInfo = this.containerEl.querySelector('#dual-pane-file-info');
		if (fileInfo) {
			fileInfo.setText(file.path);
		}
		
		// 更新视图标题
		this.updateViewTitle();
		
		// 渲染内容
		await this.renderContent();
	}

	async renderContent() {
		if (!this.currentFile) return;
		
		const content = await this.app.vault.read(this.currentFile);
		
		// 清空现有内容
		this.leftContent.empty();
		this.rightContent.empty();
		
		// 渲染左侧内容（完整文档）
		await MarkdownRenderer.render(
			this.app,
			content,
			this.leftContent,
			this.currentFile.path,
			this.renderComponent
		);
		
		// 渲染右侧内容（同样是完整文档）
		await MarkdownRenderer.render(
			this.app,
			content,
			this.rightContent,
			this.currentFile.path,
			this.renderComponent
		);
		
		// 应用双栏布局样式
		this.applyDualPaneLayout();
	}

	applyDualPaneLayout() {
		// 等待渲染完成后再调整
		setTimeout(() => {
			this.adjustPanePositions();
		}, 100);
	}

	adjustPanePositions() {
		if (!this.leftContent || !this.rightContent) return;
		
		// 获取左侧面板的高度
		const leftHeight = this.leftPane.clientHeight;
		const contentHeight = this.leftContent.scrollHeight;
		
		// 如果内容足够长，设置右侧面板的初始滚动位置
		// 使其显示接续的内容
		if (contentHeight > leftHeight) {
			this.rightPane.scrollTop = leftHeight * 0.5;
		}
	}

	pageScroll(direction: 'up' | 'down') {
		const paneHeight = this.leftPane.clientHeight;
		const scrollStep = Math.floor(paneHeight * this.settings.pageScrollStep);
		
		if (direction === 'down') {
			this.leftPane.scrollTop += scrollStep;
			if (this.settings.scrollSyncEnabled) {
				this.rightPane.scrollTop += scrollStep;
			}
		} else {
			this.leftPane.scrollTop -= scrollStep;
			if (this.settings.scrollSyncEnabled) {
				this.rightPane.scrollTop -= scrollStep;
			}
		}
	}

	// 刷新当前文件
	async refresh() {
		if (this.currentFile) {
			await this.renderContent();
		}
	}

	// 更新视图标题
	updateViewTitle() {
		// 触发视图标题更新
		const leaf = this.leaf;
		if (leaf && leaf.view === this) {
			// 强制更新标签标题
			(this.app.workspace as any).requestSaveLayout?.();
		}
	}

	// 更新设置
	updateSettings(settings: DualPanePluginSettings) {
		this.settings = settings;
	}
}
