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
		modeList.createEl('li').innerHTML = '<strong>独立双栏视图</strong>：创建一个全新的双栏页面，左右两侧都是插件控制的视图。支持阅读、编辑、源码三种模式切换。';
		modeList.createEl('li').innerHTML = '<strong>跟随模式</strong>：保持左侧为 Obsidian 原生编辑器/预览，在右侧分割出一个原生视图显示接续内容。编辑体验与原生完全一致。';

		// 滚动同步设置
		new Setting(containerEl)
			.setName('默认启用滚动同步')
			.setDesc('打开双栏视图时是否默认启用内容接续显示（仅独立模式和跟随模式的阅读状态有效）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.scrollSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.scrollSyncEnabled = value;
					await this.plugin.saveSettings();
				}));

		// 翻页模式设置
		new Setting(containerEl)
			.setName('翻页模式')
			.setDesc('选择翻页时的行为（仅独立模式有效）')
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

		// 键盘同步
		new Setting(containerEl)
			.setName('启用键盘导航')
			.setDesc('是否启用 PageUp/PageDown/空格键翻页（需要在 Obsidian 快捷键设置中绑定）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncKeyboard)
				.onChange(async (value) => {
					this.plugin.settings.syncKeyboard = value;
					await this.plugin.saveSettings();
				}));

		// 自动刷新
		new Setting(containerEl)
			.setName('自动刷新')
			.setDesc('文件修改时是否自动刷新双栏视图内容（仅独立模式有效）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		// 使用说明
		containerEl.createEl('h3', { text: '使用说明', cls: 'setting-item-heading' });
		
		const desc = containerEl.createEl('div', { cls: 'setting-item-description' });
		desc.createEl('p', { text: '• Ctrl+P 打开命令面板，搜索"双栏视图"查看所有可用命令' });
		desc.createEl('p', { text: '• 独立双栏视图：适合专注阅读或简单编辑' });
		desc.createEl('p', { text: '• 跟随模式：适合需要完整 Obsidian 编辑功能的场景' });
		desc.createEl('p', { text: '• 在跟随模式下，左侧使用原生编辑器，所有快捷键和插件都正常工作' });
		desc.createEl('p', { text: '• 可以在 Obsidian 快捷键设置中为翻页命令绑定自定义快捷键' });
	}
}
