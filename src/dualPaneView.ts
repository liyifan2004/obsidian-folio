import { 
	ItemView, 
	WorkspaceLeaf, 
	TFile, 
	MarkdownRenderer,
	Component
} from 'obsidian';
import { DualPanePluginSettings, DEFAULT_SETTINGS, DualPaneViewState } from './types';

export const VIEW_TYPE_DUAL_PANE = 'obsidian_view_sync';

/**
 * 独立双栏视图 - 仅用于阅读
 * 编辑功能已移除，避免编辑体验问题
 */
export class DualPaneSyncView extends ItemView {
	containerEl: HTMLElement;
	
	// 左右面板元素
	leftPane: HTMLElement;
	rightPane: HTMLElement;
	leftContent: HTMLElement;
	rightContent: HTMLElement;
	
	// 当前文件
	currentFile: TFile | null = null;
	
	// 滚动同步锁
	private isScrolling: boolean = false;
	private scrollTimeout: number | null = null;
	
	// 渲染的组件
	private renderComponent: Component;
	
	// 设置
	settings: DualPanePluginSettings;
	
	// 当前左栏顶部位置
	private leftScrollTop: number = 0;

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

	getState(): DualPaneViewState {
		return {
			file: this.currentFile?.path,
			mode: 'preview'
		};
	}

	async setState(state: DualPaneViewState, result: any): Promise<void> {
		if (state.file) {
			const file = this.app.vault.getAbstractFileByPath(state.file);
			if (file instanceof TFile) {
				await this.setFile(file);
			}
		}
		await super.setState(state, result);
	}

	async onOpen() {
		this.containerEl = this.contentEl.createDiv('dual-pane-container');
		
		// 创建头部工具栏
		if (this.settings.showToolbar) {
			this.createToolbar();
		}
		
		// 创建双栏面板
		this.createPanes();
		
		// 初始化样式
		this.containerEl.addClass('dual-pane-sync-view');
	}

	async onClose() {
		this.renderComponent.unload();
		if (this.scrollTimeout) {
			window.clearTimeout(this.scrollTimeout);
		}
	}

	/**
	 * 创建工具栏 - 仅保留翻页按钮
	 */
	createToolbar() {
		const toolbar = this.containerEl.createDiv('dual-pane-toolbar');
		
		// 文件信息
		const fileInfo = toolbar.createDiv('dual-pane-file-info');
		fileInfo.setText('未选择文件');
		fileInfo.id = 'dual-pane-file-info';
		
		// 按钮组（翻页按钮）
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
	}

	setupScrollSync() {
		// 使用 requestAnimationFrame 优化滚动性能
		let leftRafId: number | null = null;
		let rightRafId: number | null = null;

		// 左侧面板滚动事件
		this.leftPane.addEventListener('scroll', () => {
			if (leftRafId) return;
			leftRafId = requestAnimationFrame(() => {
				leftRafId = null;
				if (this.isScrolling) return;
				this.isScrolling = true;
				
				this.leftScrollTop = this.leftPane.scrollTop;
				
				if (this.settings.scrollSyncEnabled) {
					this.syncRightPane();
				}
				
				this.resetScrollLock();
			});
		}, { passive: true });
		
		// 右侧面板滚动事件 - 反向同步到左栏
		this.rightPane.addEventListener('scroll', () => {
			if (rightRafId) return;
			rightRafId = requestAnimationFrame(() => {
				rightRafId = null;
				if (this.isScrolling) return;
				this.isScrolling = true;
				
				if (this.settings.scrollSyncEnabled) {
					const paneHeight = this.rightPane.clientHeight;
					const rightScrollTop = this.rightPane.scrollTop;
					this.leftScrollTop = Math.max(0, rightScrollTop - paneHeight);
					this.leftPane.scrollTop = this.leftScrollTop;
				}
				
				this.resetScrollLock();
			});
		}, { passive: true });
	}

	/**
	 * 同步右栏位置，考虑重合行数
	 */
	syncRightPane() {
		const paneHeight = this.leftPane.clientHeight;
		const lineHeight = this.getLineHeightFromContent();
		
		// 计算重合偏移
		const overlapOffset = this.settings.overlapLines * lineHeight;
		
		// 左栏底部减去重合行数
		const leftBottom = this.leftScrollTop + paneHeight - overlapOffset;
		let targetScrollTop = leftBottom;
		if (targetScrollTop < 0) targetScrollTop = 0;
		
		this.rightPane.scrollTop = targetScrollTop;
	}

	getLineHeightFromContent(): number {
		const firstParagraph = this.leftContent.querySelector('p, li, h1, h2, h3, h4, h5, h6');
		if (firstParagraph instanceof HTMLElement) {
			const computedStyle = window.getComputedStyle(firstParagraph);
			const lineHeight = parseFloat(computedStyle.lineHeight);
			if (!isNaN(lineHeight) && lineHeight > 0) {
				return lineHeight;
			}
		}
		return 24;
	}

	resetScrollLock() {
		if (this.scrollTimeout) {
			window.clearTimeout(this.scrollTimeout);
		}
		this.scrollTimeout = window.setTimeout(() => {
			this.isScrolling = false;
		}, 50);
	}

	async setFile(file: TFile) {
		this.currentFile = file;
		
		// 更新文件信息
		const fileInfo = this.containerEl.querySelector('#dual-pane-file-info');
		if (fileInfo) {
			fileInfo.setText(file.path);
		}
		
		this.updateViewTitle();
		
		// 渲染内容
		await this.renderContent();
	}

	/**
	 * 渲染内容 - 仅阅读模式
	 */
	async renderContent() {
		if (!this.currentFile) return;
		
		// 检查文件是否存在
		if (!this.app.vault.getAbstractFileByPath(this.currentFile.path)) {
			this.clearContent();
			return;
		}
		
		try {
			const content = await this.app.vault.read(this.currentFile);
			
			// 清空现有内容
			this.leftContent.empty();
			this.rightContent.empty();
			
			// 渲染左侧内容
			await MarkdownRenderer.render(
				this.app,
				content,
				this.leftContent,
				this.currentFile.path,
				this.renderComponent
			);
			
			// 渲染右侧内容
			await MarkdownRenderer.render(
				this.app,
				content,
				this.rightContent,
				this.currentFile.path,
				this.renderComponent
			);
			
			// 初始化位置
			setTimeout(() => {
				this.initializePanePositions();
			}, 100);
			
		} catch (error) {
			console.error('渲染内容失败:', error);
			this.leftContent.setText('加载内容失败，请重试。');
			this.rightContent.empty();
		}
	}

	/**
	 * 初始化面板位置
	 */
	initializePanePositions() {
		this.leftScrollTop = 0;
		this.leftPane.scrollTop = 0;
		this.syncRightPane();
	}

	/**
	 * 翻页
	 */
	pageScroll(direction: 'up' | 'down') {
		const paneHeight = this.leftPane.clientHeight;
		const contentHeight = this.leftContent.scrollHeight;
		
		if (direction === 'down') {
			if (this.settings.pageScrollMode === 'single') {
				const currentLeftBottom = this.leftScrollTop + paneHeight;
				if (currentLeftBottom >= contentHeight) return;
				this.leftScrollTop = currentLeftBottom;
			} else {
				const currentLeftBottom = this.leftScrollTop + paneHeight * 2;
				if (currentLeftBottom >= contentHeight) return;
				this.leftScrollTop = currentLeftBottom;
			}
		} else {
			if (this.settings.pageScrollMode === 'single') {
				this.leftScrollTop = Math.max(0, this.leftScrollTop - paneHeight);
			} else {
				this.leftScrollTop = Math.max(0, this.leftScrollTop - paneHeight * 2);
			}
		}
		
		this.leftPane.scrollTop = this.leftScrollTop;
		if (this.settings.scrollSyncEnabled) {
			this.syncRightPane();
		}
	}

	// 刷新当前文件
	async refresh() {
		if (this.currentFile) {
			try {
				const savedLeftScroll = this.leftScrollTop;
				await this.renderContent();
				setTimeout(() => {
					this.leftScrollTop = savedLeftScroll;
					this.leftPane.scrollTop = this.leftScrollTop;
					this.syncRightPane();
				}, 150);
			} catch (error) {
				console.error('刷新内容失败:', error);
			}
		}
	}
	
	// 清空内容
	clearContent() {
		this.currentFile = null;
		this.leftContent.empty();
		this.rightContent.empty();
		
		const fileInfo = this.containerEl.querySelector('#dual-pane-file-info');
		if (fileInfo) {
			fileInfo.setText('未选择文件');
		}
		
		this.updateViewTitle();
	}

	// 更新视图标题
	updateViewTitle() {
		(this.app.workspace as any).requestSaveLayout?.();
	}

	// 更新设置
	updateSettings(settings: DualPanePluginSettings) {
		this.settings = settings;
	}
}
