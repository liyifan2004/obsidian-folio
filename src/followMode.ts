import { 
	WorkspaceLeaf, 
	TFile, 
	MarkdownView,
	Notice,
	Workspace
} from 'obsidian';

/**
 * 双栏跟随模式
 * 左侧：原生编辑器/预览（用户正常使用）
 * 右侧：只读预览，显示接续内容
 */
export class DualPaneFollowMode {
	private workspace: Workspace;
	private leftLeaf: WorkspaceLeaf | null = null;
	private rightLeaf: WorkspaceLeaf | null = null;
	private isActive: boolean = false;
	private leftScrollHandler: ((e: Event) => void) | null = null;
	
	// 使用 workspace 事件监听替代定时检查
	private unregisterLayoutChange: (() => void) | null = null;

	static readonly FOLLOW_LEAF_MARKER = 'dual-pane-follow-leaf';

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

		// 检查是否已经有该文件的跟随窗口
		const existingFollowLeaf = this.findExistingFollowLeaf(file);
		if (existingFollowLeaf && this.checkLeafValid(existingFollowLeaf)) {
			// 复用现有的右侧窗口
			this.rightLeaf = existingFollowLeaf;
			this.leftLeaf = activeLeaf;
			this.isActive = true;
			this.setupScrollSync();
			this.setupLayoutListener();
			this.syncScrollPosition();
			new Notice('双栏跟随模式已启动');
			return true;
		}

		this.leftLeaf = activeLeaf;

		try {
			// 在右侧分割创建新的 leaf
			this.rightLeaf = this.workspace.createLeafBySplit(activeLeaf, 'vertical', false);
			
			// 在右侧以预览模式打开同一个文件
			await this.rightLeaf.openFile(file, {
				state: { mode: 'preview' }
			});

			// 强制设置为预览模式
			await this.rightLeaf.setViewState({
				type: 'markdown',
				state: {
					file: file.path,
					mode: 'preview'
				}
			});

			this.markAsFollowLeaf(this.rightLeaf);
			
			this.isActive = true;
			
			// 延迟设置滚动同步，等待渲染完成
			setTimeout(() => {
				if (this.isActive) {
					this.setupScrollSync();
					this.setupLayoutListener();
					this.syncScrollPosition();
				}
			}, 500);

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
		if (!this.isActive) return;
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

		// 移除 layout 监听
		if (this.unregisterLayoutChange) {
			this.unregisterLayoutChange();
			this.unregisterLayoutChange = null;
		}

		// 取消标记
		if (this.rightLeaf) {
			this.unmarkAsFollowLeaf(this.rightLeaf);
		}

		// 注意：不关闭右侧窗口，让用户自己决定是否关闭
		// 如果需要自动关闭，取消下面注释
		// if (this.rightLeaf && this.checkLeafValid(this.rightLeaf)) {
		//     this.rightLeaf.detach();
		// }

		this.leftLeaf = null;
		this.rightLeaf = null;
		this.isActive = false;
	}

	/**
	 * 设置布局变化监听
	 * 使用 Obsidian 原生事件替代定时检查
	 */
	private setupLayoutListener(): void {
		// 监听 active-leaf-change 事件来检测窗口关闭
		const layoutChangeHandler = () => {
			if (!this.isActive) return;
			
			// 延迟检查，等待布局更新完成
			setTimeout(() => {
				if (!this.isActive) return;
				
				// 检查右侧 leaf 是否被关闭
				if (this.rightLeaf && !this.checkLeafValid(this.rightLeaf)) {
					this.cleanup();
					new Notice('双栏跟随模式已结束（右侧窗口已关闭）');
					return;
				}
				
				// 检查左侧 leaf 是否被关闭
				if (this.leftLeaf && !this.checkLeafValid(this.leftLeaf)) {
					this.cleanup();
					new Notice('双栏跟随模式已结束（左侧窗口已关闭）');
					return;
				}
			}, 100);
		};

		// 注册事件监听
		this.workspace.on('active-leaf-change', layoutChangeHandler);
		this.unregisterLayoutChange = () => {
			this.workspace.off('active-leaf-change', layoutChangeHandler);
		};
	}

	/**
	 * 检查 leaf 是否仍然有效（未被关闭）
	 */
	private checkLeafValid(leaf: WorkspaceLeaf): boolean {
		try {
			// 简单检查：leaf 是否有 view 属性且不为 null
			if (!leaf || !leaf.view) {
				return false;
			}
			
			// 检查 leaf 是否还在 DOM 中
			const container = (leaf as any).containerEl;
			if (container && !document.contains(container)) {
				return false;
			}
			
			return true;
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

		// 移除旧的监听器
		if (this.leftScrollHandler) {
			leftContainer.removeEventListener('scroll', this.leftScrollHandler);
		}

		// 创建新的滚动处理函数
		this.leftScrollHandler = (e: Event) => {
			// 使用 requestAnimationFrame 优化性能
			requestAnimationFrame(() => {
				this.syncScrollPosition();
			});
		};

		// 监听左侧滚动事件
		leftContainer.addEventListener('scroll', this.leftScrollHandler, { passive: true });

		console.log('跟随模式：滚动同步已设置');
	}

	/**
	 * 同步滚动位置
	 */
	private syncScrollPosition(): void {
		if (!this.leftLeaf || !this.rightLeaf) return;

		try {
			const leftContainer = this.getScrollContainer(this.leftLeaf);
			const rightContainer = this.getScrollContainer(this.rightLeaf);

			if (!leftContainer || !rightContainer) return;

			const leftScrollTop = leftContainer.scrollTop;
			const leftHeight = leftContainer.clientHeight;

			// 右栏顶部 = 左栏底部
			let targetScrollTop = leftScrollTop + leftHeight;

			// 确保不超过最大滚动范围
			const maxScrollTop = rightContainer.scrollHeight - rightContainer.clientHeight;
			if (targetScrollTop > maxScrollTop && maxScrollTop > 0) {
				targetScrollTop = maxScrollTop;
			}

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
			const contentEl = (view as any).contentEl;
			if (!contentEl) return null;

			// 尝试多个可能的容器
			const selectors = [
				'.view-content',
				'.markdown-preview-view',
				'.cm-scroller',
				'.markdown-source-view .cm-scroller',
				'.markdown-source-view'
			];

			for (const selector of selectors) {
				const el = contentEl.querySelector(selector);
				if (el instanceof HTMLElement) {
					return el;
				}
			}

			return contentEl;
		} catch (error) {
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
			// ignore
		}
		return null;
	}

	/**
	 * 标记 leaf 为跟随模式
	 */
	private markAsFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const view = leaf.view;
			const contentEl = (view as any).contentEl;
			if (contentEl) {
				contentEl.addClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
				contentEl.setAttribute('data-dual-pane-follow', 'true');
			}
		} catch (error) {
			// ignore
		}
	}

	/**
	 * 取消标记
	 */
	private unmarkAsFollowLeaf(leaf: WorkspaceLeaf): void {
		try {
			const view = leaf.view;
			const contentEl = (view as any).contentEl;
			if (contentEl) {
				contentEl.removeClass(DualPaneFollowMode.FOLLOW_LEAF_MARKER);
				contentEl.removeAttribute('data-dual-pane-follow');
			}
		} catch (error) {
			// ignore
		}
	}

	/**
	 * 查找已存在的跟随模式 leaf
	 */
	private findExistingFollowLeaf(file: TFile): WorkspaceLeaf | null {
		try {
			// 遍历所有 leaf 查找标记的
			const leaves = this.workspace.getLeavesOfType('markdown');
			
			for (const leaf of leaves) {
				const view = leaf.view;
				const contentEl = (view as any).contentEl;
				if (contentEl && contentEl.getAttribute('data-dual-pane-follow') === 'true') {
					const leafFile = this.getLeafFile(leaf);
					if (leafFile && leafFile.path === file.path) {
						return leaf;
					}
				}
			}
		} catch (error) {
			// ignore
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
