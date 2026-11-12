import {
	App,
	PluginSettingTab,
	Setting,
	requireApiVersion,
	setIcon,
	type SettingDefinitionItem,
} from 'obsidian';
import DualPaneSyncPlugin from '../main';
import {
	t,
	setLanguage,
	resolveLanguage,
	getAvailableLanguages,
	getLanguageName,
	LanguageSetting
} from './types';

interface CommandInfo {
	name: string;
	icon: string;
}

interface FeatureInfo {
	icon: string;
	title: string;
	desc: string;
}

/**
 * Settings tab with two renderers over one schema:
 *
 *   - {@link getSettingDefinitions} — declarative API used by Obsidian 1.13+.
 *     Renders the settings and indexes them in Obsidian's settings search.
 *     Values are bound to `plugin.settings` through
 *     {@link getControlValue} / {@link setControlValue}.
 *   - {@link display} — imperative fallback for Obsidian 1.8.7–1.12 (this
 *     plugin's minAppVersion), where the declarative API does not exist.
 *
 * On 1.13+ Obsidian bypasses display() entirely once getSettingDefinitions()
 * returns a non-empty array, so both can coexist without double rendering.
 * This mirrors the pattern already used in obsidian-mineru-converter.
 */
export class DualPaneSettingTab extends PluginSettingTab {
	plugin: DualPaneSyncPlugin;

	constructor(app: App, plugin: DualPaneSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// ---------- declarative path (Obsidian 1.13+) ----------

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				// **分组标题不能含插件名。**
				// 官方规则 `settings-tab/no-problematic-settings-headings` 禁止
				// 标题里出现插件名 / settings / options / general。
				// 同 fleet 的 obsidian-media-speed-enhancer 1.0.42 就是因为
				// 「设置标题重复插件名」被商店审查打回、插件从目录列表下架。
				//
				// 这里原先用的是 `t('ribbonTooltip')`（"MultiFolio: 多栏工作区"）——
				// 那是 Ribbon 图标的 tooltip，**含插件名**，用在设置分组标题上是错的。
				// 官方 eslint 规则只检查**字面量**参数，查不出 `t('...')` 这种
				// 间接引用，所以 lint 全绿也不代表没问题。
				heading: t('settingsGeneral'),
				items: [
					{
						name: t('settingOverlap'),
						desc: t('settingOverlapDesc'),
						control: {
							key: 'overlapLines',
							type: 'slider',
							min: 0,
							max: 10,
							step: 1,
						},
					},
					{
						name: t('settingLanguage'),
						desc: t('settingLanguageDesc'),
						control: {
							key: 'language',
							type: 'dropdown',
							options: this.languageOptions(),
						},
					},
				],
			},
			{
				type: 'group',
				heading: t('settingHotkeys'),
				items: [
					{
						name: t('settingHotkeysDesc'),
						desc: t('settingHotkeysDesc'),
						searchable: false,
						render: (setting: Setting) => this.renderCommands(setting),
					},
				],
			},
			{
				type: 'group',
				heading: t('docs'),
				items: [
					{
						name: t('featureSync'),
						desc: t('featureSyncDesc'),
						searchable: false,
						render: (setting: Setting) => this.renderFeatures(setting),
					},
				],
			},
			{
				type: 'group',
				heading: t('support'),
				items: [
					{
						name: t('support'),
						desc: t('feedback'),
						searchable: false,
						render: (setting: Setting) => this.renderLinks(setting),
					},
				],
			},
		];
	}

	/** Storage binding for declarative controls: read from `plugin.settings`. */
	override getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	/** Storage binding for declarative controls: write + persist. */
	override async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		settings[key] = value;

		// Switching the language must take effect immediately, like the
		// imperative path does — otherwise the dropdown label and the rest
		// of the UI stay in the old language until a reload.
		if (key === 'language') {
			setLanguage(resolveLanguage(value as LanguageSetting));
			this.refresh();
		}

		await this.plugin.saveSettings();
	}

	/**
	 * Re-render the settings tab after a value change that affects the
	 * labels (currently: the language).
	 *
	 * The two render paths need different calls:
	 *
	 *   - Obsidian 1.13+ renders from `getSettingDefinitions()`. Re-calling
	 *     `display()` does NOT refresh it (the declarative tree is owned by
	 *     the framework) — `update()` is the documented refresh API.
	 *   - Below 1.13 the imperative `display()` IS the renderer, so it has
	 *     to be re-called.
	 *
	 * `requireApiVersion` is Obsidian's own runtime feature probe, so the
	 * check stays correct on builds older than the typed API.
	 */
	private refresh(): void {
		if (requireApiVersion('1.13.0')) {
			this.update();
		} else {
			// Below 1.13 the imperative renderer IS the renderer, so it has
			// to be re-run. `renderImperative()` is called instead of
			// `this.display()` because `display()` is marked deprecated in the
			// 1.13+ type definitions — and the eslint plugin forbids
			// suppressing that warning. The official
			// `obsidianmd/settings-tab/no-deprecated-display` rule agrees this
			// is not legacy code: it only fires when minAppVersion >= 1.13.0,
			// and this plugin supports down to 1.8.7.
			this.renderImperative();
		}
	}

	/** Dropdown options for the language setting: "auto" + every known locale. */
	private languageOptions(): Record<string, string> {
		const options: Record<string, string> = {
			'auto': t('settingLanguageAuto'),
		};
		for (const lang of getAvailableLanguages()) {
			options[lang] = getLanguageName(lang);
		}
		return options;
	}

	// ---------- shared custom sections ----------

	/**
	 * The command list (read-only reference for the hotkeys section).
	 *
	 * Renders into `setting.controlEl` with the row collapsed to a single
	 * column, so the list spans the full width of the settings pane — the
	 * same layout the imperative path produced.
	 */
	private renderCommands(setting: Setting): void {
		const commands: CommandInfo[] = [
			{ name: t('cmdToggle'), icon: 'columns' },
			{ name: t('cmdToggleTriple'), icon: 'layout-grid' },
			{ name: t('cmdStop'), icon: 'square' },
			{ name: t('cmdPageUp'), icon: 'arrow-up' },
			{ name: t('cmdPageDown'), icon: 'arrow-down' },
			{ name: t('cmdDoublePageUp'), icon: 'chevrons-up' },
			{ name: t('cmdDoublePageDown'), icon: 'chevrons-down' }
		];

		setting.setClass('multifolio-section');
		const commandsContainer = setting.controlEl.createDiv('multifolio-commands');
		for (const cmd of commands) {
			const cmdEl = commandsContainer.createDiv('multifolio-command');
			const iconEl = cmdEl.createSpan('multifolio-command-icon');
			setIcon(iconEl, cmd.icon);
			cmdEl.createSpan({ cls: 'multifolio-command-name', text: cmd.name });
		}
	}

	/** The feature summary cards. */
	private renderFeatures(setting: Setting): void {
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

		setting.setClass('multifolio-section');
		for (const feature of features) {
			const itemEl = setting.controlEl.createDiv('multifolio-feature');
			const titleEl = itemEl.createDiv('multifolio-feature-title');
			const iconEl = titleEl.createSpan('multifolio-feature-icon');
			setIcon(iconEl, feature.icon);
			titleEl.createSpan({ cls: 'multifolio-feature-name', text: feature.title });
			itemEl.createDiv({ cls: 'multifolio-feature-desc', text: feature.desc });
		}
	}

	/** The support links. */
	private renderLinks(setting: Setting): void {
		setting.setClass('multifolio-section');
		const linksContainer = setting.controlEl.createDiv('multifolio-links');
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

	/**
	 * Imperative fallback for Obsidian 1.8.7–1.12.
	 *
	 * On 1.13+ Obsidian bypasses this method entirely (the declarative path
	 * above takes over). Below 1.13 it is the only renderer, so it must
	 * exist — the official `obsidianmd/settings-tab/require-display` rule
	 * requires it while minAppVersion < 1.13.0.
	 *
	 * The body lives in {@link renderImperative} so that the refresh path
	 * can re-render without going through the deprecated `display()` entry
	 * point.
	 */
	display(): void {
		this.renderImperative();
	}

	/**
	 * The imperative rendering itself, split out of {@link display} so it can
	 * be re-run on a language change without calling a deprecated API.
	 *
	 * Both render paths share the {@link renderCommands} / {@link renderFeatures}
	 * / {@link renderLinks} helpers, so the two paths stay in sync.
	 */
	private renderImperative(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ========== 标题 ==========
		// 与声明式路径同一个 key（`settingsGeneral`）——
		// 分组标题不能含插件名，详见 getSettingDefinitions 里的说明。
		new Setting(containerEl)
			.setName(t('settingsGeneral'))
			.setHeading();

		// ========== 重叠行数设置 ==========
		new Setting(containerEl)
			.setName(t('settingOverlap'))
			.setDesc(t('settingOverlapDesc'))
			.addSlider((slider) => {
				slider
					.setLimits(0, 10, 1)
					.setValue(this.plugin.settings.overlapLines)
					.onChange(async (value) => {
						this.plugin.settings.overlapLines = value;
						await this.plugin.saveSettings();
					});
			});

		// ========== 语言设置 ==========
		new Setting(containerEl)
			.setName(t('settingLanguage'))
			.setDesc(t('settingLanguageDesc'))
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(this.languageOptions())) {
					dropdown.addOption(value, label);
				}
				dropdown
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as LanguageSetting;
						setLanguage(resolveLanguage(this.plugin.settings.language));
						await this.plugin.saveSettings();
						// 重绘设置页，使界面立即使用新语言
						this.refresh();
					});
			});

		// ========== 快捷键设置说明 ==========
		new Setting(containerEl)
			.setName(t('settingHotkeys'))
			.setDesc(t('settingHotkeysDesc'))
			.setHeading();

		// ========== 命令列表 ==========
		const commandsSetting = new Setting(containerEl);
		commandsSetting.setName(t('settingHotkeys'));
		this.renderCommands(commandsSetting);

		// ========== 功能说明 ==========
		new Setting(containerEl)
			.setName(t('docs'))
			.setHeading();

		const featuresSetting = new Setting(containerEl);
		featuresSetting.setName(t('docs'));
		this.renderFeatures(featuresSetting);

		// ========== 支持链接 ==========
		new Setting(containerEl)
			.setName(t('support'))
			.setHeading();

		const linksSetting = new Setting(containerEl);
		linksSetting.setName(t('support'));
		this.renderLinks(linksSetting);
	}
}
