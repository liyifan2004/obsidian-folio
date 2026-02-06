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
 * 原理：
 * 1. 左侧保持用户当前使用的原生 Obsidian 编辑器/预览
 * 2. 在右侧分割创建一个新的 leaf，打开同一个文件
 * 3. 监听左侧的滚动事件，实时同步右侧的滚动位置
 * 4. 右侧显示接续的内容（左侧底部 = 右侧顶部）
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private scrollHandler: (() => void) | null = null;
	private resizeObserver: ResizeObserver | null = null;
	
	// 用于标记右侧是跟随模式的叶子
	private static FOLLOW_LEAF_ID = 'dual-pane-follow-leaf';

	constructor(workspace: Workspace) {
		this.workspace = workspace;
	}

	/**
	 * 检查是否处于跟随模式
	 */
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

		// 获取当前活动的文件
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

		// 检查是否已经有跟随模式的右侧窗口
		const existingFollowLeaf = this.findExistingFollowLeaf();
		if (existingFollowLeaf) {
			// 复用现有的右侧窗口
			this.rightLeaf = existingFollowLeaf;
			this.leftLeaf = activeLeaf;
			this.setupScrollSync();
			this.isActive = true;
			new Notice('双栏跟随模式已启动');
			return true;
		}

		// 保存左侧 leaf 引用
		this.leftLeaf = activeLeaf;

		try {
			// 在右侧分割创建新的 leaf
			this.rightLeaf = this.workspace.createLeafBySplit(activeLeaf, 'vertical', false);
			
			// 在右侧打开同一个文件
			await this.rightLeaf.openFile(file, {
				state: { mode: 'preview' } // 右侧默认使用阅读模式
			});

			// 标记右侧 leaf 为跟随模式
			this.markAsFollowLeaf(this.rightLeaf);

			// 设置滚动同步
			this.setupScrollSync();

			this.isActive = true;
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
	 * 停止跟随模式
	 */
	stopFollowMode(): void {
		if (!this.isActive) {
			return;
		}

		this.cleanup();
		new Notice('双栏跟随模式已停止');
	}

	/**
	 * 清理资源
	 */
	private cleanup(): void {
		// 移除滚动监听
		if (this.scrollHandler && this.leftLeaf) {
			const scrollContainer = this.getScrollContainer(this.leftLeaf);
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', this.scrollHandler);
			}
		}
		this.scrollHandler = null;

		// 断开 ResizeObserver
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		// 取消标记右侧 leaf
		if (this.rightLeaf) {
			this.unmarkAsFollowLeaf(this.rightLeaf);
		}

		// 可选：关闭右侧 leaf（如果用户想保留，可以注释掉）
		// if (this.rightLeaf && !this.rightLeaf.getViewState()?.pinned) {
		//     this.rightLeaf.detach();
		// }

		this.leftLeaf = null;
		this.rightLeaf = null;
		this.isActive = false;
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		const leftContainer = this.getScrollContainer(this.leftLeaf);
		const rightContainer = this.getScrollContainer(this.rightLeaf);

		if (!leftContainer || !rightContainer) return;

		// 创建滚动处理函数
		this.scrollHandler = () => {
			this.syncScrollPosition(leftContainer, rightContainer);
		};

		// 监听左侧滚动事件
		leftContainer.addEventListener('scroll', this.scrollHandler);

		// 初始同步一次
		this.syncScrollPosition(leftContainer, rightContainer);

		// 监听窗口大小变化，重新同步
		this.resizeObserver = new ResizeObserver(() => {
			this.syncScrollPosition(leftContainer, rightContainer);
		});
		this.resizeObserver.observe(leftContainer);
		this.resizeObserver.observe(rightContainer);
	}

	/**
	 * 同步滚动位置
	 * 核心逻辑：右侧顶部 = 左侧底部
	 */
	private syncScrollPosition(leftContainer: HTMLElement, rightContainer: HTMLElement): void {
		const leftScrollTop = leftContainer.scrollTop;
		const leftHeight = leftContainer.clientHeight;
		const rightScrollHeight = rightContainer.scrollHeight;
		const rightHeight = rightContainer.clientHeight;

		// 计算右侧应该滚动到的位置
		// 右侧顶部应该显示左侧底部的内容
		let targetScrollTop = leftScrollTop + leftHeight;

		// 确保不超过右侧的最大滚动范围
		const maxScrollTop = rightScrollHeight - rightHeight;
		if (targetScrollTop > maxScrollTop) {
			targetScrollTop = maxScrollTop;
		}

		// 应用滚动位置
		rightContainer.scrollTop = targetScrollTop;
	}

	/**
	 * 获取 leaf 的滚动容器
	 */
	private getScrollContainer(leaf: WorkspaceLeaf): HTMLElement | null {
		// 尝试获取 MarkdownView 的滚动容器
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			// MarkdownView 的预览和编辑模式都有不同的容器
			// 尝试获取 contentEl 中的可滚动元素
			const contentEl = view.contentEl;
			if (contentEl) {
				// 查找 .markdown-preview-view 或 .cm-scroller
				const previewContainer = contentEl.querySelector('.markdown-preview-view');
				if (previewContainer instanceof HTMLElement) {
					return previewContainer;
				}
				
				const editorContainer = contentEl.querySelector('.cm-scroller');
				if (editorContainer instanceof HTMLElement) {
					return editorContainer;
				}
				
				// 兜底：返回 contentEl 本身
				return contentEl;
			}
		}

		// 尝试获取 view 的 containerEl
		const containerEl = (leaf as any).containerEl || (leaf.view as any).containerEl;
		if (containerEl instanceof HTMLElement) {
			return containerEl;
		}

		return null;
	}

	/**
	 * 获取 leaf 对应的文件
	 */
	private getLeafFile(leaf: WorkspaceLeaf): TFile | null {
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			return view.file;
		}
		return null;
	}

	/**
	 * 标记 leaf 为跟随模式
	 */
	private markAsFollowLeaf(leaf: WorkspaceLeaf): void {
		const container = this.getLeafContainer(leaf);
		if (container) {
			container.addClass('dual-pane-follow-leaf');
			container.setAttribute('data-dual-pane-follow', 'true');
		}
	}

	/**
	 * 取消标记
	 */
	private unmarkAsFollowLeaf(leaf: WorkspaceLeaf): void {
		const container = this.getLeafContainer(leaf);
		if (container) {
			container.removeClass('dual-pane-follow-leaf');
			container.removeAttribute('data-dual-pane-follow');
		}
	}

	/**
	 * 查找已存在的跟随模式 leaf
	 */
	private findExistingFollowLeaf(): WorkspaceLeaf | null {
		// 遍历 workspace 的所有 root 来查找 leaves
		const root = (this.workspace as any).root;
		if (!root) return null;
		
		const leaves: WorkspaceLeaf[] = [];
		this.collectLeaves(root, leaves);
		
		for (const leaf of leaves) {
			const container = this.getLeafContainer(leaf);
			if (container && container.getAttribute('data-dual-pane-follow') === 'true') {
				return leaf;
			}
		}
		return null;
	}

	/**
	 * 递归收集所有 leaves
	 */
	private collectLeaves(node: any, leaves: WorkspaceLeaf[]): void {
		if (!node) return;
		
		if (node.type === 'leaf') {
			leaves.push(node);
		} else if (node.children) {
			for (const child of node.children) {
				this.collectLeaves(child, leaves);
			}
		}
	}

	/**
	 * 获取 leaf 的容器元素
	 */
	private getLeafContainer(leaf: WorkspaceLeaf): HTMLElement | null {
		return (leaf as any).containerEl || null;
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
