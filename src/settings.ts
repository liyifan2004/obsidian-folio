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

		// 显示工具栏
		new Setting(containerEl)
			.setName('显示工具栏')
			.setDesc('是否在双栏视图中显示顶部工具栏（包含模式切换和翻页按钮）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbar)
				.onChange(async (value) => {
					this.plugin.settings.showToolbar = value;
					await this.plugin.saveSettings();
				}));

		// 键盘同步
		new Setting(containerEl)
			.setName('启用键盘导航')
			.setDesc('是否启用 PageUp/PageDown/空格键翻页')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncKeyboard)
				.onChange(async (value) => {
					this.plugin.settings.syncKeyboard = value;
					await this.plugin.saveSettings();
				}));

		// 自动刷新
		new Setting(containerEl)
			.setName('自动刷新')
			.setDesc('文件修改时是否自动刷新双栏视图内容')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		// 使用说明
		containerEl.createEl('h3', { text: '使用说明', cls: 'setting-item-heading' });
		
		const desc = containerEl.createEl('div', { cls: 'setting-item-description' });
		desc.createEl('p', { text: '• 点击左侧功能区 📑 图标或 Ctrl+P 打开双栏视图' });
		desc.createEl('p', { text: '• 双栏视图会在主窗口的标签页中打开' });
		desc.createEl('p', { text: '• 左栏显示内容的前半部分，右栏自动接续显示' });
		desc.createEl('p', { text: '• 翻页时内容无缝衔接，无重复无遗漏' });
		desc.createEl('p', { text: '• 支持阅读、编辑、源码三种模式切换' });
	}
}
