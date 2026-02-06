import { App, PluginSettingTab, Setting } from 'obsidian';
import DualPaneSyncPlugin from '../main';
import { t } from './i18n';

export class DualPaneSettingTab extends PluginSettingTab {
	plugin: DualPaneSyncPlugin;

	constructor(app: App, plugin: DualPaneSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl('h2', { text: t('settingTitle') });

		// ==================== 重合行数设置（最前面）====================
		containerEl.createEl('h3', { 
			text: t('settingOverlapTitle'), 
			cls: 'setting-item-heading' 
		});

		new Setting(containerEl)
			.setName(t('settingOverlapName'))
			.setDesc(t('settingOverlapDesc'))
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(this.plugin.settings.overlapLines)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.overlapLines = value;
					await this.plugin.saveSettings();
				})
			);

		// ==================== 快捷键设置说明（紧跟后面）====================
		containerEl.createEl('h3', { 
			text: t('settingHotkeyTitle'), 
			cls: 'setting-item-heading' 
		});

		// 快捷键说明卡片
		const hotkeyCard = containerEl.createEl('div', {
			cls: 'dual-pane-card',
			attr: { 
				style: 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin: 12px 0 20px 0; border: 1px solid var(--background-modifier-border);'
			}
		});
		
		const hotkeySteps = hotkeyCard.createEl('div', { cls: 'setting-item-description' });
		hotkeySteps.innerHTML = `
			<p style="margin: 0 0 12px 0; color: var(--text-normal);">${t('settingHotkeyDesc')}</p>
			<p style="margin: 8px 0 0 0; color: var(--text-accent); font-size: 0.9em;">💡 ${t('settingHotkeyRecommend')}</p>
		`;

		// ==================== 功能说明 ====================
		containerEl.createEl('h3', { 
			text: t('settingFeatureTitle'), 
			cls: 'setting-item-heading' 
		});

		const featureList = containerEl.createEl('div', {
			cls: 'dual-pane-features',
			attr: { style: 'margin: 12px 0 20px 0;' }
		});

		const features = [
			{ icon: '📄', text: t('featureLeft') },
			{ icon: '📄', text: t('featureRight') },
			{ icon: '↔️', text: t('featureScroll') },
			{ icon: '🔄', text: t('featureAdaptive') },
		];

		features.forEach(feature => {
			const item = featureList.createEl('div', {
				attr: { style: 'display: flex; align-items: flex-start; margin: 8px 0; padding: 8px; background: var(--background-primary-alt); border-radius: 6px;' }
			});
			item.createEl('span', { text: feature.icon, attr: { style: 'margin-right: 10px; font-size: 1.2em;' } });
			item.createEl('span', { text: feature.text, attr: { style: 'color: var(--text-normal); line-height: 1.5;' } });
		});

		// ==================== 使用提示 ====================
		containerEl.createEl('h3', { 
			text: t('settingTipsTitle'), 
			cls: 'setting-item-heading' 
		});

		const tipsList = containerEl.createEl('div', {
			cls: 'dual-pane-tips',
			attr: { style: 'margin: 12px 0;' }
		});

		const tips = [
			t('tipClick'),
			t('tipEdit'),
			t('tipScroll'),
			t('tipMode'),
			t('tipClose'),
		];

		tips.forEach((tip, index) => {
			const item = tipsList.createEl('div', {
				attr: { style: 'display: flex; align-items: center; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid var(--background-modifier-border-hover);' }
			});
			item.createEl('span', { text: `${index + 1}.`, attr: { style: 'margin-right: 10px; color: var(--text-muted); font-weight: bold; min-width: 20px;' } });
			item.createEl('span', { text: tip, attr: { style: 'color: var(--text-normal);' } });
		});
	}
}
