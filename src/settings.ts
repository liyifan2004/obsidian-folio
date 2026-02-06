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

		// 模式说明
		containerEl.createEl('h3', { text: '双栏模式说明', cls: 'setting-item-heading' });
		
		const modeDesc = containerEl.createEl('div', { cls: 'setting-item-description' });
		modeDesc.createEl('p', { text: '本插件提供两种双栏模式：', cls: 'setting-item' });
		
		const modeList = modeDesc.createEl('ul');
		modeList.createEl('li').innerHTML = '<strong>独立双栏视图</strong>：创建一个全新的双栏页面，左侧可编辑，右侧只读显示接续内容。';
		modeList.createEl('li').innerHTML = '<strong>跟随模式</strong>：保持左侧为 Obsidian 原生编辑器/预览，在右侧分割出一个原生预览视图显示接续内容。';

		// 重合行数设置
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

		// 滚动同步设置
		new Setting(containerEl)
			.setName('默认启用滚动同步')
			.setDesc('打开双栏视图时是否默认启用内容接续显示')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.scrollSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.scrollSyncEnabled = value;
					await this.plugin.saveSettings();
				}));

		// 翻页模式设置
		new Setting(containerEl)
			.setName('翻页模式')
			.setDesc('选择翻页时的行为（仅独立双栏视图有效）')
			.addDropdown(dropdown => dropdown
				.addOption('single', '单栏翻页（右侧内容移到左侧）')
				.addOption('both', '双栏翻页（跳过一整屏内容）')
				.setValue(this.plugin.settings.pageScrollMode)
				.onChange(async (value) => {
					this.plugin.settings.pageScrollMode = value as 'single' | 'both';
					await this.plugin.saveSettings();
				}));

		// 显示工具栏
		new Setting(containerEl)
			.setName('显示工具栏')
			.setDesc('是否在独立双栏视图中显示顶部工具栏')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbar)
				.onChange(async (value) => {
					this.plugin.settings.showToolbar = value;
					await this.plugin.saveSettings();
				}));

		// 自动刷新
		new Setting(containerEl)
			.setName('自动刷新')
			.setDesc('文件修改时是否自动刷新双栏视图内容（仅独立双栏视图有效）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		// 使用说明
		containerEl.createEl('h3', { text: '使用说明', cls: 'setting-item-heading' });
		
		const desc = containerEl.createEl('div', { cls: 'setting-item-description' });
		desc.createEl('p', { text: '• 点击左侧功能区 📑 图标，弹出菜单选择模式' });
		desc.createEl('p', { text: '• 跟随模式：左侧完全原生，右侧自动跟随滚动' });
		desc.createEl('p', { text: '• 独立双栏视图：适合专注阅读，左侧可编辑右侧只读' });
		desc.createEl('p', { text: '• 如果工具栏遮挡内容，请增加"重合行数"设置' });
	}
}
