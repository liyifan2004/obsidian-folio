import {
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	View,
	Workspace
} from 'obsidian';
		  
import { DualPanePluginSettings, t } from './types';

export type ViewMode = 'dual' | 'triple';

/**
 * Folio - 双栏/三栏跟随模式
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private settings: DualPanePluginSettings;

	private mainLeaf: WorkspaceLeaf | null = null;
	private leftFollowLeaf: WorkspaceLeaf | null = null;
	private rightFollowLeaf: WorkspaceLeaf | null = null;

	// 窗格身份注册表：停止后仍保留，供重启时复用/回收自有跟随窗格（O-002）
	private followerRegistry: {
		main: WorkspaceLeaf | null;
		left: WorkspaceLeaf | null;
		right: WorkspaceLeaf | null;
	} = { main: null, left: null, right: null };

	private isActive: boolean = false;
	private currentMode: ViewMode = 'dual';

	private scrollCleanups: (() => void)[] = [];
	private eventRemovers: (() => void)[] = [];
	private resizeObserver: ResizeObserver | null = null;
	private resizeDebounceTimer: number | null = null;
	private reconcileDebounceTimer: number | null = null;
	private fallbackInterval: number | null = null;
	private lastMainMode: string | null = null;
	private isReconciling: boolean = false;

	private isSyncing: boolean = false;
	private isResizing: boolean = false;

	// 使用更稳定的同步：保存主窗口的滚动比例和具体位置
	private mainScrollRatio: number = 0;  // 0-1 之间的比例
	private mainScrollTop: number = 0;    // 具体像素值

	constructor(workspace: Workspace, settings: DualPanePluginSettings) {
		this.workspace = workspace;
		this.settings = settings;
	}

	isFollowing(): boolean {
		return this.isActive;
	}

	getCurrentMode(): ViewMode {
		return this.currentMode;
	}

	/**
	 * 启动跟随模式
	 * opts.mainLeaf：模式切换时指定主窗格，避免因焦点漂移选错主窗格
	 */
	async startFollowMode(mode: ViewMode = 'dual', opts?: { mainLeaf?: WorkspaceLeaf }): Promise<boolean> {
		if (this.isActive) {
			this.stopFollowMode({ silent: true });
		}

		let activeLeaf = opts?.mainLeaf ?? this.workspace.getMostRecentLeaf();
		if (!activeLeaf) {
			new Notice(t('noticeNeedFile'));
			return false;
		}

		let file = this.getLeafFile(activeLeaf);
		if (!file) {
			new Notice(t('noticeNotSupported'));
			return false;
		}

		// 若当前窗格是注册表中的跟随窗格，而原主窗格仍可用且同文件，则恢复原角色（O-002）
		if (this.isRegisteredFollower(activeLeaf) && this.followerRegistry.main
			&& this.followerRegistry.main !== activeLeaf
			&& this.isReusable(this.followerRegistry.main, file)) {
			activeLeaf = this.followerRegistry.main;
			file = this.getLeafFile(activeLeaf) ?? file;
		}

		this.currentMode = mode;
		this.mainLeaf = activeLeaf;
		this.unmarkFollowLeaf(activeLeaf);

		// 保存当前精确的滚动状态
		this.saveMainScrollState();

		try {
			if (mode === 'triple') {
				await this.setupTriplePane(file);
			} else {
				await this.setupDualPane(file);
			}

			this.isActive = true;
			this.setupFollow();
			
			// 等待内容完全渲染后恢复位置
			await this.waitAndRestoreScroll();
			
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
	 * 保存主窗口的滚动状态
	 */
	private saveMainScrollState(): void {
		if (!this.mainLeaf) return;
		
		try {
			const container = this.getScrollContainer(this.mainLeaf.view);
			if (!container) return;
			
			this.mainScrollTop = container.scrollTop;
			const maxScroll = container.scrollHeight - container.clientHeight;
			this.mainScrollRatio = maxScroll > 0 ? this.mainScrollTop / maxScroll : 0;
		} catch {
			this.mainScrollRatio = 0;
			this.mainScrollTop = 0;
		}
	}

	/**
	 * 等待内容渲染并恢复滚动位置
	 */
	private async waitAndRestoreScroll(): Promise<void> {
		if (!this.mainLeaf) return;

		// 等待内容渲染（长文档需要更长时间）
		await this.waitForRender(this.mainLeaf, 800);

		// 恢复主窗口位置 - 优先使用比例，更稳定
		const container = this.getScrollContainer(this.mainLeaf.view);
		if (container) {
			const maxScroll = container.scrollHeight - container.clientHeight;
			const targetScroll = maxScroll > 0 ? this.mainScrollRatio * maxScroll : 0;
			
			// 使用比例和像素的加权平均，更精确
			const finalScroll = maxScroll > 0 
				? Math.min(targetScroll, maxScroll)
				: this.mainScrollTop;
			
			container.scrollTop = finalScroll;
		}

		// 等待滚动稳定
		await new Promise(resolve => window.setTimeout(resolve, 150));

		// 同步到跟随窗口
		this.forceSyncAll();
	}

	/**
	 * 等待窗口内容渲染完成
	 */
	private async waitForRender(leaf: WorkspaceLeaf, timeout: number = 500): Promise<void> {
		const startTime = Date.now();
		
		while (Date.now() - startTime < timeout) {
			const container = this.getScrollContainer(leaf.view);
			if (container && container.scrollHeight > 100) {
				// 内容似乎已加载，再等待一小段时间让渲染完成
				await new Promise(resolve => window.setTimeout(resolve, 100));
				return;
			}
			await new Promise(resolve => window.setTimeout(resolve, 50));
		}
	}

	/**
	 * 强制同步所有窗口
	 */
	private forceSyncAll(): void {
		if (!this.isActive) return;
		
		// 先让主窗口同步到其他窗口
		this.doSync('main');
		
		// 对于长文档，可能需要多次同步才能稳定
		window.setTimeout(() => this.doSync('main'), 100);
		window.setTimeout(() => this.doSync('main'), 300);
	}

	/**
	 * 设置双栏模式：复用/回收自有窗格，避免重复分栏（O-002）
	 */
	private async setupDualPane(file: TFile): Promise<void> {
		this.retireObsoleteFollowers('dual', file);
		this.rightFollowLeaf = await this.acquireOrCreateFollower('right', file);
	}

	/**
	 * 设置三栏模式
	 */
	private async setupTriplePane(file: TFile): Promise<void> {
		this.retireObsoleteFollowers('triple', file);
		this.rightFollowLeaf = await this.acquireOrCreateFollower('right', file);
		this.leftFollowLeaf = await this.acquireOrCreateFollower('left', file);
	}

	/**
	 * 回收目标模式不再需要的自有跟随窗格，并清理失效的注册项。
	 * 只处理「本插件创建（在注册表中）且仍显示目标文件」的窗格；
	 * 用户已接管（换了文件）的窗格一律不动。
	 */
	private retireObsoleteFollowers(targetMode: ViewMode, file: TFile): void {
		if (targetMode === 'dual') {
			const left = this.followerRegistry.left;
			if (left && left !== this.mainLeaf && this.isReusable(left, file)) {
				left.detach();
			}
			this.followerRegistry.left = null;
		}
		for (const role of ['main', 'left', 'right'] as const) {
			const leaf = this.followerRegistry[role];
			if (leaf && !this.isLeafValid(leaf)) {
				this.followerRegistry[role] = null;
			}
		}
	}

	/**
	 * 取得跟随窗格：优先复用注册表；其次复用带标记的同文件窗格（插件重载场景）；否则新建
	 */
	private async acquireOrCreateFollower(role: 'left' | 'right', file: TFile): Promise<WorkspaceLeaf> {
		const recorded = this.followerRegistry[role];
		if (recorded && recorded !== this.mainLeaf && this.isReusable(recorded, file)) {
			this.markFollowLeaf(recorded, role);
			return recorded;
		}

		const marked = this.findFollowLeaf(file, role);
		if (marked && marked !== this.mainLeaf) {
			this.markFollowLeaf(marked, role);
			return marked;
		}

		const leaf = this.workspace.createLeafBySplit(this.mainLeaf!, 'vertical', role === 'left');
		await new Promise(resolve => window.setTimeout(resolve, 200));

		const mainMode = this.getLeafMode(this.mainLeaf!);
		await leaf.openFile(file, { state: { mode: mainMode } });
		await this.waitForRender(leaf, 500);

		this.markFollowLeaf(leaf, role);
		return leaf;
	}

	/**
	 * 注册表窗格是否可复用：仍有效且显示目标文件
	 */
	private isReusable(leaf: WorkspaceLeaf, file: TFile): boolean {
		if (!this.isLeafValid(leaf)) return false;
		const current = this.getLeafFile(leaf);
		return !!current && current.path === file.path;
	}

	private isRegisteredFollower(leaf: WorkspaceLeaf): boolean {
		return this.followerRegistry.left === leaf || this.followerRegistry.right === leaf;
	}

	/**
	 * 设置跟随
	 */
	private setupFollow(): void {
		if (!this.isActive) return;

		this.setupScrollSync();
		this.setupWorkspaceListeners();
		this.setupResizeListener();
		this.setupFallbackPolling();
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		this.scrollCleanups.forEach(cleanup => cleanup());
		this.scrollCleanups = [];

		if (this.mainLeaf) {
			const mainContainer = this.getScrollContainer(this.mainLeaf.view);
			if (mainContainer) {
				const cleanup = this.attachScrollListener(mainContainer, 'main');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		if (this.leftFollowLeaf) {
			const leftContainer = this.getScrollContainer(this.leftFollowLeaf.view);
			if (leftContainer) {
				const cleanup = this.attachScrollListener(leftContainer, 'left');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}

		if (this.rightFollowLeaf) {
			const rightContainer = this.getScrollContainer(this.rightFollowLeaf.view);
			if (rightContainer) {
				const cleanup = this.attachScrollListener(rightContainer, 'right');
				if (cleanup) this.scrollCleanups.push(cleanup);
			}
		}
	}

	/**
	 * 附加滚动监听器（AbortController 统一清理）
	 */
	private attachScrollListener(container: HTMLElement, source: 'main' | 'left' | 'right'): (() => void) | null {
		let rafId: number | null = null;

		const handler = () => {
			if (this.isSyncing || this.isResizing) return;
			if (rafId) return;

			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				if (this.isActive && !this.isResizing) {
					this.doSync(source);
				}
			});
		};

		const controller = new AbortController();
		container.addEventListener('scroll', handler, { passive: true, signal: controller.signal });

		return () => {
			controller.abort();
			if (rafId) window.cancelAnimationFrame(rafId);
		};
	}

	/**
	 * 设置窗口大小变化监听 - 关键改进
	 */
	private setupResizeListener(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}

		// 使用 ResizeObserver 监听容器大小变化
		this.resizeObserver = new ResizeObserver((entries) => {
			if (!this.isActive) return;
			
			// 标记正在调整大小，暂停滚动同步
			this.isResizing = true;
			
			// 清除之前的定时器
			if (this.resizeDebounceTimer) {
				window.clearTimeout(this.resizeDebounceTimer);
			}
			
			// 防抖：等待调整完成后重新同步
			this.resizeDebounceTimer = window.setTimeout(() => {
				if (this.isActive) {
					// 重新计算同步
					this.forceSyncAll();
					this.isResizing = false;
				}
			}, 150);
		});

		// 观察所有相关元素
		const observeContainer = (leaf: WorkspaceLeaf | null) => {
			if (!leaf) return;
			const container = this.getScrollContainer(leaf.view);
			if (container) {
				this.resizeObserver?.observe(container);
			}
			// 同时观察视图容器本身（栏宽变化）
			this.resizeObserver?.observe(leaf.view.containerEl);
		};

		observeContainer(this.mainLeaf);
		observeContainer(this.leftFollowLeaf);
		observeContainer(this.rightFollowLeaf);
	}

	/**
	 * 工作区事件驱动的状态对账（O-004）：
	 * 文件切换/活动窗格/布局变化即时触发；模式切换无专用事件，由兜底轮询覆盖
	 */
	private setupWorkspaceListeners(): void {
		const scheduleReconcile = () => {
			if (this.reconcileDebounceTimer) {
				window.clearTimeout(this.reconcileDebounceTimer);
			}
			this.reconcileDebounceTimer = window.setTimeout(() => {
				this.reconcileDebounceTimer = null;
				this.reconcile();
			}, 100);
		};

		const onLayoutChange = () => {
			window.setTimeout(() => this.checkAndCleanup(), 100);
			scheduleReconcile();
		};

		const ref1 = this.workspace.on('layout-change', onLayoutChange);
		const ref2 = this.workspace.on('file-open', scheduleReconcile);
		const ref3 = this.workspace.on('active-leaf-change', scheduleReconcile);
		this.eventRemovers.push(
			() => this.workspace.offref(ref1),
			() => this.workspace.offref(ref2),
			() => this.workspace.offref(ref3)
		);
	}

	/**
	 * 低频兜底轮询（500ms）：检查主窗格模式切换（无专用事件），兼作事件遗漏兜底
	 */
	private setupFallbackPolling(): void {
		if (this.fallbackInterval) {
			window.clearInterval(this.fallbackInterval);
		}

		this.lastMainMode = this.mainLeaf ? this.getLeafMode(this.mainLeaf) : null;

		this.fallbackInterval = window.setInterval(() => {
			if (!this.isActive || !this.mainLeaf) return;
			this.reconcile();
			this.checkMainModeChange();
		}, 500);
	}

	private checkMainModeChange(): void {
		if (!this.mainLeaf) return;

		const currentMode = this.getLeafMode(this.mainLeaf);
		if (currentMode !== this.lastMainMode) {
			this.lastMainMode = currentMode;
			this.setupScrollSync();
			window.setTimeout(() => this.forceSyncAll(), 300);
		}
	}

	/**
	 * 对账：任一窗格文件与其余不一致时，以偏离者为源同步全部窗格
	 */
	private reconcile(): void {
		if (!this.isActive || !this.mainLeaf || this.isReconciling) return;

		// 获取所有窗口的当前文件
		const mainFile = this.getLeafFile(this.mainLeaf);
		const leftFile = this.leftFollowLeaf ? this.getLeafFile(this.leftFollowLeaf) : null;
		const rightFile = this.rightFollowLeaf ? this.getLeafFile(this.rightFollowLeaf) : null;

		// 确定参考文件（以最后变化的为准）
		let targetFile: TFile | null = null;
		let source: 'main' | 'left' | 'right' | null = null;

		// 检查主窗口是否变化
		if (mainFile && (!leftFile || mainFile.path !== leftFile.path) &&
			(!rightFile || mainFile.path !== rightFile.path)) {
			targetFile = mainFile;
			source = 'main';
		}
		// 检查左窗口是否变化
		else if (leftFile && leftFile.path !== mainFile?.path) {
			targetFile = leftFile;
			source = 'left';
		}
		// 检查右窗口是否变化
		else if (rightFile && rightFile.path !== mainFile?.path) {
			targetFile = rightFile;
			source = 'right';
		}

		// 如果有变化，同步所有窗口
		if (targetFile && source) {
			void this.syncAllToFile(targetFile, source);
		}
	}

	/**
	 * 同步所有窗口到指定文件
	 */
	private async syncAllToFile(file: TFile, source: 'main' | 'left' | 'right'): Promise<void> {
		if (this.isReconciling) return;
		this.isReconciling = true;

		try {
			// 获取源窗口的模式
			let sourceLeaf: WorkspaceLeaf | null = null;
			if (source === 'main') sourceLeaf = this.mainLeaf;
			else if (source === 'left') sourceLeaf = this.leftFollowLeaf;
			else if (source === 'right') sourceLeaf = this.rightFollowLeaf;

			if (!sourceLeaf) return;

			const targetMode = this.getLeafMode(sourceLeaf);

			// 同步其他窗口
			const syncLeaf = async (leaf: WorkspaceLeaf | null) => {
				if (!leaf || leaf === sourceLeaf) return;

				const currentFile = this.getLeafFile(leaf);
				if (!currentFile || currentFile.path !== file.path) {
					await leaf.openFile(file, { state: { mode: targetMode } });
				}
			};

			await syncLeaf(this.mainLeaf);
			await syncLeaf(this.leftFollowLeaf);
			await syncLeaf(this.rightFollowLeaf);
		} finally {
			this.isReconciling = false;
		}

		// 等待加载完成后同步滚动
		window.setTimeout(() => {
			if (this.isActive) {
				this.forceSyncAll();
			}
		}, 300);
	}

	/**
	 * 执行同步 - 改进的长文档支持
	 */
	private doSync(source: 'main' | 'left' | 'right'): void {
		if (!this.isActive || !this.mainLeaf || this.isResizing) return;

		try {
			this.isSyncing = true;

			const mainContainer = this.getScrollContainer(this.mainLeaf.view);
			const rightContainer = this.rightFollowLeaf 
				? this.getScrollContainer(this.rightFollowLeaf.view) 
				: null;
			const leftContainer = this.leftFollowLeaf 
				? this.getScrollContainer(this.leftFollowLeaf.view) 
				: null;

			if (!mainContainer) {
				this.isSyncing = false;
				return;
			}

			// 使用比例计算，更稳定
			let mainRatio: number;
			
			if (source === 'main') {
				const maxScroll = mainContainer.scrollHeight - mainContainer.clientHeight;
				mainRatio = maxScroll > 0 ? mainContainer.scrollTop / maxScroll : 0;
			} else if (source === 'left' && leftContainer) {
				// 从左窗口计算主窗口比例
				const leftMax = leftContainer.scrollHeight - leftContainer.clientHeight;
				const leftRatio = leftMax > 0 ? leftContainer.scrollTop / leftMax : 0;
				mainRatio = Math.min(1, leftRatio + 0.5); // 粗略估算
			} else if (source === 'right' && rightContainer) {
				// 从右窗口计算主窗口比例
				const rightMax = rightContainer.scrollHeight - rightContainer.clientHeight;
				const rightRatio = rightMax > 0 ? rightContainer.scrollTop / rightMax : 0;
				mainRatio = Math.max(0, rightRatio - 0.5); // 粗略估算
			} else {
				this.isSyncing = false;
				return;
			}

			// 获取当前行高（动态计算，适应字号变化）
			const lineHeight = this.estimateLineHeight(mainContainer);
			const overlapOffset = this.settings.overlapLines * lineHeight;

			// 计算主窗口目标位置（像素）
			const mainMaxScroll = mainContainer.scrollHeight - mainContainer.clientHeight;
			const targetMainScroll = mainMaxScroll > 0 ? mainRatio * mainMaxScroll : 0;

			// 计算跟随窗口的目标位置
			// 关键：使用内容可见的连续性计算
			let targetRightScroll: number | null = null;
			if (rightContainer) {
				// 右窗口应该显示主窗口底部附近的内容
				const mainVisibleBottom = targetMainScroll + mainContainer.clientHeight;
				// 考虑重叠
				targetRightScroll = Math.max(0, mainVisibleBottom - overlapOffset);
				// 限制范围
				const rightMaxScroll = rightContainer.scrollHeight - rightContainer.clientHeight;
				targetRightScroll = Math.min(targetRightScroll, rightMaxScroll);
			}

			let targetLeftScroll: number | null = null;
			if (leftContainer) {
				// 左窗口应该显示主窗口顶部之前的内容
				// 考虑重叠
				targetLeftScroll = Math.max(0, targetMainScroll - leftContainer.clientHeight + overlapOffset);
				// 限制范围
				const leftMaxScroll = leftContainer.scrollHeight - leftContainer.clientHeight;
				targetLeftScroll = Math.min(targetLeftScroll, leftMaxScroll);
			}

			// 应用滚动位置（跳过源窗口）
			const threshold = 3; // 像素阈值
			
			if (source !== 'main' && Math.abs(mainContainer.scrollTop - targetMainScroll) > threshold) {
				mainContainer.scrollTop = targetMainScroll;
			}

			if (source !== 'left' && leftContainer && targetLeftScroll !== null 
				&& Math.abs(leftContainer.scrollTop - targetLeftScroll) > threshold) {
				leftContainer.scrollTop = targetLeftScroll;
			}

			if (source !== 'right' && rightContainer && targetRightScroll !== null 
				&& Math.abs(rightContainer.scrollTop - targetRightScroll) > threshold) {
				rightContainer.scrollTop = targetRightScroll;
			}

			window.setTimeout(() => { this.isSyncing = false; }, 16);
		} catch (error) {
			console.error('同步滚动失败:', error);
			this.isSyncing = false;
		}
	}

	/**
	 * 获取 MarkdownView 的滚动容器
	 */
	private getScrollContainer(view: View): HTMLElement | null {
		try {
			const containerEl = view.containerEl;
			if (!containerEl) return null;

			// 优先使用公开 API getMode()（R-001），非 MarkdownView 回退到状态读取
			let mode: string | undefined;
			if (view instanceof MarkdownView) {
				mode = view.getMode();
			} else {
				try {
					const state = view.getState() as { mode?: string };
					mode = state.mode;
				} catch {
					mode = undefined;
				}
			}

			if (mode === 'preview') {
				const previewView = containerEl.querySelector('.markdown-preview-view');
				if (previewView instanceof HTMLElement) return previewView;
			} else {
				const cmScroller = containerEl.querySelector('.cm-scroller');
				if (cmScroller instanceof HTMLElement) return cmScroller;
			}

			const viewContent = containerEl.querySelector('.view-content');
			if (viewContent instanceof HTMLElement) return viewContent;

			return containerEl;
		} catch {
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
				if (!isNaN(lineHeight) && lineHeight > 0 && lineHeight < 200) {
					return lineHeight;
				}
				const fontSize = parseFloat(computedStyle.fontSize);
				if (!isNaN(fontSize) && fontSize > 0) {
					return fontSize * 1.6;
				}
			}
		} catch {
			// 取样式失败时回退到默认行高
		}
		return 28;
	}

	/**
	 * 翻页：跟随模式下滚动主窗格（其余窗格经同步跟随）；
	 * 未激活时回退为滚动当前活动的 Markdown 视图（O-005）
	 */
	pageScroll(direction: 'up' | 'down'): void {
		let container: HTMLElement | null = null;

		if (this.mainLeaf) {
			container = this.getScrollContainer(this.mainLeaf.view);
		}
		if (!container) {
			const activeView = this.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				container = this.getScrollContainer(activeView);
			}
		}
		if (!container) {
			new Notice(t('noticeNeedFile'));
			return;
		}

		try {
			const mainContainer = container;

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
	 * 检查并清理
	 */
	private checkAndCleanup(): void {
		if (!this.isActive) return;

		if (this.mainLeaf && !this.isLeafValid(this.mainLeaf)) {
			this.stopFollowMode({ silent: true });
			new Notice(t('noticeLeftClosed'));
			return;
		}

		if (this.rightFollowLeaf && !this.isLeafValid(this.rightFollowLeaf)) {
			this.stopFollowMode({ silent: true });
			new Notice(t('noticeRightClosed'));
			return;
		}

		if (this.leftFollowLeaf && !this.isLeafValid(this.leftFollowLeaf)) {
			this.leftFollowLeaf = null;
			this.followerRegistry.left = null;
			this.currentMode = 'dual';
		}
	}

	/**
	 * 检查 leaf 是否有效
	 */
	private isLeafValid(leaf: WorkspaceLeaf): boolean {
		try {
			if (!leaf.view) return false;
			return leaf.view.containerEl.isConnected;
		} catch {
			return false;
		}
	}

	/**
	 * 获取 leaf 模式（公开 API getMode()，R-001）
	 */
	private getLeafMode(leaf: WorkspaceLeaf): 'preview' | 'source' {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const mode = view.getMode();
				if (mode === 'source' || mode === 'preview') {
					return mode;
				}
			}
		} catch {
			// 状态不可读时按阅读模式处理
		}
		return 'preview';
	}

	/**
	 * 获取 leaf 文件
	 */
	private getLeafFile(leaf: WorkspaceLeaf): TFile | null {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) return view.file;
		} catch {
			// 视图不可用时视为无文件
		}
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
			const leafEl = leaf.view.containerEl.closest('.workspace-leaf');
			if (leafEl) {
				leafEl.setAttribute('data-follow-mode', position);
			}
		} catch {
			// 标记失败不影响同步功能
		}
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
		} catch {
			// 查找失败时返回 null，按新建处理
		}
		return null;
	}

	/**
	 * 停止跟随模式（silent：内部转换时抑制「已停止」通知，O-003）
	 */
	stopFollowMode(options?: { silent?: boolean }): void {
		if (!this.isActive) return;
		this.cleanup();
		if (!options?.silent) {
			new Notice(t('noticeStopped'));
		}
	}

	/**
	 * 切换双栏/三栏
	 */
	async switchMode(mode: ViewMode): Promise<void> {
		if (this.isActive) {
			const currentFile = this.getLeafFile(this.mainLeaf!);
			if (currentFile) {
				this.saveMainScrollState();
				const mainLeaf = this.mainLeaf!;
				this.stopFollowMode({ silent: true });
				await this.startFollowMode(mode, { mainLeaf });
			}
		} else {
			await this.startFollowMode(mode);
		}
	}

	/**
	 * 插件卸载：静默清理。保留窗格标记，便于插件重载后重新识别自有窗格（O-002）
	 */
	destroy(): void {
		this.cleanup({ keepMarks: true });
	}

	/**
	 * 清理资源
	 */
	private cleanup(options?: { keepMarks?: boolean }): void {
		// 记录窗格身份，供下次启动复用/回收（O-002）
		this.followerRegistry = {
			main: this.mainLeaf,
			left: this.leftFollowLeaf,
			right: this.rightFollowLeaf
		};

		this.scrollCleanups.forEach(cleanup => cleanup());
		this.scrollCleanups = [];

		this.eventRemovers.forEach(remove => remove());
		this.eventRemovers = [];

		if (this.reconcileDebounceTimer) {
			window.clearTimeout(this.reconcileDebounceTimer);
			this.reconcileDebounceTimer = null;
		}

		if (this.fallbackInterval) {
			window.clearInterval(this.fallbackInterval);
			this.fallbackInterval = null;
		}

		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.resizeDebounceTimer) {
			window.clearTimeout(this.resizeDebounceTimer);
			this.resizeDebounceTimer = null;
		}

		if (!options?.keepMarks) {
			if (this.rightFollowLeaf) {
				this.unmarkFollowLeaf(this.rightFollowLeaf);
			}
			if (this.leftFollowLeaf) {
				this.unmarkFollowLeaf(this.leftFollowLeaf);
			}
		}

		this.mainLeaf = null;
		this.rightFollowLeaf = null;
		this.leftFollowLeaf = null;
		this.isActive = false;
		this.isResizing = false;
		this.isReconciling = false;
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
			const leafEl = leaf.view.containerEl.closest('.workspace-leaf');
			if (leafEl) leafEl.removeAttribute('data-follow-mode');
		} catch {
			// 清理失败不影响后续使用
		}
	}
}
