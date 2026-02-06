import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
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

		// ==================== 通用设置 ====================
		containerEl.createEl('h3', { 
			text: '🌐 通用设置', 
			cls: 'setting-item-heading' 
		});

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

		// ==================== 独立双栏视图设置 ====================
		containerEl.createEl('h3', { 
			text: '📖 独立双栏视图设置（仅阅读模式）', 
			cls: 'setting-item-heading' 
		});

		// 滚动同步设置
		new Setting(containerEl)
			.setName('启用滚动同步')
			.setDesc('左右两栏是否同步滚动')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.scrollSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.scrollSyncEnabled = value;
					await this.plugin.saveSettings();
				}));

		// 翻页模式设置
		new Setting(containerEl)
			.setName('翻页模式')
			.setDesc('选择翻页时的行为')
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
			.setDesc('是否显示顶部工具栏（包含翻页按钮）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbar)
				.onChange(async (value) => {
					this.plugin.settings.showToolbar = value;
					await this.plugin.saveSettings();
				}));

		// 自动刷新
		new Setting(containerEl)
			.setName('自动刷新')
			.setDesc('文件修改时是否自动刷新内容')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		// ==================== 跟随模式设置 ====================
		containerEl.createEl('h3', { 
			text: '🔄 跟随模式设置（可编辑模式）', 
			cls: 'setting-item-heading' 
		});

		// 快捷键说明
		const hotkeyDesc = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			text: '设置跟随模式下的翻页快捷键。点击输入框后按下想要的快捷键组合。支持 Ctrl/Cmd、Alt、Shift 修饰键。'
		});
		hotkeyDesc.style.marginBottom = '20px';

		// 上一页快捷键
		this.createHotkeySetting(
			containerEl,
			'上一页快捷键',
			'向上翻一页',
			this.plugin.settings.followModeHotkeys.pageUp,
			async (value) => {
				this.plugin.settings.followModeHotkeys.pageUp = value;
				await this.plugin.saveSettings();
			}
		);

		// 下一页快捷键
		this.createHotkeySetting(
			containerEl,
			'下一页快捷键',
			'向下翻一页',
			this.plugin.settings.followModeHotkeys.pageDown,
			async (value) => {
				this.plugin.settings.followModeHotkeys.pageDown = value;
				await this.plugin.saveSettings();
			}
		);

		// 连翻两页-上快捷键
		this.createHotkeySetting(
			containerEl,
			'连翻两页-上',
			'快速向上翻两页',
			this.plugin.settings.followModeHotkeys.doublePageUp,
			async (value) => {
				this.plugin.settings.followModeHotkeys.doublePageUp = value;
				await this.plugin.saveSettings();
			}
		);

		// 连翻两页-下快捷键
		this.createHotkeySetting(
			containerEl,
			'连翻两页-下',
			'快速向下翻两页',
			this.plugin.settings.followModeHotkeys.doublePageDown,
			async (value) => {
				this.plugin.settings.followModeHotkeys.doublePageDown = value;
				await this.plugin.saveSettings();
			}
		);

		// ==================== 使用说明 ====================
		containerEl.createEl('h3', { 
			text: '💡 使用说明', 
			cls: 'setting-item-heading' 
		});
		
		const desc = containerEl.createEl('div', { cls: 'setting-item-description' });
		desc.createEl('p', { text: '• 点击左侧功能区 📑 图标，弹出菜单选择模式' });
		desc.createEl('p', { text: '• 跟随模式：左侧可编辑（完全原生），右侧自动跟随滚动' });
		desc.createEl('p', { text: '• 独立双栏视图：纯阅读模式，支持翻页按钮' });
		desc.createEl('p', { text: '• 如果工具栏遮挡内容，请增加"重合行数"设置' });
		desc.createEl('p', { text: '• 快捷键在跟随模式下生效，可快速翻页' });
	}

	/**
	 * 创建快捷键设置项
	 */
	createHotkeySetting(
		container: HTMLElement,
		name: string,
		desc: string,
		currentValue: string,
		onChange: (value: string) => Promise<void>
	): void {
		const setting = new Setting(container)
			.setName(name)
			.setDesc(desc);

		// 创建输入框
		const input = document.createElement('input');
		input.type = 'text';
		input.value = currentValue || '未设置';
		input.readOnly = true;
		input.style.width = '200px';
		input.style.padding = '5px 10px';
		input.style.border = '1px solid var(--background-modifier-border)';
		input.style.borderRadius = '4px';
		input.style.background = 'var(--background-primary)';
		input.style.cursor = 'pointer';
		input.style.textAlign = 'center';

		// 点击输入框开始捕获快捷键
		let capturing = false;
		
		input.addEventListener('click', () => {
			if (capturing) return;
			capturing = true;
			input.value = '按下快捷键...';
			input.style.borderColor = 'var(--interactive-accent)';
			
			const captureHandler = (e: KeyboardEvent) => {
				e.preventDefault();
				e.stopPropagation();
				
				// 忽略单独的修饰键
				if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
					return;
				}
				
				// 构建快捷键字符串
				const parts: string[] = [];
				if (e.ctrlKey) parts.push('Ctrl');
				if (e.metaKey) parts.push('Cmd');
				if (e.altKey) parts.push('Alt');
				if (e.shiftKey) parts.push('Shift');
				parts.push(e.key);
				
				const hotkey = parts.join('+');
				input.value = hotkey;
				input.style.borderColor = 'var(--background-modifier-border)';
				capturing = false;
				
				document.removeEventListener('keydown', captureHandler, true);
				onChange(hotkey);
			};
			
			document.addEventListener('keydown', captureHandler, true);
			
			// 5秒后自动取消
			setTimeout(() => {
				if (capturing) {
					capturing = false;
					input.value = currentValue || '未设置';
					input.style.borderColor = 'var(--background-modifier-border)';
					document.removeEventListener('keydown', captureHandler, true);
				}
			}, 5000);
		});

		// 清除按钮
		const clearBtn = document.createElement('button');
		clearBtn.textContent = '清除';
		clearBtn.style.marginLeft = '8px';
		clearBtn.addEventListener('click', () => {
			input.value = '未设置';
			onChange('');
		});

		setting.controlEl.appendChild(input);
		setting.controlEl.appendChild(clearBtn);
	}
}
