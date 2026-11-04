import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

/**
 * ESLint 配置。
 *
 * `eslint-plugin-obsidianmd` 是 **Obsidian 官方提供的自查工具** ——
 * 「Check your Obsidian plugin against the official developer guidelines」，
 * 商店审查用的正是它这套规则。
 *
 * ## 覆盖范围
 *
 * 用 `eslint .` 覆盖**整个仓库**，而不是只点名 `main.ts src package.json`。
 *
 * 之前只点名 3 处时，**test/ 下的 5 个测试文件完全游离在 lint 之外** ——
 * 配置写了、规则装了，但那部分代码就是没人检。
 * 这与「eslint 从未接进 CI」是同一类问题：
 * **规则存在不等于规则生效**。
 *
 * 与同 fleet 的 obsidian-jev-inbox-router、obsidian-media-speed-enhancer 同一套口径。
 */
export default defineConfig([
	// 构建产物与 Node 脚本不是插件源码。
	// main.js 是 esbuild 产物（仓库根目录同时有 main.ts 与 main.js），
	// 不忽略它会让 ESLint 去 lint 打包后的代码。
	//
	// tools/ 与 *.config.mjs、version-*.mjs 是**构建期**脚本，
	// 跑在 Node 里而不是 Obsidian 里 —— 拿插件的规则去审它们只会得到假告警。
	// 它们也不进发布产物（商店只下载 main.js / manifest.json / styles.css）。
	globalIgnores([
		"node_modules",
		"main.js",
		"dist",
		".workbuddy",
		"*.config.mjs",
		"*.config.mts",
		"version-bump.mjs",
		"version-sync.mjs",
		"tools/",
	]),

	...obsidianmd.configs.recommended,

	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs", "version-bump.mjs", "version-sync.mjs"],
				},
			},
		},
	},

	{
		// 测试文件不按「插件源码」的规则审 ——
		// 商店审查看的是发布产物（main.js），测试里的 any 与断言是合理的。
		//
		// no-unsupported-api 与 no-deprecated 也要放开：
		//   - no-unsupported-api 只比对「API 的 @since 版本 vs manifest 的 minAppVersion」，
		//     不理解 `requireApiVersion("1.13.0")` 这样的运行时守卫。
		//     源码里 `this.update()` 有守卫（src/settings.ts 的 refresh()），
		//     测试里则要**直接替换** update() 来断言「1.13+ 走 update()、旧版不走」。
		//     两种情况都不会跑在用户的 Obsidian 上 —— 测试代码不进发布产物。
		files: ["test/**/*.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
			"@typescript-eslint/no-deprecated": "off",
			"obsidianmd/no-unsupported-api": "off",
		},
	},
]);
