import { 
	ItemView, 
	WorkspaceLeaf, 
	TFile, 
	MarkdownRenderer,
	Component
} from 'obsidian';
import { DualPanePluginSettings, DEFAULT_SETTINGS, EditorMode, PageScrollMode, DualPaneViewState } from './types';

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
	
	// 编辑器模式
	editorMode: EditorMode = 'preview';
	isSourceMode: boolean = false;  // 源码模式是编辑状态下的开关
	
	// 滚动同步锁（防止循环触发）
	private isScrolling: boolean = false;
	private scrollTimeout: number | null = null;
	
	// 渲染的组件（用于清理）
	private renderComponent: Component;
	
	// 设置
	settings: DualPanePluginSettings;
	
	// 当前左栏顶部位置
	private leftScrollTop: number = 0;
	
	// 编辑器的引用
	private leftEditor: HTMLTextAreaElement | null = null;
	private rightEditor: HTMLTextAreaElement | null = null;

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

	/**
	 * 获取视图状态
	 */
	getState(): DualPaneViewState {
		return {
			file: this.currentFile?.path,
			mode: this.editorMode,
			isSourceMode: this.isSourceMode
		};
	}

	/**
	 * 设置视图状态
	 */
	async setState(state: DualPaneViewState, result: any): Promise<void> {
		if (state.file) {
			const file = this.app.vault.getAbstractFileByPath(state.file);
			if (file instanceof TFile) {
				this.editorMode = (state.mode as EditorMode) || 'preview';
				this.isSourceMode = state.isSourceMode || false;
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
		
		// 更新UI状态
		this.updateToolbarState();
	}

	async onClose() {
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
		
		// 中间：模式切换按钮组
		const modeGroup = toolbar.createDiv('dual-pane-mode-group');
		
		// 阅读/编辑切换按钮（互斥）
		const previewBtn = modeGroup.createEl('button', {
			cls: 'dual-pane-mode-btn',
			text: '阅读'
		});
		previewBtn.id = 'mode-preview';
		previewBtn.addEventListener('click', () => this.switchMode('preview'));
		
		const editBtn = modeGroup.createEl('button', {
			cls: 'dual-pane-mode-btn',
			text: '编辑'
		});
		editBtn.id = 'mode-edit';
		editBtn.addEventListener('click', () => this.switchMode('edit'));
		
		// 源码模式开关（仅在编辑模式下有效）
		const sourceBtn = modeGroup.createEl('button', {
			cls: 'dual-pane-mode-btn source-toggle',
			text: '源码'
		});
		sourceBtn.id = 'mode-source';
		sourceBtn.addEventListener('click', () => this.toggleSourceMode());
		
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

	updateToolbarState() {
		// 更新阅读/编辑按钮状态
		const previewBtn = this.containerEl.querySelector('#mode-preview');
		const editBtn = this.containerEl.querySelector('#mode-edit');
		const sourceBtn = this.containerEl.querySelector('#mode-source');
		
		if (previewBtn) {
			previewBtn.toggleClass('active', this.editorMode === 'preview');
		}
		if (editBtn) {
			editBtn.toggleClass('active', this.editorMode === 'edit');
		}
		if (sourceBtn) {
			sourceBtn.toggleClass('active', this.isSourceMode);
			sourceBtn.toggleClass('disabled', this.editorMode === 'preview');
		}
	}

	async switchMode(mode: EditorMode) {
		if (this.editorMode === mode) return;
		
		this.editorMode = mode;
		
		// 切换到阅读模式时，关闭源码模式
		if (mode === 'preview') {
			this.isSourceMode = false;
		}
		
		this.updateToolbarState();
		
		// 重新渲染内容
		if (this.currentFile) {
			await this.renderContent();
		}
	}

	toggleSourceMode() {
		// 源码模式只能在编辑模式下切换
		if (this.editorMode === 'preview') {
			// 如果当前是阅读模式，先切换到编辑模式
			this.switchMode('edit');
			return;
		}
		
		this.isSourceMode = !this.isSourceMode;
		this.updateToolbarState();
		
		// 重新渲染内容
		if (this.currentFile) {
			this.renderContent();
		}
	}

	createPanes() {
		const panesWrapper = this.containerEl.createDiv('dual-panes-wrapper');
		
		// 左侧面板
		this.leftPane = panesWrapper.createDiv('dual-pane left-pane');
		this.leftContent = this.leftPane.createDiv('pane-content');
		
		// 分隔线
		const divider = panesWrapper.createDiv('pane-divider');
		
		// 右侧面板
		this.rightPane = panesWrapper.createDiv('dual-pane right-pane');
		this.rightContent = this.rightPane.createDiv('pane-content');
		
		// 设置滚动同步
		this.setupScrollSync();
		
		// 设置键盘导航
		this.setupKeyboardNav();
	}

	setupScrollSync() {
		// 左侧面板滚动事件
		this.leftPane.addEventListener('scroll', () => {
			if (this.isScrolling) return;
			this.isScrolling = true;
			
			// 保存左栏滚动位置
			this.leftScrollTop = this.leftPane.scrollTop;
			
			// 同步右栏位置（左栏底部对齐到右栏顶部）
			if (this.settings.scrollSyncEnabled) {
				this.syncRightPane();
			}
			
			this.resetScrollLock();
		});
		
		// 右侧面板滚动事件 - 反向同步到左栏
		this.rightPane.addEventListener('scroll', () => {
			if (this.isScrolling) return;
			this.isScrolling = true;
			
			if (this.settings.scrollSyncEnabled && this.editorMode === 'preview') {
				// 根据右栏位置计算左栏位置
				const paneHeight = this.rightPane.clientHeight;
				const rightScrollTop = this.rightPane.scrollTop;
				
				// 左栏顶部 = 右栏顶部 - 面板高度
				this.leftScrollTop = Math.max(0, rightScrollTop - paneHeight);
				this.leftPane.scrollTop = this.leftScrollTop;
			}
			
			this.resetScrollLock();
		});
	}

	/**
	 * 同步右栏位置，实现内容接续
	 * 考虑重合行数设置（解决工具栏遮挡问题）
	 */
	syncRightPane() {
		// 仅在阅读模式下进行同步滚动
		if (this.editorMode !== 'preview') return;
		
		const paneHeight = this.leftPane.clientHeight;
		const lineHeight = this.getLineHeightFromContent();
		
		// 计算重合偏移（像素）
		const overlapOffset = this.settings.overlapLines * lineHeight;
		
		// 计算左栏当前显示的底部位置，减去重合行数
		const leftBottom = this.leftScrollTop + paneHeight - overlapOffset;
		
		// 右栏从该位置开始显示（实现重合）
		let targetScrollTop = leftBottom;
		if (targetScrollTop < 0) targetScrollTop = 0;
		
		this.rightPane.scrollTop = targetScrollTop;
	}

	/**
	 * 从内容中估计行高
	 */
	getLineHeightFromContent(): number {
		// 尝试从内容中获取实际行高
		const firstParagraph = this.leftContent.querySelector('p, li, h1, h2, h3, h4, h5, h6');
		if (firstParagraph instanceof HTMLElement) {
			const computedStyle = window.getComputedStyle(firstParagraph);
			const lineHeight = parseFloat(computedStyle.lineHeight);
			if (!isNaN(lineHeight) && lineHeight > 0) {
				return lineHeight;
			}
		}
		// 默认行高
		return 24;
	}

	/**
	 * 同步编辑器的滚动位置
	 */
	syncEditorScroll() {
		if (!this.leftEditor || !this.rightEditor) return;
		
		const leftPaneHeight = this.leftPane.clientHeight;
		const lineHeight = this.getLineHeight();
		const leftScrollLines = Math.floor(this.leftScrollTop / lineHeight);
		
		// 计算右栏应该显示的行数，减去重合行数
		const linesPerPane = Math.floor(leftPaneHeight / lineHeight);
		const rightStartLine = leftScrollLines + linesPerPane - this.settings.overlapLines;
		
		// 设置右栏的滚动位置
		let targetScrollTop = rightStartLine * lineHeight;
		if (targetScrollTop < 0) targetScrollTop = 0;
		
		this.rightEditor.scrollTop = targetScrollTop;
	}

	getLineHeight(): number {
		// 估计的行高（像素）
		return this.isSourceMode ? 18 : 24;
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
		// 注意：不再绑定默认的 PageUp/PageDown/空格键
		// 用户可以通过 Obsidian 的快捷键设置自定义翻页快捷键
		// 只设置 tabindex 使面板可以获得焦点
		this.leftPane.setAttribute('tabindex', '0');
		this.rightPane.setAttribute('tabindex', '0');
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
		
		// 检查文件是否存在
		if (!this.app.vault.getAbstractFileByPath(this.currentFile.path)) {
			console.warn('文件不存在:', this.currentFile.path);
			this.clearContent();
			return;
		}
		
		try {
			// 清空现有内容
			this.leftContent.empty();
			this.rightContent.empty();
			this.leftEditor = null;
			this.rightEditor = null;
			
			if (this.editorMode === 'preview') {
				await this.renderPreviewMode();
			} else {
				await this.renderEditMode();
			}
			
			// 等待渲染完成后初始化位置
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
	 * 阅读模式渲染
	 */
	async renderPreviewMode() {
		if (!this.currentFile) return;
		
		const content = await this.app.vault.read(this.currentFile);
		
		this.leftContent.addClass('markdown-rendered');
		this.rightContent.addClass('markdown-rendered');
		
		// 左右两栏都渲染完整内容
		await MarkdownRenderer.render(
			this.app,
			content,
			this.leftContent,
			this.currentFile.path,
			this.renderComponent
		);
		
		await MarkdownRenderer.render(
			this.app,
			content,
			this.rightContent,
			this.currentFile.path,
			this.renderComponent
		);
	}

	/**
	 * 编辑模式渲染
	 */
	async renderEditMode() {
		if (!this.currentFile) return;
		
		const content = await this.app.vault.read(this.currentFile);
		
		this.leftContent.removeClass('markdown-rendered');
		this.rightContent.removeClass('markdown-rendered');
		
		// 创建编辑器容器 - 关键：设置正确的容器高度
		this.leftContent.addClass('editor-mode');
		this.rightContent.addClass('editor-mode');
		
		// 创建编辑器
		this.createEditorInPane(this.leftContent, content, 'left');
		this.createEditorInPane(this.rightContent, content, 'right');
	}

	/**
	 * 在面板中创建编辑器
	 * 方案：左侧可编辑，右侧只读显示接续内容
	 * 
	 * 关键设计：
	 * 1. 编辑时不同步到文件（避免触发 modify 事件导致重渲染）
	 * 2. 提供显式保存按钮
	 * 3. 右侧只读，避免焦点竞争
	 */
	createEditorInPane(container: HTMLElement, content: string, pane: 'left' | 'right') {
		// 创建编辑器容器
		const editorContainer = container.createDiv('dual-pane-editor-container');
		
		// 创建 textarea
		const textarea = editorContainer.createEl('textarea', {
			cls: `dual-pane-textarea ${this.isSourceMode ? 'source-mode' : 'edit-mode'}`
		});
		
		// 设置内容
		textarea.value = content;
		
		// 保存引用
		if (pane === 'left') {
			this.leftEditor = textarea;
		} else {
			this.rightEditor = textarea;
		}
		
		if (pane === 'left') {
			// 左侧：可编辑
			textarea.removeAttribute('readonly');
			
			// 输入时只更新右侧显示，不保存到文件
			// 这样可以避免文件修改事件导致的重渲染
			textarea.addEventListener('input', () => {
				// 使用 requestAnimationFrame 避免阻塞输入
				requestAnimationFrame(() => {
					if (this.rightEditor) {
						const rightScrollTop = this.rightEditor.scrollTop;
						this.rightEditor.value = textarea.value;
						this.rightEditor.scrollTop = rightScrollTop;
					}
				});
			});
			
			// 左侧滚动时同步右侧
			textarea.addEventListener('scroll', () => {
				if (this.rightEditor) {
					const lineHeight = this.getLineHeight();
					const scrollLines = Math.floor(textarea.scrollTop / lineHeight);
					const linesPerPane = Math.floor(textarea.clientHeight / lineHeight);
					this.rightEditor.scrollTop = (scrollLines + linesPerPane) * lineHeight;
				}
			});
			
			// 失焦时保存到文件
			textarea.addEventListener('blur', () => {
				this.saveToFile(textarea.value);
			});
			
			// 定期保存（每 5 秒）
			const autoSaveInterval = window.setInterval(() => {
				if (textarea.value !== this.lastSavedContent) {
					this.saveToFile(textarea.value);
				}
			}, 5000);
			
			// 清理函数
			this.register(() => {
				window.clearInterval(autoSaveInterval);
			});
			
		} else {
			// 右侧：只读
			textarea.setAttribute('readonly', 'true');
			textarea.addClass('readonly');
			textarea.tabIndex = -1; // 禁止通过 tab 聚焦
		}
	}

	// 上次保存的内容，用于比较
	private lastSavedContent: string = '';
	
	// 防抖保存
	private saveTimeout: number | null = null;
	saveToFile(content: string) {
		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}
		
		this.saveTimeout = window.setTimeout(async () => {
			if (this.currentFile && content !== this.lastSavedContent) {
				try {
					await this.app.vault.modify(this.currentFile, content);
					this.lastSavedContent = content;
				} catch (error) {
					console.error('保存文件失败:', error);
				}
			}
		}, 300);
	}

	/**
	 * 初始化面板位置
	 * 考虑重合行数设置
	 */
	initializePanePositions() {
		if (this.editorMode === 'preview') {
			// 阅读模式：左栏从顶部开始
			this.leftScrollTop = 0;
			this.leftPane.scrollTop = 0;
			this.syncRightPane();
		} else {
			// 编辑模式：设置编辑器的拼接位置
			if (this.leftEditor && this.rightEditor) {
				const lineHeight = this.getLineHeight();
				const paneHeight = this.leftPane.clientHeight;
				const linesPerPane = Math.floor(paneHeight / lineHeight);
				
				// 左栏从第0行开始
				this.leftEditor.scrollTop = 0;
				// 右栏从 linesPerPane - overlapLines 行开始（实现重合）
				const rightStartLine = Math.max(0, linesPerPane - this.settings.overlapLines);
				this.rightEditor.scrollTop = rightStartLine * lineHeight;
			}
		}
	}

	/**
	 * 翻页 - 支持两种模式
	 */
	pageScroll(direction: 'up' | 'down') {
		if (this.editorMode === 'preview') {
			this.pageScrollPreview(direction);
		} else {
			this.pageScrollEditor(direction);
		}
	}

	/**
	 * 阅读模式翻页
	 */
	pageScrollPreview(direction: 'up' | 'down') {
		const paneHeight = this.leftPane.clientHeight;
		const contentHeight = this.leftContent.scrollHeight;
		
		if (direction === 'down') {
			if (this.settings.pageScrollMode === 'single') {
				// 单栏翻页模式：右侧内容移到左侧
				const currentLeftBottom = this.leftScrollTop + paneHeight;
				if (currentLeftBottom >= contentHeight) return;
				this.leftScrollTop = currentLeftBottom;
			} else {
				// 双栏翻页模式：两侧都翻页（跳过一整屏内容）
				const currentLeftBottom = this.leftScrollTop + paneHeight * 2;
				if (currentLeftBottom >= contentHeight) return;
				this.leftScrollTop = currentLeftBottom;
			}
		} else {
			// 上一页
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

	/**
	 * 编辑模式翻页
	 */
	pageScrollEditor(direction: 'up' | 'down') {
		if (!this.leftEditor || !this.rightEditor) return;
		
		const lineHeight = this.getLineHeight();
		const paneHeight = this.leftPane.clientHeight;
		const linesPerPane = Math.floor(paneHeight / lineHeight);
		const totalLines = this.leftEditor.value.split('\n').length;
		
		// 获取当前左栏顶部的行数
		const currentLeftLine = Math.floor(this.leftEditor.scrollTop / lineHeight);
		
		let newLeftLine: number;
		
		if (direction === 'down') {
			if (this.settings.pageScrollMode === 'single') {
				// 单栏翻页：右侧内容移到左侧
				newLeftLine = currentLeftLine + linesPerPane;
			} else {
				// 双栏翻页：跳过一整屏
				newLeftLine = currentLeftLine + linesPerPane * 2;
			}
		} else {
			// 上一页
			if (this.settings.pageScrollMode === 'single') {
				newLeftLine = currentLeftLine - linesPerPane;
			} else {
				newLeftLine = currentLeftLine - linesPerPane * 2;
			}
		}
		
		// 边界检查
		newLeftLine = Math.max(0, Math.min(newLeftLine, totalLines - 1));
		
		// 应用滚动
		const newScrollTop = newLeftLine * lineHeight;
		this.leftEditor.scrollTop = newScrollTop;
		
		// 同步右栏（接续显示）
		const rightScrollTop = (newLeftLine + linesPerPane) * lineHeight;
		this.rightEditor.scrollTop = Math.min(rightScrollTop, (totalLines - 1) * lineHeight);
	}

	// 刷新当前文件
	async refresh() {
		if (this.currentFile) {
			try {
				// 保存当前滚动位置
				const savedLeftScroll = this.leftScrollTop;
				const savedLeftEditorScroll = this.leftEditor?.scrollTop || 0;
				
				await this.renderContent();
				
				// 恢复滚动位置
				setTimeout(() => {
					if (this.editorMode === 'preview') {
						this.leftScrollTop = savedLeftScroll;
						this.leftPane.scrollTop = this.leftScrollTop;
						this.syncRightPane();
					} else if (this.leftEditor) {
						this.leftEditor.scrollTop = savedLeftEditorScroll;
						this.syncEditorScroll();
					}
				}, 150);
			} catch (error) {
				console.error('刷新双栏视图内容失败:', error);
			}
		}
	}
	
	// 清空内容
	clearContent() {
		this.currentFile = null;
		this.leftContent.empty();
		this.rightContent.empty();
		this.leftEditor = null;
		this.rightEditor = null;
		
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
