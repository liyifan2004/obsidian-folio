import { 
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	Workspace,
	ItemView
} from 'obsidian';

/**
 * 双栏跟随模式
 * 
 * 核心原理：
 * 1. 左侧保持用户当前的 MarkdownView（编辑或预览模式）
 * 2. 右侧创建一个新的 MarkdownView，强制为预览模式
 * 3. 监听左侧的滚动事件，计算滚动比例，同步到右侧
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private scrollListener: (() => void) | null = null;
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
		// 如果已经在跟随模式，先停止
		if (this.isActive) {
			this.stopFollowMode();
		}

		// 获取当前活动的 leaf
		const activeLeaf = this.workspace.getMostRecentLeaf();
		if (!activeLeaf) {
			new Notice('请先打开一个文件');
			return false;
		}

		// 检查当前是否是 MarkdownView
		const file = this.getLeafFile(activeLeaf);
		if (!file) {
			new Notice('当前视图不支持双栏跟随模式，请先打开一个 Markdown 文件');
			return false;
		}

		// 检查是否已经有该文件的跟随窗口
		const existingRight = this.findFollowLeaf(file);
		if (existingRight && existingRight !== activeLeaf) {
			// 复用现有的右侧窗口
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
			
			// 等待分割完成
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// 在右侧打开同一个文件，强制为预览模式
			await this.rightLeaf.openFile(file, {
				state: { mode: 'preview' },
				active: true
			});

			// 等待视图加载
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
			new Notice('启动跟随模式失败: ' + error.message);
			this.cleanup();
			return false;
		}
	}

	/**
	 * 设置跟随
	 */
	private setupFollow(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		// 等待视图完全加载后再设置滚动监听
		setTimeout(() => {
			if (!this.isActive) return;
			
			this.setupScrollSync();
			this.setupLayoutListener();
			
			// 初始同步一次
			this.doSync();
		}, 500);
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		if (!this.leftLeaf) return;

		const leftView = this.leftLeaf.view;
		if (!(leftView instanceof MarkdownView)) return;

		// 获取左侧的滚动容器
		const leftContainer = this.getMarkdownViewScroller(leftView);
		if (!leftContainer) {
			console.warn('无法获取左侧滚动容器');
			return;
		}

		console.log('设置滚动同步，容器:', leftContainer);

		// 使用防抖的滚动处理器
		let syncPending = false;
		const handleScroll = () => {
			if (syncPending) return;
			syncPending = true;
			requestAnimationFrame(() => {
				syncPending = false;
				if (this.isActive) {
					this.doSync();
				}
			});
		};

		// 绑定滚动事件
		leftContainer.addEventListener('scroll', handleScroll, { passive: true });
		this.scrollListener = () => {
			leftContainer.removeEventListener('scroll', handleScroll);
		};
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
			const leftContainer = this.getMarkdownViewScroller(leftView);
			const rightContainer = this.getMarkdownViewScroller(rightView);

			if (!leftContainer || !rightContainer) {
				return;
			}

			// 获取左侧滚动信息
			const leftScrollTop = leftContainer.scrollTop;
			const leftHeight = leftContainer.clientHeight;
			const leftScrollHeight = leftContainer.scrollHeight;

			// 计算右侧目标滚动位置
			// 右侧顶部 = 左侧底部
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
	 * 获取 MarkdownView 的滚动容器
	 */
	private getMarkdownViewScroller(view: MarkdownView): HTMLElement | null {
		try {
			// 获取 contentEl
			const contentEl = view.contentEl;
			if (!contentEl) return null;

			// 方法1：直接查找 .view-content
			const viewContent = contentEl.querySelector('.view-content');
			if (viewContent instanceof HTMLElement) {
				return viewContent;
			}

			// 方法2：查找 .markdown-preview-view
			const previewView = contentEl.querySelector('.markdown-preview-view');
			if (previewView instanceof HTMLElement) {
				return previewView;
			}

			// 方法3：查找 CodeMirror 的 scroller
			const cmScroller = contentEl.querySelector('.cm-scroller');
			if (cmScroller instanceof HTMLElement) {
				return cmScroller;
			}

			// 方法4：返回 contentEl 本身
			return contentEl;
		} catch (error) {
			console.error('获取滚动容器失败:', error);
			return null;
		}
	}

	/**
	 * 设置布局监听
	 */
	private setupLayoutListener(): void {
		// 监听布局变化，检测窗口关闭
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

		// 检查左侧是否有效
		if (this.leftLeaf && !this.isLeafValid(this.leftLeaf)) {
			this.stopFollowMode();
			new Notice('双栏跟随模式已结束（左侧窗口已关闭）');
			return;
		}

		// 检查右侧是否有效
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
			// 检查 view 是否存在
			if (!leaf.view) return false;
			
			// 检查是否在 DOM 中
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
		// 移除滚动监听
		if (this.scrollListener) {
			this.scrollListener();
			this.scrollListener = null;
		}

		// 移除布局监听
		if (this.layoutChangeRef) {
			this.layoutChangeRef();
			this.layoutChangeRef = null;
		}

		// 取消标记
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
					contentEl.addClass('dual-pane-follow-right');
					contentEl.setAttribute('data-follow-mode', 'true');
				}
			}
			// 也在 containerEl 上标记
			const containerEl = (leaf as any).containerEl;
			if (containerEl) {
				containerEl.addClass('dual-pane-follow-right');
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
					contentEl.removeClass('dual-pane-follow-right');
					contentEl.removeAttribute('data-follow-mode');
				}
			}
			const containerEl = (leaf as any).containerEl;
			if (containerEl) {
				containerEl.removeClass('dual-pane-follow-right');
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
			// 获取所有 markdown 类型的 leaf
			const leaves = this.workspace.getLeavesOfType('markdown');
			
			for (const leaf of leaves) {
				const view = leaf.view;
				if (!(view instanceof MarkdownView)) continue;
				
				// 检查是否标记为跟随窗口
				const contentEl = view.contentEl;
				const isMarked = contentEl?.getAttribute('data-follow-mode') === 'true';
				
				if (isMarked) {
					// 检查是否是同一个文件
					if (view.file && view.file.path === file.path) {
						return leaf;
					}
				}
			}
		} catch (error) {
			console.error('查找跟随窗口失败:', error);
		}
		return null;
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
}
