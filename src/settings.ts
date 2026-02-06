import { App, PluginSettingTab, Setting } from 'obsidian';
import DualPaneSyncPlugin from '../main';

export class DualPaneSettingTab extends PluginSettingTab {
	plugin: DualPaneSyncPlugin;

	constructor(app: App, plugin: DualPaneSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '双栏同步阅读设置' });

		// ==================== 功能说明 ====================
		containerEl.createEl('h3', { 
			text: '📖 功能说明', 
			cls: 'setting-item-heading' 
		});

		const descEl = containerEl.createEl('div', { cls: 'setting-item-description' });
		descEl.innerHTML = `
			<p><strong>双栏同步阅读</strong>提供一种全新的阅读体验：</p>
			<ul>
				<li><strong>左侧窗口</strong>：Obsidian 原生编辑器/预览，可正常编辑使用</li>
				<li><strong>右侧窗口</strong>：自动分割显示，接续左侧内容</li>
				<li><strong>双向滚动</strong>：左右两侧滚动时互相跟随，保持内容接续</li>
				<li><strong>模式自适应</strong>：左侧切换编辑/预览模式时，右侧自动适应</li>
			</ul>
		`;

		// ==================== 快捷键设置说明 ====================
		containerEl.createEl('h3', { 
			text: '⌨️ 快捷键设置', 
			cls: 'setting-item-heading' 
		});

		const hotkeyInfo = containerEl.createEl('div', { 
			cls: 'setting-item',
			attr: { style: 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin: 16px 0;' }
		});
		
		hotkeyInfo.innerHTML = `
			<p style="margin: 0 0 12px 0; font-weight: 600;">如何设置快捷键？</p>
			<p style="margin: 0 0 8px 0;">请在 Obsidian 设置中配置快捷键：</p>
			<ol style="margin: 8px 0; padding-left: 20px;">
				<li>打开 <strong>设置 → 快捷键</strong></li>
				<li>搜索 "跟随模式"</li>
				<li>为以下命令绑定你喜欢的快捷键：</li>
			</ol>
			<ul style="margin: 8px 0; padding-left: 20px; color: var(--text-muted);">
				<li>启动跟随模式 / 停止跟随模式</li>
				<li>跟随模式: 上一页 / 下一页</li>
				<li>跟随模式: 连翻两页（上）/ 连翻两页（下）</li>
			</ul>
			<p style="margin: 12px 0 0 0; font-size: 0.9em; color: var(--text-accent);">
				💡 推荐设置：PageUp/PageDown 或 Ctrl+↑/Ctrl+↓
			</p>
		`;

		// ==================== 重合行数设置 ====================
		containerEl.createEl('h3', { 
			text: '⚙️ 显示设置', 
			cls: 'setting-item-heading' 
		});

		new Setting(containerEl)
			.setName('重合行数')
			.setDesc('设置左右两栏重合显示的行数。如果工具栏遮挡内容，请增加此值（推荐 2-3 行）')
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(this.plugin.settings.overlapLines)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.overlapLines = value;
					await this.plugin.saveSettings();
				})
			);

		// ==================== 使用提示 ====================
		containerEl.createEl('h3', { 
			text: '💡 使用提示', 
			cls: 'setting-item-heading' 
		});

		const tipsEl = containerEl.createEl('div', { cls: 'setting-item-description' });
		tipsEl.innerHTML = `
			<ul>
				<li>点击左侧功能区 <strong>📑 图标</strong> 启动/停止跟随模式</li>
				<li>左侧可正常编辑，所有 Obsidian 功能完全可用</li>
				<li>左右两侧滚动时会<strong>自动互相跟随</strong></li>
				<li>左侧切换编辑/预览模式时，跟随不会中断</li>
				<li>关闭右侧标签页即可退出跟随模式</li>
			</ul>
		`;
	}
}
