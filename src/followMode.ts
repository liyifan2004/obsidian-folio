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
 * 左侧：用户当前的原生编辑器/预览（完全原生，可编辑）
 * 右侧：只读预览，显示接续内容（左侧底部 = 右侧顶部）
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private leftScrollHandler: ((e: Event) => void) | null = null;
	private checkInterval: number | null = null;
	private file: TFile | null = null;
	
	// 用于标记右侧是跟随模式的叶子
	static readonly FOLLOW_LEAF_MARKER = 'dual-pane-follow-leaf';

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

		// 获取当前活动的 leaf
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

		this.file = file;

		// 检查是否已经有跟随模式的右侧窗口
		const existingFollowLeaf = this.findExistingFollowLeaf(file);
		if (existingFollowLeaf) {
			this.rightLeaf = existingFollowLeaf;
			this.leftLeaf = activeLeaf;
			this.setupScrollSync();
			this.startAutoCheck();
			this.isActive = true;
			new Notice('双栏跟随模式已启动');
			return true;
		}

		// 保存左侧 leaf 引用
		this.leftLeaf = activeLeaf;

		try {
			// 在右侧分割创建新的 leaf
			this.rightLeaf = this.workspace.createLeafBySplit(activeLeaf, 'vertical', false);
			
			// 在右侧以预览模式打开同一个文件
			// 关键：使用 getViewState 和 setViewState 确保是预览模式
			await this.rightLeaf.openFile(file);
			
			// 强制设置为预览模式（只读）
			await this.rightLeaf.setViewState({
				type: 'markdown',
				state: {
					file: file.path,
					mode: 'preview'  // 强制预览模式
				}
			});

			// 标记右侧 leaf 为跟随模式
			this.markAsFollowLeaf(this.rightLeaf);

			// 等待视图加载完成后设置滚动同步
			setTimeout(() => {
				this.setupScrollSync();
				// 初始同步一次
				this.syncScrollPosition();
			}, 300);

			// 启动自动检测
			this.startAutoCheck();

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
		if (this.leftScrollHandler && this.leftLeaf) {
			const leftContainer = this.getScrollContainer(this.leftLeaf);
			if (leftContainer) {
				leftContainer.removeEventListener('scroll', this.leftScrollHandler);
			}
		}
		this.leftScrollHandler = null;

		// 清除自动检测定时器
		if (this.checkInterval) {
			window.clearInterval(this.checkInterval);
			this.checkInterval = null;
		}

		// 取消标记右侧 leaf
		if (this.rightLeaf) {
			this.unmarkAsFollowLeaf(this.rightLeaf);
		}

		this.leftLeaf = null;
		this.rightLeaf = null;
		this.file = null;
		this.isActive = false;
	}

	/**
	 * 启动自动检测
	 */
	private startAutoCheck(): void {
		this.checkInterval = window.setInterval(() => {
			if (!this.isActive) return;

			// 检查右侧 leaf 是否仍然存在
			if (this.rightLeaf && !this.checkLeafExists(this.rightLeaf)) {
				this.cleanup();
				new Notice('双栏跟随模式已结束（右侧窗口已关闭）');
				return;
			}

			// 检查左侧 leaf 是否仍然存在
			if (this.leftLeaf && !this.checkLeafExists(this.leftLeaf)) {
				this.cleanup();
				new Notice('双栏跟随模式已结束（左侧窗口已关闭）');
				return;
			}
		}, 500);
	}

	/**
	 * 检查 leaf 是否仍然存在
	 */
	private checkLeafExists(leaf: WorkspaceLeaf): boolean {
		try {
			const leaves: WorkspaceLeaf[] = [];
			this.collectLeaves((this.workspace as any).root, leaves);
			return leaves.includes(leaf);
		} catch (e) {
			return false;
		}
	}

	/**
	 * 设置滚动同步
	 */
	private setupScrollSync(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		const leftContainer = this.getScrollContainer(this.leftLeaf);

		if (!leftContainer) {
			console.warn('无法获取左侧滚动容器');
			return;
		}

		// 创建滚动处理函数
		this.leftScrollHandler = (e: Event) => {
			this.syncScrollPosition();
		};

		// 监听左侧滚动事件
		leftContainer.addEventListener('scroll', this.leftScrollHandler, { passive: true });

		console.log('滚动同步已设置');
	}

	/**
	 * 同步滚动位置
	 * 核心逻辑：右侧顶部 = 左侧底部
	 */
	private syncScrollPosition(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		try {
			const leftContainer = this.getScrollContainer(this.leftLeaf);
			const rightContainer = this.getScrollContainer(this.rightLeaf);

			if (!leftContainer || !rightContainer) {
				console.warn('无法获取滚动容器');
				return;
			}

			const leftScrollTop = leftContainer.scrollTop;
			const leftHeight = leftContainer.clientHeight;

			// 计算右侧应该滚动到的位置
			let targetScrollTop = leftScrollTop + leftHeight;

			// 确保不超过右侧的最大滚动范围
			const maxScrollTop = rightContainer.scrollHeight - rightContainer.clientHeight;
			if (targetScrollTop > maxScrollTop && maxScrollTop > 0) {
				targetScrollTop = maxScrollTop;
			}

			// 应用滚动位置
			rightContainer.scrollTop = targetScrollTop;
		} catch (error) {
			console.error('同步滚动位置失败:', error);
		}
	}

	/**
	 * 获取 leaf 的滚动容器
	 */
	private getScrollContainer(leaf: WorkspaceLeaf): HTMLElement | null {
		try {
			const view = leaf.view;
			
			// 获取 view 的 contentEl
			const contentEl = (view as any).contentEl;
			if (!contentEl) return null;

			// 优先查找 .view-content 作为滚动容器
			const viewContent = contentEl.querySelector('.view-content');
			if (viewContent instanceof HTMLElement) {
				return viewContent;
			}

			// 查找 .markdown-preview-view（阅读模式）
			const previewContainer = contentEl.querySelector('.markdown-preview-view');
			if (previewContainer instanceof HTMLElement) {
				return previewContainer;
			}
			
			// 查找 .cm-scroller（编辑模式 CodeMirror 6）
			const editorContainer = contentEl.querySelector('.cm-scroller');
			if (editorContainer instanceof HTMLElement) {
				return editorContainer;
			}
			
			// 查找 .markdown-source-view（源码模式）
			const sourceContainer = contentEl.querySelector('.markdown-source-view .cm-scroller') 
				|| contentEl.querySelector('.markdown-source-view');
			if (sourceContainer instanceof HTMLElement) {
				return sourceContainer;
			}
			
			// 兜底：返回 contentEl 本身
			return contentEl;
		} catch (error) {
			console.error('获取滚动容器失败:', error);
			return null;
		}
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
			if ((view as any).file instanceof TFile) {
				return (view as any).file;
			}
		} catch (error) {
			console.error('获取 leaf 文件失败:', error);
		}
		return null;
	}

	/**
	 * 标记 leaf 为跟随模式
	 */
	private markAsFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const container = this.getLeafContainer(leaf);
			if (container) {
				container.addClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
				container.setAttribute('data-dual-pane-follow', 'true');
			}
			// 同时在 view-content 上添加标记
			const view = leaf.view;
			const contentEl = (view as any).contentEl;
			if (contentEl) {
				contentEl.addClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
			}
		} catch (error) {
			console.error('标记跟随 leaf 失败:', error);
		}
	}

	/**
	 * 取消标记
	 */
	private unmarkAsFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const container = this.getLeafContainer(leaf);
			if (container) {
				container.removeClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
				container.removeAttribute('data-dual-pane-follow');
			}
			const view = leaf.view;
			const contentEl = (view as any).contentEl;
			if (contentEl) {
				contentEl.removeClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
			}
		} catch (error) {
			console.error('取消标记跟随 leaf 失败:', error);
		}
	}

	/**
	 * 查找已存在的跟随模式 leaf
	 */
	private findExistingFollowLeaf(file: TFile): WorkspaceLeaf | null {
		try {
			const leaves: WorkspaceLeaf[] = [];
			this.collectLeaves((this.workspace as any).root, leaves);
			
			for (const leaf of leaves) {
				const container = this.getLeafContainer(leaf);
				if (container && container.getAttribute('data-dual-pane-follow') === 'true') {
					// 检查是否是同一个文件
					const leafFile = this.getLeafFile(leaf);
					if (leafFile && leafFile.path === file.path) {
						return leaf;
					}
				}
			}
		} catch (error) {
			console.error('查找已存在的跟随 leaf 失败:', error);
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
		try {
			return (leaf as any).containerEl || null;
		} catch (error) {
			return null;
		}
	}
}
