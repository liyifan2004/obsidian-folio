import { 
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	Workspace
} from 'obsidian';
import { DualPanePluginSettings, t, detectObsidianLanguage, setLanguage } from './types';

export type ViewMode = 'dual' | 'triple';

/**
 * Folio - 双栏/三栏跟随模式
 * 
 * 双栏模式：主窗口 + 右跟随（显示后一屏）
 * 三栏模式：左跟随（前一屏）+ 主窗口 + 右跟随（后一屏）
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private settings: DualPanePluginSettings;
	
	// 窗口引用
	private mainLeaf: WorkspaceLeaf | null = null;
	private leftFollowLeaf: WorkspaceLeaf | null = null;
	private rightFollowLeaf: WorkspaceLeaf | null = null;
	
	private isActive: boolean = false;
	private currentMode: ViewMode = 'dual';
	
	// 清理函数
	private scrollCleanups: (() => void)[] = [];
	private layoutChangeRef: (() => void) | null = null;
	private modeChangeInterval: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private fileChangeInterval: number | null = null;

	// 防止循环滚动
	private isSyncing: boolean = false;
	
	// 保存的滚动状态（使用百分比，更稳定）
	private savedScrollPercent: number = 0;
	private savedMainFile: TFile | null = null;

	constructor(workspace: Workspace, settings: DualPanePluginSettings) {
		this.workspace = workspace;
		this.settings = settings;
		
		const detectedLang = detectObsidianLanguage();
		setLanguage(detectedLang);
	}

	isFollowing(): boolean {
		return this.isActive;
	}

	getCurrentMode(): ViewMode {
		return this.currentMode;
	}

	/**
	 * 启动跟随模式
	 */
	async startFollowMode(mode: ViewMode = 'dual'): Promise<boolean> {
		if (this.isActive) {
			this.stopFollowMode();
		}

		const activeLeaf = this.workspace.getMostRecentLeaf();
		if (!activeLeaf) {
			new Notice(t('noticeNeedFile'));
			return false;
		}

		const file = this.getLeafFile(activeLeaf);
		if (!file) {
			new Notice(t('noticeNotSupported'));
			return false;
		}

		this.currentMode = mode;
		this.mainLeaf = activeLeaf;
		this.savedMainFile = file;

		// 关键：保存当前滚动位置（在创建新窗口之前）
		this.savedScrollPercent = this.getScrollPercent(activeLeaf);

		try {
			if (mode === 'triple') {
				await this.setupTriplePane(file);
			} else {
				await this.setupDualPane(file);
			}

			this.isActive = true;
			this.setupFollow();
			
			// 恢复滚动位置并同步
			await this.restoreScrollPosition();
			
			const modeText = mode === 'triple' ? t('noticeTripleStarted') : t('noticeDualStarted');
			new Notice(modeText);
			return true;

		} catch (error) {
			console.error('启动跟随模式失败:', error);
			new Notice(t('noticeNotSupported'));
			this.cleanup();
			return false;
		}
	}

	/**
	 * 获取滚动百分比位置（更稳定，不受窗口大小影响）
	 */
	private getScrollPercent(leaf: WorkspaceLeaf): number {
		try {
			const container = this.getScrollContainer(leaf.view as MarkdownView);
			if (!container) return 0;
			
			const maxScroll = container.scrollHeight - container.clientHeight;
			if (maxScroll <= 0) return 0;
			
			return container.scrollTop / maxScroll;
		} catch (e) {
			return 0;
		}
	}

	/**
	 * 设置滚动百分比位置
	 */
	private setScrollPercent(leaf: WorkspaceLeaf, percent: number): void {
		try {
			const container = this.getScrollContainer(leaf.view as MarkdownView);
			if (!container) return;
			
			const maxScroll = container.scrollHeight - container.clientHeight;
			if (maxScroll <= 0) return;
			
			const targetScroll = Math.max(0, Math.min(percent * maxScroll, maxScroll));
			container.scrollTop = targetScroll;
		} catch (e) {
			// 忽略错误
		}
	}

	/**
	 * 恢复滚动位置并同步
	 */
	private async restoreScrollPosition(): Promise<void> {
		if (!this.mainLeaf) return;

		// 等待内容渲染完成
		await new Promise(resolve => setTimeout(resolve, 300));

		// 恢复主窗口位置
		this.setScrollPercent(this.mainLeaf, this.savedScrollPercent);

		// 等待主窗口滚动完成
		await new Promise(resolve => setTimeout(resolve, 100));

		// 同步其他窗口
		this.doSync('main');
	}

	/**
	 * 设置双栏模式
	 */
	private async setupDualPane(file: TFile): Promise<void> {
		const existingRight = this.findFollowLeaf(file, 'right');
		if (existingRight && existingRight !== this.mainLeaf) {
			this.rightFollowLeaf = existingRight;
			this.markFollowLeaf(this.rightFollowLeaf, 'right');
			return;
		}

		// 创建右跟随窗口
		this.rightFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', false);
		await new Promise(resolve => setTimeout(resolve, 150));
		
		const mainMode = this.getLeafMode(this.mainLeaf!);
		await this.rightFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 300));
		
		this.markFollowLeaf(this.rightFollowLeaf, 'right');
	}

	/**
	 * 设置三栏模式
	 */
	private async setupTriplePane(file: TFile): Promise<void> {
		this.closeExistingFollowWindows(file);

		const mainMode = this.getLeafMode(this.mainLeaf!);

		// 先创建右跟随
		this.rightFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', false);
		await new Promise(resolve => setTimeout(resolve, 150));
		await this.rightFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 200));
		this.markFollowLeaf(this.rightFollowLeaf, 'right');

		// 再创建左跟随
		this.leftFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', true);
		await new Promise(resolve => setTimeout(resolve, 150));
		await this.leftFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 200));
		this.markFollowLeaf(this.leftFollowLeaf, 'left');
	}

	/**
	 * 关闭已存在的跟随窗口
	 */
	private closeExistingFollowWindows(file: TFile): void {
		const leaves = this.workspace.getLeavesOfType('markdown');
		for (const leaf of leaves) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			
			const contentEl = view.contentEl;
			const isMarked = contentEl?.getAttribute('data-follow-mode') === 'left' ||
							 contentEl?.getAttribute('data-follow-mode') === 'right';
			
			if (isMarked && view.file && view.file.path === file.path) {
				if (leaf !== this.mainLeaf) {
					leaf.detach();
				}
			}
		}
	}

	/**
	 * 设置跟随
	 */
	private setupFollow(): void {
		if (!this.isActive) return;
		
		this.setupScrollSync();
		this.setupLayoutListener();
		this.setupModeChangeListener();
		this.setupResizeListener();
		this.setupFileChangeListener();
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		this.scrollCleanups.forEach(cleanup => cleanup());
		this.scrollCleanups = [];

		if (this.mainLeaf) {
			const mainContainer = this.getScrollContainer(this.mainLeaf.view as MarkdownView);
			if (mainContainer) {
				const cleanup = this.attachScrollListener(mainContainer, 'main');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		if (this.leftFollowLeaf) {
			const leftContainer = this.getScrollContainer(this.leftFollowLeaf.view as MarkdownView);
			if (leftContainer) {
				const cleanup = this.attachScrollListener(leftContainer, 'left');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		if (this.rightFollowLeaf) {
			const rightContainer = this.getScrollContainer(this.rightFollowLeaf.view as MarkdownView);
			if (rightContainer) {
				const cleanup = this.attachScrollListener(rightContainer, 'right');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}
	}

	/**
	 * 附加滚动监听器
	 */
	private attachScrollListener(container: HTMLElement, source: 'main' | 'left' | 'right'): (() => void) | null {
		let rafId: number | null = null;
		
		const handler = () => {
			if (this.isSyncing) return;
			if (rafId) return;
			
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (this.isActive) {
					this.doSync(source);
				}
			});
		};

		container.addEventListener('scroll', handler, { passive: true });
		
		return () => {
			container.removeEventListener('scroll', handler);
			if (rafId) cancelAnimationFrame(rafId);
		};
	}

	/**
	 * 设置窗口大小变化监听（关键修复）
	 */
	private setupResizeListener(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}

		// 使用 ResizeObserver 监听窗口大小变化
		this.resizeObserver = new ResizeObserver((entries) => {
			if (!this.isActive || this.isSyncing) return;
			
			// 延迟执行，等待渲染完成
			setTimeout(() => {
				if (this.isActive) {
					this.doSync('main');
				}
			}, 100);
		});

		// 观察所有窗口的容器
		if (this.mainLeaf) {
			const container = this.getScrollContainer(this.mainLeaf.view as MarkdownView);
			if (container) this.resizeObserver.observe(container);
		}
		if (this.leftFollowLeaf) {
			const container = this.getScrollContainer(this.leftFollowLeaf.view as MarkdownView);
			if (container) this.resizeObserver.observe(container);
		}
		if (this.rightFollowLeaf) {
			const container = this.getScrollContainer(this.rightFollowLeaf.view as MarkdownView);
			if (container) this.resizeObserver.observe(container);
		}
	}

	/**
	 * 设置文件变化监听（关键修复：切换笔记时同步）
	 */
	private setupFileChangeListener(): void {
		if (this.fileChangeInterval) {
			window.clearInterval(this.fileChangeInterval);
		}

		// 轮询检查主窗口的文件是否变化
		this.fileChangeInterval = window.setInterval(() => {
			if (!this.isActive || !this.mainLeaf) return;

			const currentFile = this.getLeafFile(this.mainLeaf);
			if (!currentFile) return;

			// 如果文件变化了，同步更新跟随窗口
			if (this.savedMainFile && currentFile.path !== this.savedMainFile.path) {
				this.savedMainFile = currentFile;
				this.syncFileToFollowers(currentFile);
			}
		}, 500);
	}

	/**
	 * 同步文件到跟随窗口
	 */
	private async syncFileToFollowers(file: TFile): Promise<void> {
		const mainMode = this.getLeafMode(this.mainLeaf!);

		// 同步到右跟随窗口
		if (this.rightFollowLeaf) {
			const rightFile = this.getLeafFile(this.rightFollowLeaf);
			if (!rightFile || rightFile.path !== file.path) {
				await this.rightFollowLeaf.openFile(file, { state: { mode: mainMode } });
			}
		}

		// 同步到左跟随窗口
		if (this.leftFollowLeaf) {
			const leftFile = this.getLeafFile(this.leftFollowLeaf);
			if (!leftFile || leftFile.path !== file.path) {
				await this.leftFollowLeaf.openFile(file, { state: { mode: mainMode } });
			}
		}

		// 等待加载完成后同步滚动
		setTimeout(() => {
			if (this.isActive) {
				this.doSync('main');
			}
		}, 300);
	}

	/**
	 * 执行同步
	 * 
	 * 改进的同步逻辑：
	 * - 使用百分比位置计算，更稳定
	 * - 考虑实际可见内容的偏移
	 */
	private doSync(source: 'main' | 'left' | 'right'): void {
		if (!this.isActive || !this.mainLeaf) return;

		try {
			this.isSyncing = true;

			const mainContainer = this.getScrollContainer(this.mainLeaf.view as MarkdownView);
			const rightContainer = this.rightFollowLeaf 
				? this.getScrollContainer(this.rightFollowLeaf.view as MarkdownView) 
				: null;
			const leftContainer = this.leftFollowLeaf 
				? this.getScrollContainer(this.leftFollowLeaf.view as MarkdownView) 
				: null;

			if (!mainContainer) {
				this.isSyncing = false;
				return;
			}

			const mainHeight = mainContainer.clientHeight;
			const lineHeight = this.estimateLineHeight(mainContainer);
			const overlapOffset = this.settings.overlapLines * lineHeight;

			// 计算主窗口的目标位置
			let targetMainScroll: number;

			if (source === 'main') {
				targetMainScroll = mainContainer.scrollTop;
			} else if (source === 'left' && leftContainer) {
				// 左窗口滚动 -> 主窗口 = 左窗口 + 左窗口高度 - 重叠
				targetMainScroll = leftContainer.scrollTop + leftContainer.clientHeight - overlapOffset;
			} else if (source === 'right' && rightContainer) {
				// 右窗口滚动 -> 主窗口 = 右窗口 - 右窗口高度 + 重叠
				targetMainScroll = rightContainer.scrollTop - rightContainer.clientHeight + overlapOffset;
			} else {
				this.isSyncing = false;
				return;
			}

			// 限制范围
			const mainMaxScroll = mainContainer.scrollHeight - mainContainer.clientHeight;
			targetMainScroll = Math.max(0, Math.min(targetMainScroll, mainMaxScroll));

			// 计算跟随窗口的目标位置
			// 右窗口 = 主窗口 + 主窗口高度 - 重叠
			let targetRightScroll: number | null = null;
			if (rightContainer) {
				targetRightScroll = targetMainScroll + mainHeight - overlapOffset;
				const rightMaxScroll = rightContainer.scrollHeight - rightContainer.clientHeight;
				targetRightScroll = Math.max(0, Math.min(targetRightScroll, rightMaxScroll));
			}

			// 左窗口 = 主窗口 - 左窗口高度 + 重叠
			let targetLeftScroll: number | null = null;
			if (leftContainer) {
				targetLeftScroll = targetMainScroll - leftContainer.clientHeight + overlapOffset;
				targetLeftScroll = Math.max(0, targetLeftScroll);
			}

			// 应用滚动位置（跳过源窗口）
			if (source !== 'main' && Math.abs(mainContainer.scrollTop - targetMainScroll) > 2) {
				mainContainer.scrollTop = targetMainScroll;
			}

			if (source !== 'left' && leftContainer && targetLeftScroll !== null 
				&& Math.abs(leftContainer.scrollTop - targetLeftScroll) > 2) {
				leftContainer.scrollTop = targetLeftScroll;
			}

			if (source !== 'right' && rightContainer && targetRightScroll !== null 
				&& Math.abs(rightContainer.scrollTop - targetRightScroll) > 2) {
				rightContainer.scrollTop = targetRightScroll;
			}

			setTimeout(() => { this.isSyncing = false; }, 16);
		} catch (error) {
			console.error('同步滚动失败:', error);
			this.isSyncing = false;
		}
	}

	/**
	 * 获取 MarkdownView 的滚动容器
	 */
	private getScrollContainer(view: MarkdownView): HTMLElement | null {
		try {
			const contentEl = view.contentEl;
			if (!contentEl) return null;

			const state = view.getState();
			const mode = (state as any).mode;

			if (mode === 'preview') {
				const previewView = contentEl.querySelector('.markdown-preview-view');
				if (previewView instanceof HTMLElement) return previewView;
			} else {
				const cmScroller = contentEl.querySelector('.cm-scroller');
				if (cmScroller instanceof HTMLElement) return cmScroller;
			}

			const viewContent = contentEl.querySelector('.view-content');
			if (viewContent instanceof HTMLElement) return viewContent;

			return contentEl;
		} catch (error) {
			return null;
		}
	}

	/**
	 * 估算行高（每次重新计算，适应字号变化）
	 */
	private estimateLineHeight(container: HTMLElement): number {
		try {
			const sampleEl = container.querySelector('p, .cm-line, .markdown-preview-sizer > div');
			if (sampleEl instanceof HTMLElement) {
				const computedStyle = window.getComputedStyle(sampleEl);
				const lineHeight = parseFloat(computedStyle.lineHeight);
				if (!isNaN(lineHeight) && lineHeight > 0) {
					return lineHeight;
				}
				// 如果 line-height 是 normal，使用字体大小的 1.5 倍估算
				const fontSize = parseFloat(computedStyle.fontSize);
				if (!isNaN(fontSize) && fontSize > 0) {
					return fontSize * 1.6;
				}
			}
		} catch (e) {
			// 忽略错误
		}
		return 28;
	}

	/**
	 * 翻页
	 */
	pageScroll(direction: 'up' | 'down'): void {
		if (!this.mainLeaf) return;

		try {
			const mainView = this.mainLeaf.view as MarkdownView;
			const mainContainer = this.getScrollContainer(mainView);
			if (!mainContainer) return;

			const paneHeight = mainContainer.clientHeight;
			let newScrollTop = mainContainer.scrollTop;

			if (direction === 'down') {
				newScrollTop += paneHeight;
			} else {
				newScrollTop -= paneHeight;
			}

			const maxScroll = mainContainer.scrollHeight - mainContainer.clientHeight;
			newScrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));

			mainContainer.scrollTop = newScrollTop;
		} catch (error) {
			console.error('翻页失败:', error);
		}
	}

	/**
	 * 监听模式变化
	 */
	private setupModeChangeListener(): void {
		if (!this.mainLeaf) return;

		let lastMode = this.getLeafMode(this.mainLeaf);

		this.modeChangeInterval = window.setInterval(() => {
			if (!this.isActive || !this.mainLeaf) return;

			const currentMode = this.getLeafMode(this.mainLeaf);
			if (currentMode !== lastMode) {
				lastMode = currentMode;
				// 模式变化时重新设置监听和同步
				this.setupScrollSync();
				setTimeout(() => this.doSync('main'), 200);
			}
		}, 500);
	}

	/**
	 * 设置布局监听
	 */
	private setupLayoutListener(): void {
		const handler = () => {
			setTimeout(() => this.checkAndCleanup(), 100);
		};

		this.workspace.on('layout-change', handler);
		this.layoutChangeRef = () => {
			this.workspace.off('layout-change', handler);
		};
	}

	/**
	 * 检查并清理
	 */
	private checkAndCleanup(): void {
		if (!this.isActive) return;

		if (this.mainLeaf && !this.isLeafValid(this.mainLeaf)) {
			this.stopFollowMode();
			new Notice(t('noticeLeftClosed'));
			return;
		}

		if (this.rightFollowLeaf && !this.isLeafValid(this.rightFollowLeaf)) {
			this.stopFollowMode();
			new Notice(t('noticeRightClosed'));
			return;
		}

		if (this.leftFollowLeaf && !this.isLeafValid(this.leftFollowLeaf)) {
			this.leftFollowLeaf = null;
			this.currentMode = 'dual';
		}
	}

	/**
	 * 检查 leaf 是否有效
	 */
	private isLeafValid(leaf: WorkspaceLeaf): boolean {
		try {
			if (!leaf.view) return false;
			const container = (leaf as any).containerEl;
			if (container && !document.body.contains(container)) return false;
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * 获取 leaf 模式
	 */
	private getLeafMode(leaf: WorkspaceLeaf): 'preview' | 'source' {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const state = view.getState();
				const mode = (state as any).mode;
				if (mode === 'source' || mode === 'preview') {
					return mode;
				}
			}
		} catch (e) {}
		return 'preview';
	}

	/**
	 * 获取 leaf 文件
	 */
	private getLeafFile(leaf: WorkspaceLeaf): TFile | null {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) return view.file;
		} catch (error) {}
		return null;
	}

	/**
	 * 标记跟随窗口
	 */
	private markFollowLeaf(leaf: WorkspaceLeaf, position: 'left' | 'right'): void {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const contentEl = view.contentEl;
				if (contentEl) {
					contentEl.setAttribute('data-follow-mode', position);
				}
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) {
				containerEl.setAttribute('data-follow-mode', position);
			}
		} catch (error) {}
	}

	/**
	 * 查找已存在的跟随窗口
	 */
	private findFollowLeaf(file: TFile, position: 'left' | 'right'): WorkspaceLeaf | null {
		try {
			const leaves = this.workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				const view = leaf.view;
				if (!(view instanceof MarkdownView)) continue;
				
				const contentEl = view.contentEl;
				const isMarked = contentEl?.getAttribute('data-follow-mode') === position;
				
				if (isMarked && view.file && view.file.path === file.path) {
					return leaf;
				}
			}
		} catch (error) {}
		return null;
	}

	/**
	 * 停止跟随模式
	 */
	stopFollowMode(): void {
		if (!this.isActive) return;
		this.cleanup();
		new Notice(t('noticeStopped'));
	}

	/**
	 * 切换跟随模式
	 */
	toggleFollowMode(): void {
		if (this.isActive) {
			this.stopFollowMode();
		} else {
			this.startFollowMode('dual');
		}
	}

	/**
	 * 切换双栏/三栏
	 */
	async switchMode(mode: ViewMode): Promise<void> {
		if (this.isActive) {
			const currentFile = this.getLeafFile(this.mainLeaf!);
			if (currentFile) {
				// 保存当前滚动位置
				this.savedScrollPercent = this.getScrollPercent(this.mainLeaf!);
				this.stopFollowMode();
				await this.startFollowMode(mode);
			}
		} else {
			await this.startFollowMode(mode);
		}
	}

	/**
	 * 清理资源
	 */
	private cleanup(): void {
		this.scrollCleanups.forEach(cleanup => cleanup());
		this.scrollCleanups = [];

		if (this.layoutChangeRef) {
			this.layoutChangeRef();
			this.layoutChangeRef = null;
		}

		if (this.modeChangeInterval) {
			window.clearInterval(this.modeChangeInterval);
			this.modeChangeInterval = null;
		}

		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.fileChangeInterval) {
			window.clearInterval(this.fileChangeInterval);
			this.fileChangeInterval = null;
		}

		if (this.rightFollowLeaf) {
			this.unmarkFollowLeaf(this.rightFollowLeaf);
		}
		if (this.leftFollowLeaf) {
			this.unmarkFollowLeaf(this.leftFollowLeaf);
		}

		this.mainLeaf = null;
		this.rightFollowLeaf = null;
		this.leftFollowLeaf = null;
		this.savedMainFile = null;
		this.isActive = false;
	}

	/**
	 * 取消标记
	 */
	private unmarkFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const contentEl = view.contentEl;
				if (contentEl) contentEl.removeAttribute('data-follow-mode');
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) containerEl.removeAttribute('data-follow-mode');
		} catch (error) {}
	}
}
