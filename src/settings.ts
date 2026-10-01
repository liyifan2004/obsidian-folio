import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import DualPaneSyncPlugin from '../main';
import { t } from './types';

interface CommandInfo {
	name: string;
	icon: string;
}

interface FeatureInfo {
	icon: string;
	title: string;
	desc: string;
}

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
		new Setting(containerEl)
			.setName(t('ribbonTooltip'))
			.setHeading();

		// ========== 重叠行数设置 ==========
		new Setting(containerEl)
			.setName(t('settingOverlap'))
			.setDesc(t('settingOverlapDesc'))
			.addSlider((slider) => {
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
		const commands: CommandInfo[] = [
			{ name: t('cmdToggle'), icon: 'columns' },
			{ name: t('cmdToggleTriple'), icon: 'layout-grid' },
			{ name: t('cmdStop'), icon: 'square' },
			{ name: t('cmdPageUp'), icon: 'arrow-up' },
			{ name: t('cmdPageDown'), icon: 'arrow-down' },
			{ name: t('cmdDoublePageUp'), icon: 'chevrons-up' },
			{ name: t('cmdDoublePageDown'), icon: 'chevrons-down' }
		];

		const commandsContainer = containerEl.createDiv('multifolio-commands');
		for (const cmd of commands) {
			const cmdEl = commandsContainer.createDiv('multifolio-command');
			const iconEl = cmdEl.createSpan('multifolio-command-icon');
			setIcon(iconEl, cmd.icon);
			cmdEl.createSpan({ cls: 'multifolio-command-name', text: cmd.name });
		}

		// ========== 功能说明 ==========
		new Setting(containerEl)
			.setName(t('docs'))
			.setHeading();

		const features: FeatureInfo[] = [
			{
				icon: 'columns',
				title: t('menuDualMode'),
				desc: t('featureSyncDesc')
			},
			{
				icon: 'layout-grid',
				title: t('menuTripleMode'),
				desc: t('featureTripleDesc')
			},
			{
				icon: 'arrow-down-up',
				title: t('featureSync'),
				desc: t('featurePageUpDesc') + ' / ' + t('featurePageDownDesc')
			}
		];

		for (const feature of features) {
			const itemEl = containerEl.createDiv('multifolio-feature');
			const titleEl = itemEl.createDiv('multifolio-feature-title');
			const iconEl = titleEl.createSpan('multifolio-feature-icon');
			setIcon(iconEl, feature.icon);
			titleEl.createSpan({ cls: 'multifolio-feature-name', text: feature.title });
			itemEl.createDiv({ cls: 'multifolio-feature-desc', text: feature.desc });
		}

		// ========== 支持链接 ==========
		new Setting(containerEl)
			.setName(t('support'))
			.setHeading();

		const linksContainer = containerEl.createDiv('multifolio-links');
		linksContainer.createEl('a', {
			href: 'https://github.com/liyifan2004/obsidian-folio',
			cls: 'multifolio-link',
			text: t('docs'),
			attr: { target: '_blank', rel: 'noopener' }
		});
		linksContainer.createEl('a', {
			href: 'https://github.com/liyifan2004/obsidian-folio/issues',
			cls: 'multifolio-link',
			text: t('feedback'),
			attr: { target: '_blank', rel: 'noopener' }
		});
	}
}
