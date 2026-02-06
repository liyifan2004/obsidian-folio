import { 
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	Workspace
} from 'obsidian';

/**
 * 双栏跟随模式
 * 
 * 核心原理：
 * 1. 左侧保持用户当前的 MarkdownView（编辑或预览模式）
 * 2. 右侧创建一个新的 MarkdownView，强制为预览模式
 * 3. 监听左侧的滚动事件，计算滚动位置，同步到右侧
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private scrollCleanup: (() => void) | null = null;
	private layoutChangeRef: (() => void) | null = null;

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
			new Notice('当前视图不支持双栏跟随模式，请先打开一个 Markdown 文件');
			return false;
		}

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
			
			// 在右侧打开同一个文件，强制为预览模式
			await this.rightLeaf.openFile(file, {
				state: { mode: 'preview' },
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
	 * 设置跟随
	 */
	private setupFollow(): void {
		if (!this.isActive) return;
		
		// 延迟设置，等待视图完全加载
		setTimeout(() => {
			if (!this.isActive) return;
			
			this.setupScrollSync();
			this.setupLayoutListener();
			
			// 初始同步
			this.doSync();
		}, 500);
	}

	/**
	 * 设置滚动同步 - 关键方法
	 */
	private setupScrollSync(): void {
		if (!this.leftLeaf) return;

		const leftView = this.leftLeaf.view;
		if (!(leftView instanceof MarkdownView)) return;

		// 获取左侧的滚动容器
		const leftContainer = this.getScrollContainer(leftView);
		if (!leftContainer) {
			console.warn('无法获取左侧滚动容器');
			return;
		}

		console.log('跟随模式：找到左侧滚动容器', leftContainer);

		// 处理滚动的函数
		let rafId: number | null = null;
		const handleScroll = () => {
			if (rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (this.isActive) {
					this.doSync();
				}
			});
		};

		// 绑定滚动事件
		leftContainer.addEventListener('scroll', handleScroll, { passive: true });
		
		// 清理函数
		this.scrollCleanup = () => {
			leftContainer.removeEventListener('scroll', handleScroll);
			if (rafId) cancelAnimationFrame(rafId);
		};
	}

	/**
	 * 获取 MarkdownView 的滚动容器
	 * 关键：根据当前模式返回正确的容器
	 */
	private getScrollContainer(view: MarkdownView): HTMLElement | null {
		try {
			const contentEl = view.contentEl;
			if (!contentEl) return null;

			// 获取当前视图状态
			const state = view.getState();
			const mode = state.mode;

			// 根据模式返回正确的滚动容器
			if (mode === 'preview') {
				// 阅读模式：使用 .markdown-preview-view
				const previewView = contentEl.querySelector('.markdown-preview-view');
				if (previewView instanceof HTMLElement) {
					return previewView;
				}
			} else {
				// 编辑/源码模式：使用 .cm-scroller
				const cmScroller = contentEl.querySelector('.cm-scroller');
				if (cmScroller instanceof HTMLElement) {
					return cmScroller;
				}
			}

			// 兜底：返回 .view-content
			const viewContent = contentEl.querySelector('.view-content');
			if (viewContent instanceof HTMLElement) {
				return viewContent;
			}

			return contentEl;
		} catch (error) {
			console.error('获取滚动容器失败:', error);
			return null;
		}
	}

	/**
	 * 执行同步
	 */
	private doSync(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		try {
			const leftView = this.leftLeaf.view;
			const rightView = this.rightLeaf.view;

			if (!(leftView instanceof MarkdownView) || !(rightView instanceof MarkdownView)) {
				return;
			}

			// 获取滚动容器
			const leftContainer = this.getScrollContainer(leftView);
			const rightContainer = this.getScrollContainer(rightView);

			if (!leftContainer || !rightContainer) {
				return;
			}

			// 获取左侧滚动信息
			const leftScrollTop = leftContainer.scrollTop;
			const leftHeight = leftContainer.clientHeight;

			// 计算右侧目标滚动位置：右侧顶部 = 左侧底部
			let targetScrollTop = leftScrollTop + leftHeight;

			// 确保不超出范围
			const rightMaxScroll = rightContainer.scrollHeight - rightContainer.clientHeight;
			if (targetScrollTop > rightMaxScroll) {
				targetScrollTop = rightMaxScroll;
			}
			if (targetScrollTop < 0) {
				targetScrollTop = 0;
			}

			// 应用到右侧
			rightContainer.scrollTop = targetScrollTop;

		} catch (error) {
			console.error('同步滚动失败:', error);
		}
	}

	/**
	 * 翻页 - 供快捷键使用
	 */
	pageScroll(direction: 'up' | 'down'): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

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

			// 确保不超出范围
			const maxScroll = leftContainer.scrollHeight - leftContainer.clientHeight;
			newScrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));

			// 应用到左侧，右侧会自动跟随
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
			if (container && !document.body.contains(container)) {
				return false;
			}
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
		if (this.scrollCleanup) {
			this.scrollCleanup();
			this.scrollCleanup = null;
		}

		if (this.layoutChangeRef) {
			this.layoutChangeRef();
			this.layoutChangeRef = null;
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
			if (view instanceof MarkdownView) {
				return view.file;
			}
		} catch (error) {
			// ignore
		}
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
				if (contentEl) {
					contentEl.setAttribute('data-follow-mode', 'true');
				}
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) {
				containerEl.setAttribute('data-follow-mode', 'true');
			}
		} catch (error) {
			// ignore
		}
	}

	/**
	 * 取消标记
	 */
	private unmarkFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const contentEl = view.contentEl;
				if (contentEl) {
					contentEl.removeAttribute('data-follow-mode');
				}
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) {
				containerEl.removeAttribute('data-follow-mode');
			}
		} catch (error) {
			// ignore
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
		} catch (error) {
			console.error('查找跟随窗口失败:', error);
		}
		return null;
	}
}
