import { 
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	Workspace
} from 'obsidian';

/**
 * 双栏跟随模式 - 增强版
 * 
 * 特性：
 * 1. 左侧可切换编辑/预览模式，右侧自动跟随
 * 2. 右侧默认视图与左侧保持一致
 * 3. 支持双向滚动：左→右，右→左
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private leftScrollCleanup: (() => void) | null = null;
	private rightScrollCleanup: (() => void) | null = null;
	private layoutChangeRef: (() => void) | null = null;
	private modeChangeInterval: number | null = null;

	// 防止循环滚动
	private isSyncingLeft: boolean = false;
	private isSyncingRight: boolean = false;

	constructor(workspace: Workspace) {
		this.workspace = workspace;
	}

	isFollowing(): boolean {
		return this.isActive;
	}

	/**
	 * 启动跟随模式
	 */
	async startFollowMode(): Promise<boolean> {
		if (this.isActive) {
			this.stopFollowMode();
		}

		const activeLeaf = this.workspace.getMostRecentLeaf();
		if (!activeLeaf) {
			new Notice('请先打开一个文件');
			return false;
		}

		const file = this.getLeafFile(activeLeaf);
		if (!file) {
			new Notice('当前视图不支持双栏跟随模式');
			return false;
		}

		// 获取左侧当前模式
		const leftMode: 'preview' | 'source' = this.getLeafMode(activeLeaf);

		// 检查是否已经有该文件的跟随窗口
		const existingRight = this.findFollowLeaf(file);
		if (existingRight && existingRight !== activeLeaf) {
			this.leftLeaf = activeLeaf;
			this.rightLeaf = existingRight;
			this.isActive = true;
			this.setupFollow();
			new Notice('双栏跟随模式已恢复');
			return true;
		}

		this.leftLeaf = activeLeaf;

		try {
			// 创建右侧分割窗口
			this.rightLeaf = this.workspace.createLeafBySplit(activeLeaf, 'vertical', false);
			
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// 在右侧打开同一个文件，使用与左侧相同的模式
			await this.rightLeaf.openFile(file, {
				state: { mode: leftMode },
				active: true
			});

			await new Promise(resolve => setTimeout(resolve, 200));

			// 标记为跟随窗口
			this.markFollowLeaf(this.rightLeaf);
			
			this.isActive = true;
			
			// 设置跟随
			this.setupFollow();

			new Notice('双栏跟随模式已启动');
			return true;

		} catch (error) {
			console.error('启动跟随模式失败:', error);
			new Notice('启动跟随模式失败');
			this.cleanup();
			return false;
		}
	}

	/**
	 * 获取 leaf 的当前模式
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
		} catch (e) {
			// ignore
		}
		return 'preview';
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
			this.doSync('left');
		}, 500);
	}

	/**
	 * 监听左侧模式变化
	 */
	private setupModeChangeListener(): void {
		if (!this.leftLeaf) return;

		let lastMode = this.getLeafMode(this.leftLeaf);

		// 定期检查模式变化
		this.modeChangeInterval = window.setInterval(() => {
			if (!this.isActive || !this.leftLeaf) return;

			const currentMode = this.getLeafMode(this.leftLeaf);
			if (currentMode !== lastMode) {
				console.log('跟随模式：检测到左侧模式变化', lastMode, '->', currentMode);
				lastMode = currentMode;
				
				// 重新设置滚动同步（因为滚动容器可能变化）
				this.setupScrollSync();
			}
		}, 500);
	}

	/**
	 * 设置滚动同步 - 支持双向滚动
	 */
	private setupScrollSync(): void {
		// 清理旧的监听
		if (this.leftScrollCleanup) {
			this.leftScrollCleanup();
			this.leftScrollCleanup = null;
		}
		if (this.rightScrollCleanup) {
			this.rightScrollCleanup();
			this.rightScrollCleanup = null;
		}

		if (!this.leftLeaf || !this.rightLeaf) return;

		const leftView = this.leftLeaf.view;
		const rightView = this.rightLeaf.view;

		if (!(leftView instanceof MarkdownView) || !(rightView instanceof MarkdownView)) return;

		const leftContainer = this.getScrollContainer(leftView);
		const rightContainer = this.getScrollContainer(rightView);

		if (!leftContainer || !rightContainer) {
			console.warn('无法获取滚动容器');
			return;
		}

		console.log('跟随模式：设置双向滚动同步');

		// 左→右滚动
		let leftRafId: number | null = null;
		const leftScrollHandler = () => {
			if (this.isSyncingRight) return; // 避免循环
			if (leftRafId) return;
			
			leftRafId = requestAnimationFrame(() => {
				leftRafId = null;
				if (this.isActive) {
					this.doSync('left');
				}
			});
		};

		// 右→左滚动
		let rightRafId: number | null = null;
		const rightScrollHandler = () => {
			if (this.isSyncingLeft) return; // 避免循环
			if (rightRafId) return;
			
			rightRafId = requestAnimationFrame(() => {
				rightRafId = null;
				if (this.isActive) {
					this.doSync('right');
				}
			});
		};

		leftContainer.addEventListener('scroll', leftScrollHandler, { passive: true });
		rightContainer.addEventListener('scroll', rightScrollHandler, { passive: true });

		this.leftScrollCleanup = () => {
			leftContainer.removeEventListener('scroll', leftScrollHandler);
			if (leftRafId) cancelAnimationFrame(leftRafId);
		};

		this.rightScrollCleanup = () => {
			rightContainer.removeEventListener('scroll', rightScrollHandler);
			if (rightRafId) cancelAnimationFrame(rightRafId);
		};
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
	 * 执行同步
	 * @param source 'left' | 'right' - 滚动源
	 */
	private doSync(source: 'left' | 'right'): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		try {
			const leftView = this.leftLeaf.view;
			const rightView = this.rightLeaf.view;

			if (!(leftView instanceof MarkdownView) || !(rightView instanceof MarkdownView)) return;

			const leftContainer = this.getScrollContainer(leftView);
			const rightContainer = this.getScrollContainer(rightView);

			if (!leftContainer || !rightContainer) return;

			if (source === 'left') {
				// 左→右：右侧顶部 = 左侧底部
				this.isSyncingLeft = true;
				
				const leftScrollTop = leftContainer.scrollTop;
				const leftHeight = leftContainer.clientHeight;
				
				let targetScrollTop = leftScrollTop + leftHeight;
				const rightMaxScroll = rightContainer.scrollHeight - rightContainer.clientHeight;
				
				if (targetScrollTop > rightMaxScroll) targetScrollTop = rightMaxScroll;
				if (targetScrollTop < 0) targetScrollTop = 0;
				
				rightContainer.scrollTop = targetScrollTop;
				
				setTimeout(() => { this.isSyncingLeft = false; }, 16);
			} else {
				// 右→左：左侧顶部 = 右侧顶部 - 面板高度
				this.isSyncingRight = true;
				
				const rightScrollTop = rightContainer.scrollTop;
				const paneHeight = leftContainer.clientHeight;
				
				let targetScrollTop = rightScrollTop - paneHeight;
				if (targetScrollTop < 0) targetScrollTop = 0;
				
				leftContainer.scrollTop = targetScrollTop;
				
				setTimeout(() => { this.isSyncingRight = false; }, 16);
			}
		} catch (error) {
			console.error('同步滚动失败:', error);
		}
	}

	/**
	 * 翻页
	 */
	pageScroll(direction: 'up' | 'down'): void {
		if (!this.leftLeaf) return;

		try {
			const leftView = this.leftLeaf.view;
			if (!(leftView instanceof MarkdownView)) return;

			const leftContainer = this.getScrollContainer(leftView);
			if (!leftContainer) return;

			const paneHeight = leftContainer.clientHeight;
			let newScrollTop = leftContainer.scrollTop;

			if (direction === 'down') {
				newScrollTop += paneHeight;
			} else {
				newScrollTop -= paneHeight;
			}

			const maxScroll = leftContainer.scrollHeight - leftContainer.clientHeight;
			newScrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));

			leftContainer.scrollTop = newScrollTop;
		} catch (error) {
			console.error('翻页失败:', error);
		}
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

		if (this.leftLeaf && !this.isLeafValid(this.leftLeaf)) {
			this.stopFollowMode();
			new Notice('双栏跟随模式已结束（左侧窗口已关闭）');
			return;
		}

		if (this.rightLeaf && !this.isLeafValid(this.rightLeaf)) {
			this.stopFollowMode();
			new Notice('双栏跟随模式已结束（右侧窗口已关闭）');
			return;
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
	 * 停止跟随模式
	 */
	stopFollowMode(): void {
		if (!this.isActive) return;
		this.cleanup();
		new Notice('双栏跟随模式已停止');
	}

	/**
	 * 清理资源
	 */
	private cleanup(): void {
		if (this.leftScrollCleanup) {
			this.leftScrollCleanup();
			this.leftScrollCleanup = null;
		}
		if (this.rightScrollCleanup) {
			this.rightScrollCleanup();
			this.rightScrollCleanup = null;
		}
		if (this.layoutChangeRef) {
			this.layoutChangeRef();
			this.layoutChangeRef = null;
		}
		if (this.modeChangeInterval) {
			window.clearInterval(this.modeChangeInterval);
			this.modeChangeInterval = null;
		}
		if (this.rightLeaf) {
			this.unmarkFollowLeaf(this.rightLeaf);
		}
		this.leftLeaf = null;
		this.rightLeaf = null;
		this.isActive = false;
	}

	/**
	 * 获取 leaf 对应的文件
	 */
	private getLeafFile(leaf: WorkspaceLeaf): TFile | null {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) return view.file;
		} catch (error) {}
		return null;
	}

	/**
	 * 标记为跟随窗口
	 */
	private markFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const contentEl = view.contentEl;
				if (contentEl) contentEl.setAttribute('data-follow-mode', 'true');
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) containerEl.setAttribute('data-follow-mode', 'true');
		} catch (error) {}
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

	/**
	 * 切换跟随模式
	 */
	toggleFollowMode(): void {
		if (this.isActive) {
			this.stopFollowMode();
		} else {
			this.startFollowMode();
		}
	}

	/**
	 * 查找已存在的跟随窗口
	 */
	private findFollowLeaf(file: TFile): WorkspaceLeaf | null {
		try {
			const leaves = this.workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				const view = leaf.view;
				if (!(view instanceof MarkdownView)) continue;
				
				const contentEl = view.contentEl;
				const isMarked = contentEl?.getAttribute('data-follow-mode') === 'true';
				
				if (isMarked && view.file && view.file.path === file.path) {
					return leaf;
				}
			}
		} catch (error) {}
		return null;
	}
}
