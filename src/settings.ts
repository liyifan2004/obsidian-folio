import { App, PluginSettingTab, Setting, SliderComponent } from 'obsidian';
import DualPaneSyncPlugin from '../main';
import { t } from './types';

export class DualPaneSettingTab extends PluginSettingTab {
	plugin: DualPaneSyncPlugin;

	constructor(app: App, plugin: DualPaneSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ========== 标题 ==========
		containerEl.createEl('h2', { text: t('ribbonTooltip') });

		// ========== 重叠行数设置 ==========
		new Setting(containerEl)
			.setName(t('settingOverlap'))
			.setDesc(t('settingOverlapDesc'))
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(0, 10, 1)
					.setValue(this.plugin.settings.overlapLines)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.overlapLines = value;
						await this.plugin.saveSettings();
					});
			});

		// ========== 快捷键设置说明 ==========
		new Setting(containerEl)
			.setName(t('settingHotkeys'))
			.setDesc(t('settingHotkeysDesc'))
			.setHeading();

		// ========== 命令列表 ==========
		const commandsContainer = containerEl.createDiv('dual-pane-commands');
		
		const commands = [
			{ name: t('cmdToggle'), icon: 'columns' },
			{ name: t('cmdToggleTriple'), icon: 'layout-grid' },
			{ name: t('cmdStop'), icon: 'square' },
			{ name: t('cmdPageUp'), icon: 'arrow-up' },
			{ name: t('cmdPageDown'), icon: 'arrow-down' },
			{ name: t('cmdDoublePageUp'), icon: 'chevrons-up' },
			{ name: t('cmdDoublePageDown'), icon: 'chevrons-down' }
		];

		for (const cmd of commands) {
			const cmdEl = commandsContainer.createDiv('setting-item');
			cmdEl.style.padding = '6px 0';
			cmdEl.style.borderBottom = 'none';
			
			const iconEl = cmdEl.createSpan('setting-item-icon');
			iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${cmd.icon}"></use></svg>`;
			
			const nameEl = cmdEl.createSpan('setting-item-name');
			nameEl.style.marginLeft = '8px';
			nameEl.textContent = cmd.name;
		}

		// ========== 功能说明 ==========
		const featureContainer = containerEl.createDiv('dual-pane-features');
		featureContainer.style.marginTop = '24px';

		featureContainer.createEl('h3', { text: t('docs') });

		// 双栏模式说明
		const dualPaneFeature = featureContainer.createDiv('feature-item');
		dualPaneFeature.style.marginBottom = '16px';
		dualPaneFeature.style.padding = '12px';
		dualPaneFeature.style.backgroundColor = 'var(--background-modifier-form-field)';
		dualPaneFeature.style.borderRadius = '6px';
		
		dualPaneFeature.createEl('h4', { 
			text: '◪ ' + t('menuDualMode'),
			cls: 'feature-title'
		});
		dualPaneFeature.createEl('p', { 
			text: t('featureSyncDesc'),
			cls: 'feature-desc'
		});

		// 三栏模式说明
		const triplePaneFeature = featureContainer.createDiv('feature-item');
		triplePaneFeature.style.marginBottom = '16px';
		triplePaneFeature.style.padding = '12px';
		triplePaneFeature.style.backgroundColor = 'var(--background-modifier-form-field)';
		triplePaneFeature.style.borderRadius = '6px';
		
		triplePaneFeature.createEl('h4', { 
			text: '▦ ' + t('menuTripleMode'),
			cls: 'feature-title'
		});
		triplePaneFeature.createEl('p', { 
			text: t('featureTripleDesc'),
			cls: 'feature-desc'
		});

		// 翻页说明
		const pageFeature = featureContainer.createDiv('feature-item');
		pageFeature.style.marginBottom = '16px';
		pageFeature.style.padding = '12px';
		pageFeature.style.backgroundColor = 'var(--background-modifier-form-field)';
		pageFeature.style.borderRadius = '6px';
		
		pageFeature.createEl('h4', { 
			text: '⇅ ' + t('featureSync'),
			cls: 'feature-title'
		});
		pageFeature.createEl('p', { 
			text: t('featurePageUpDesc') + ' / ' + t('featurePageDownDesc'),
			cls: 'feature-desc'
		});

		// ========== 支持链接 ==========
		const supportContainer = containerEl.createDiv('dual-pane-support');
		supportContainer.style.marginTop = '24px';
		supportContainer.style.paddingTop = '16px';
		supportContainer.style.borderTop = '1px solid var(--background-modifier-border)';

		supportContainer.createEl('h3', { text: t('support') });

		const linksContainer = supportContainer.createDiv('setting-item');
		
		const docsLink = linksContainer.createEl('a', {
			href: 'https://github.com/liyifan2004/obsidian-folio',
			text: '📖 ' + t('docs')
		});
		docsLink.style.marginRight = '16px';
		docsLink.target = '_blank';

		const feedbackLink = linksContainer.createEl('a', {
			href: 'https://github.com/liyifan2004/obsidian-folio/issues',
			text: '🐛 ' + t('feedback')
		});
		feedbackLink.target = '_blank';
	}
}
