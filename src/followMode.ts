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
 * 双栏/三栏跟随模式
 * 
 * 双栏模式：
 * - 左侧：主窗口
 * - 右侧：跟随窗口（显示后一屏）
 * 
 * 三栏模式：
 * - 左侧：跟随窗口（显示前一屏）
 * - 中间：主窗口
 * - 右侧：跟随窗口（显示后一屏）
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
	
	// 滚动清理函数
	private scrollCleanups: (() => void)[] = [];
	private layoutChangeRef: (() => void) | null = null;
	private modeChangeInterval: number | null = null;

	// 防止循环滚动
	private isSyncing: boolean = false;

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

		try {
			if (mode === 'triple') {
				// 三栏模式：左跟随 + 中间主窗口 + 右跟随
				await this.setupTriplePane(file);
			} else {
				// 双栏模式：主窗口 + 右跟随
				await this.setupDualPane(file);
			}

			this.isActive = true;
			this.setupFollow();
			
			const modeText = mode === 'triple' ? '三栏' : '双栏';
			new Notice(`${modeText}同步阅读已启动`);
			return true;

		} catch (error) {
			console.error('启动跟随模式失败:', error);
			new Notice(t('noticeNotSupported'));
			this.cleanup();
			return false;
		}
	}

	/**
	 * 设置双栏模式
	 */
	private async setupDualPane(file: TFile): Promise<void> {
		// 检查是否已有该文件的跟随窗口
		const existingRight = this.findFollowLeaf(file, 'right');
		if (existingRight && existingRight !== this.mainLeaf) {
			this.rightFollowLeaf = existingRight;
			this.markFollowLeaf(this.rightFollowLeaf, 'right');
			return;
		}

		// 在右侧创建跟随窗口
		this.rightFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', false);
		await new Promise(resolve => setTimeout(resolve, 100));
		
		const mainMode = this.getLeafMode(this.mainLeaf!);
		await this.rightFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 200));
		
		this.markFollowLeaf(this.rightFollowLeaf, 'right');
	}

	/**
	 * 设置三栏模式
	 */
	private async setupTriplePane(file: TFile): Promise<void> {
		// 先关闭可能存在的跟随窗口
		this.closeExistingFollowWindows(file);

		const mainMode = this.getLeafMode(this.mainLeaf!);

		// 第一步：在中间（原位置）创建主窗口的副本，把原主窗口移到左边
		// 实际上，我们应该：
		// 1. 在主窗口左侧创建一个分割（这是左跟随）
		// 2. 在主窗口右侧创建一个分割（这是右跟随）
		
		// 创建右跟随窗口
		this.rightFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', false);
		await new Promise(resolve => setTimeout(resolve, 100));
		await this.rightFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 100));
		this.markFollowLeaf(this.rightFollowLeaf, 'right');

		// 创建左跟随窗口（在主窗口左侧）
		this.leftFollowLeaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', true);
		await new Promise(resolve => setTimeout(resolve, 100));
		await this.leftFollowLeaf.openFile(file, { state: { mode: mainMode } });
		await new Promise(resolve => setTimeout(resolve, 100));
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
			const isMarked = contentEl?.getAttribute('data-follow-mode') === 'true';
			
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
		
		setTimeout(() => {
			if (!this.isActive) return;
			
			this.setupScrollSync();
			this.setupLayoutListener();
			this.setupModeChangeListener();
			
			// 初始同步
			this.doSync('main');
		}, 500);
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		// 清理旧的监听
		this.scrollCleanups.forEach(cleanup => cleanup());
		this.scrollCleanups = [];

		// 主窗口滚动监听
		if (this.mainLeaf) {
			const mainContainer = this.getScrollContainer(this.mainLeaf.view as MarkdownView);
			if (mainContainer) {
				const cleanup = this.attachScrollListener(mainContainer, 'main');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		// 左跟随窗口滚动监听
		if (this.leftFollowLeaf) {
			const leftContainer = this.getScrollContainer(this.leftFollowLeaf.view as MarkdownView);
			if (leftContainer) {
				const cleanup = this.attachScrollListener(leftContainer, 'left');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		// 右跟随窗口滚动监听
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
	 * 执行同步
	 * 
	 * 双向同步逻辑：
	 * - 主窗口在 middle
	 * - 左跟随窗口显示前一屏：left = main - height + overlap
	 * - 右跟随窗口显示后一屏：right = main + height - overlap
	 * 
	 * 任意窗口滚动时，都需要更新其他窗口的位置
	 */
	private doSync(source: 'main' | 'left' | 'right'): void {
		if (!this.isActive || !this.mainLeaf) return;

		try {
			this.isSyncing = true;

			// 获取所有容器的引用
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

			// 根据源窗口计算主窗口的目标位置
			let targetMainScroll: number | null = null;

			if (source === 'main') {
				// 主窗口滚动 -> 直接使用主窗口位置
				targetMainScroll = mainContainer.scrollTop;
			} else if (source === 'left' && leftContainer) {
				// 左窗口滚动 -> 主窗口 = 左窗口 + 左窗口高度 - 重叠
				const leftHeight = leftContainer.clientHeight;
				targetMainScroll = leftContainer.scrollTop + leftHeight - overlapOffset;
			} else if (source === 'right' && rightContainer) {
				// 右窗口滚动 -> 主窗口 = 右窗口 - 右窗口高度 + 重叠
				const rightHeight = rightContainer.clientHeight;
				targetMainScroll = rightContainer.scrollTop - rightHeight + overlapOffset;
			}

			if (targetMainScroll === null) {
				this.isSyncing = false;
				return;
			}

			// 限制主窗口滚动范围
			const mainMaxScroll = mainContainer.scrollHeight - mainContainer.clientHeight;
			targetMainScroll = Math.max(0, Math.min(targetMainScroll, mainMaxScroll));

			// 计算跟随窗口的目标位置
			// 左窗口 = 主窗口 - 主窗口高度 + 重叠
			let targetLeftScroll: number | null = null;
			if (leftContainer) {
				targetLeftScroll = targetMainScroll - mainHeight + overlapOffset;
				targetLeftScroll = Math.max(0, targetLeftScroll);
			}

			// 右窗口 = 主窗口 + 主窗口高度 - 重叠
			let targetRightScroll: number | null = null;
			if (rightContainer) {
				targetRightScroll = targetMainScroll + mainHeight - overlapOffset;
				const rightMaxScroll = rightContainer.scrollHeight - rightContainer.clientHeight;
				targetRightScroll = Math.max(0, Math.min(targetRightScroll, rightMaxScroll));
			}

			// 应用滚动位置（跳过源窗口）
			if (source !== 'main' && mainContainer.scrollTop !== targetMainScroll) {
				mainContainer.scrollTop = targetMainScroll;
			}

			if (source !== 'left' && leftContainer && targetLeftScroll !== null 
				&& leftContainer.scrollTop !== targetLeftScroll) {
				leftContainer.scrollTop = targetLeftScroll;
			}

			if (source !== 'right' && rightContainer && targetRightScroll !== null 
				&& rightContainer.scrollTop !== targetRightScroll) {
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
	 * 估算行高
	 */
	private estimateLineHeight(container: HTMLElement): number {
		const sampleEl = container.querySelector('p, .cm-line, .markdown-preview-sizer > div');
		if (sampleEl instanceof HTMLElement) {
			const computedStyle = window.getComputedStyle(sampleEl);
			const lineHeight = parseFloat(computedStyle.lineHeight);
			if (!isNaN(lineHeight) && lineHeight > 0) {
				return lineHeight;
			}
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
				this.setupScrollSync();
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

		// 检查主窗口
		if (this.mainLeaf && !this.isLeafValid(this.mainLeaf)) {
			this.stopFollowMode();
			new Notice(t('noticeLeftClosed'));
			return;
		}

		// 检查跟随窗口
		if (this.rightFollowLeaf && !this.isLeafValid(this.rightFollowLeaf)) {
			this.stopFollowMode();
			new Notice(t('noticeRightClosed'));
			return;
		}

		if (this.leftFollowLeaf && !this.isLeafValid(this.leftFollowLeaf)) {
			// 左跟随窗口被关闭，降级为双栏模式
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
			// 已在运行，切换模式
			const currentFile = this.getLeafFile(this.mainLeaf!);
			if (currentFile) {
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

		// 取消标记
		if (this.rightFollowLeaf) {
			this.unmarkFollowLeaf(this.rightFollowLeaf);
		}
		if (this.leftFollowLeaf) {
			this.unmarkFollowLeaf(this.leftFollowLeaf);
		}

		this.mainLeaf = null;
		this.rightFollowLeaf = null;
		this.leftFollowLeaf = null;
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
