import { 
	ItemView, 
	WorkspaceLeaf, 
	TFile, 
	MarkdownRenderer,
	Component,
	MarkdownView,
	Editor,
	setIcon
} from 'obsidian';
import { DualPanePluginSettings, DEFAULT_SETTINGS, EditorMode, DualPaneViewState } from './types';

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
	
	// 滚动同步锁（防止循环触发）
	private isScrolling: boolean = false;
	private scrollTimeout: number | null = null;
	
	// 渲染的组件（用于清理）
	private renderComponent: Component;
	
	// 设置
	settings: DualPanePluginSettings;
	
	// 内容总高度缓存
	private contentHeight: number = 0;
	
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

	/**
	 * 获取视图状态
	 */
	getState(): DualPaneViewState {
		return {
			file: this.currentFile?.path,
			mode: this.editorMode
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
		
		// 添加模式指示
		this.updateModeIndicator();
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
		
		// 中间：模式切换按钮
		const modeGroup = toolbar.createDiv('dual-pane-mode-group');
		
		const previewBtn = modeGroup.createEl('button', {
			cls: 'dual-pane-mode-btn active',
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
		
		const sourceBtn = modeGroup.createEl('button', {
			cls: 'dual-pane-mode-btn',
			text: '源码'
		});
		sourceBtn.id = 'mode-source';
		sourceBtn.addEventListener('click', () => this.switchMode('source'));
		
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
	}

	updateModeIndicator() {
		// 更新模式按钮状态
		const modes: EditorMode[] = ['preview', 'edit', 'source'];
		modes.forEach(mode => {
			const btn = this.containerEl.querySelector(`#mode-${mode}`);
			if (btn) {
				btn.toggleClass('active', mode === this.editorMode);
			}
		});
	}

	async switchMode(mode: EditorMode) {
		if (this.editorMode === mode) return;
		
		this.editorMode = mode;
		this.updateModeIndicator();
		
		// 重新渲染内容
		if (this.currentFile) {
			await this.renderContent();
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
	}

	/**
	 * 同步右栏位置，实现内容接续
	 */
	syncRightPane() {
		const paneHeight = this.leftPane.clientHeight;
		const leftMaxScroll = this.leftContent.scrollHeight - paneHeight;
		
		// 计算左栏当前显示的底部位置
		const leftBottom = this.leftScrollTop + paneHeight;
		
		// 右栏从该位置开始显示
		this.rightPane.scrollTop = leftBottom;
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
		if (!this.settings.syncKeyboard) return;
		
		this.leftPane.setAttribute('tabindex', '0');
		this.rightPane.setAttribute('tabindex', '0');
		
		this.containerEl.addEventListener('keydown', (e) => {
			if (!this.settings.syncKeyboard) return;
			
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
			
			if (this.editorMode === 'preview') {
				await this.renderPreviewMode();
			} else if (this.editorMode === 'edit') {
				await this.renderEditMode();
			} else {
				await this.renderSourceMode();
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
	 * 编辑模式渲染 - 使用 CodeMirror
	 */
	async renderEditMode() {
		if (!this.currentFile) return;
		
		const content = await this.app.vault.read(this.currentFile);
		
		this.leftContent.removeClass('markdown-rendered');
		this.rightContent.removeClass('markdown-rendered');
		
		// 创建编辑器容器
		this.createEditorInPane(this.leftContent, content, 'left');
		this.createEditorInPane(this.rightContent, content, 'right');
	}

	/**
	 * 源码模式渲染
	 */
	async renderSourceMode() {
		if (!this.currentFile) return;
		
		const content = await this.app.vault.read(this.currentFile);
		
		this.leftContent.removeClass('markdown-rendered');
		this.rightContent.removeClass('markdown-rendered');
		
		// 创建源码编辑器
		this.createSourceEditor(this.leftContent, content, 'left');
		this.createSourceEditor(this.rightContent, content, 'right');
	}

	/**
	 * 在面板中创建编辑器
	 */
	createEditorInPane(container: HTMLElement, content: string, pane: 'left' | 'right') {
		// 创建编辑器容器
		const editorContainer = container.createDiv('dual-pane-editor');
		
		// 添加编辑提示
		const hint = editorContainer.createDiv('editor-hint');
		hint.setText(pane === 'left' ? '左栏编辑' : '右栏编辑');
		
		// 创建 textarea 作为简单编辑器
		// 注意：完整实现需要使用 CodeMirror，这里使用简化版本
		const textarea = editorContainer.createEl('textarea', {
			cls: 'dual-pane-textarea',
			text: content
		});
		
		// 设置样式使其像编辑器
		textarea.style.width = '100%';
		textarea.style.height = 'calc(100% - 24px)';
		textarea.style.background = 'var(--background-primary)';
		textarea.style.color = 'var(--text-normal)';
		textarea.style.border = 'none';
		textarea.style.resize = 'none';
		textarea.style.fontFamily = 'var(--font-monospace)';
		textarea.style.fontSize = 'var(--font-text-size)';
		textarea.style.lineHeight = 'var(--line-height-normal)';
		textarea.style.padding = '10px';
		
		// 同步编辑内容到另一侧
		textarea.addEventListener('input', () => {
			const otherPane = pane === 'left' ? this.rightContent : this.leftContent;
			const otherTextarea = otherPane.querySelector('textarea');
			if (otherTextarea) {
				otherTextarea.value = textarea.value;
			}
			
			// 保存到文件
			if (this.currentFile) {
				this.app.vault.modify(this.currentFile, textarea.value);
			}
		});
	}

	/**
	 * 创建源码编辑器
	 */
	createSourceEditor(container: HTMLElement, content: string, pane: 'left' | 'right') {
		// 与编辑模式类似，但强调纯文本
		const editorContainer = container.createDiv('dual-pane-source-editor');
		
		const hint = editorContainer.createDiv('editor-hint');
		hint.setText(pane === 'left' ? '左栏源码' : '右栏源码');
		
		const textarea = editorContainer.createEl('textarea', {
			cls: 'dual-pane-textarea source-mode',
			text: content
		});
		
		textarea.style.width = '100%';
		textarea.style.height = 'calc(100% - 24px)';
		textarea.style.background = 'var(--background-primary)';
		textarea.style.color = 'var(--text-normal)';
		textarea.style.border = 'none';
		textarea.style.resize = 'none';
		textarea.style.fontFamily = 'var(--font-monospace)';
		textarea.style.fontSize = 'var(--font-text-size)';
		textarea.style.lineHeight = 'var(--line-height-normal)';
		textarea.style.padding = '10px';
		textarea.style.tabSize = '2';
		
		// 同步编辑内容
		textarea.addEventListener('input', () => {
			const otherPane = pane === 'left' ? this.rightContent : this.leftContent;
			const otherTextarea = otherPane.querySelector('textarea');
			if (otherTextarea) {
				otherTextarea.value = textarea.value;
			}
			
			if (this.currentFile) {
				this.app.vault.modify(this.currentFile, textarea.value);
			}
		});
	}

	/**
	 * 初始化面板位置
	 */
	initializePanePositions() {
		// 左栏从顶部开始
		this.leftScrollTop = 0;
		this.leftPane.scrollTop = 0;
		
		// 同步右栏位置
		this.syncRightPane();
	}

	/**
	 * 翻页 - 关键改进：实现无缝衔接
	 */
	pageScroll(direction: 'up' | 'down') {
		const paneHeight = this.leftPane.clientHeight;
		const contentHeight = this.leftContent.scrollHeight;
		
		if (direction === 'down') {
			// 下一页：左栏当前底部位置变成新的顶部
			// 这样右栏当前显示的顶部内容会变成新的左栏顶部
			const currentLeftBottom = this.leftScrollTop + paneHeight;
			
			// 检查是否还有内容
			if (currentLeftBottom >= contentHeight) {
				return; // 已经到末尾
			}
			
			// 新的左栏顶部 = 当前左栏底部
			this.leftScrollTop = currentLeftBottom;
			
		} else {
			// 上一页：需要回到上一屏
			// 新的左栏顶部 = 当前左栏顶部 - 面板高度
			const newScrollTop = this.leftScrollTop - paneHeight;
			this.leftScrollTop = Math.max(0, newScrollTop);
		}
		
		// 应用滚动
		this.leftPane.scrollTop = this.leftScrollTop;
		
		// 同步右栏
		if (this.settings.scrollSyncEnabled) {
			this.syncRightPane();
		}
	}

	// 刷新当前文件
	async refresh() {
		if (this.currentFile) {
			try {
				// 保存当前滚动位置
				const savedLeftScroll = this.leftScrollTop;
				
				await this.renderContent();
				
				// 恢复滚动位置
				setTimeout(() => {
					this.leftScrollTop = savedLeftScroll;
					this.leftPane.scrollTop = this.leftScrollTop;
					this.syncRightPane();
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
		
		const fileInfo = this.containerEl.querySelector('#dual-pane-file-info');
		if (fileInfo) {
			fileInfo.setText('未选择文件');
		}
		
		this.updateViewTitle();
	}

	// 更新视图标题
	updateViewTitle() {
		// 触发视图标题更新
		(this.app.workspace as any).requestSaveLayout?.();
	}

	// 更新设置
	updateSettings(settings: DualPanePluginSettings) {
		this.settings = settings;
	}
}
