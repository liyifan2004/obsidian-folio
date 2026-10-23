# MultiFolio 技术参考记录（Technical References）

记录与本插件直接相关的技术调研结论。每条注明：问题、来源、核实到的实现方式、对本项目的决定（采纳/部分采纳/不采纳）与理由。
区分【事实】（直接核实的证据）与【推断】。核实日期：2026-10-23。

## 本地 API 依据（最高优先级）

来源：`node_modules/obsidian/obsidian.d.ts`（npm 包 obsidian@1.12.3，官方 API 类型定义，含 `@public`/`@since` 文档注释）。
该文件即项目编译时实际约束的 API 面，比网页文档更准确。

### R-001 视图模式读取：用 `MarkdownView.getMode()` 而非 `getState().mode`

- 问题：跟随窗格需区分阅读/编辑模式以选择滚动容器与 openFile 状态（F-012/F-014）。
- 证据：d.ts:4080 `getMode(): MarkdownViewModeType`；d.ts:4106 `type MarkdownViewModeType = 'source' | 'preview'`。【事实】
- 现状：`followMode.ts` 用 `view.getState().mode`。二者当前语义一致（实时预览下均为 'source'），但 `getMode()` 是文档化公开方法。
- 决定：**采纳**（改用 `getMode()`，非 MarkdownView 保持原回退逻辑）。风险低，行为不变。

### R-002 工作区事件足以替代文件轮询

- 问题：F-013 用 400ms 轮询检测窗格文件变化（O-004）。
- 证据：d.ts Workspace 事件表（d.ts:7093-7195）含 `'active-leaf-change'`、`'file-open'`、`'layout-change'`、`'resize'`、`'css-change'`、`'window-open'`/`'window-close'`。**没有**模式切换专用事件。【事实】
- 结论：文件不一致对账可用 `file-open`/`active-leaf-change`/`layout-change` 事件即时触发；编辑⇄阅读模式切换无专用事件，需保留低频定时器兜底（该定时器同时做模式比对）。
- 决定：**采纳**（事件驱动对账 + 单个 500ms 兜底定时器合并 F-013/F-014 两项检查，删除 400ms 轮询）。

### R-003 `getSettingDefinitions`（声明式设置）不适用于当前版本下限

- 问题：eslint `obsidianmd/settings-tab/prefer-setting-definitions` 警告设置页不进 1.13+ 设置搜索（O-006）。
- 证据：obsidian@1.12.3 的 d.ts 中**不存在** `getSettingDefinitions`（grep 无匹配）【事实】；lint 警告文案自述针对 "1.13.0 or later"【事实】。
- 结论：该 API 需要 Obsidian ≥1.13，而本插件 minAppVersion=1.8.7（下限由 `getLanguage()` @since 1.8.7 决定）。采纳将迫使最低版本大幅上调或做双实现。
- 决定：**不采纳**（现状保留，lint 警告视为已知并说明理由；若未来 minAppVersion 上调至 1.13+ 再迁移）。

### R-004 Plugin 基类的自动清理机制

- 问题：O-001 泄漏根因是手动管理生命周期的引擎实例被重建而不清理。
- 证据：d.ts:1875-1907 `Plugin.register(cb)`、`registerEvent(ref)`、`registerDomEvent(...)`、`registerInterval(id)`，均带 `@since`（0.9.7–0.14.8）与 "Registers ... to be detached when the plugin is unloaded" 语义。【事实】
- 结论：注册型资源（事件、定时器）交给 Plugin 基类托管可根治"卸载忘清理"类问题。但本插件的跟随引擎是**动态启停**的（模式反复开停），基类托管只能覆盖"插件卸载"，启停仍需自管理。
- 决定：**部分采纳**——本轮先做正确性修复（不重建实例 + 显式 dispose）；将引擎改造为 `Component` 子类（`load/unload` 语义）列为后续架构方向（见优化清单 O-009 候选）。

## 开源项目对标

### R-005 omnbird/syncscroll（MIT）——滚动同步核心

- 仓库：https://github.com/omnbird/syncscroll （核实了 `src/sync-scroll.ts` 138 行、`src/utils/workspace.ts` 67 行源码全文）【事实】
- 场景：两个**不同文件**的并排窗格同步滚动（翻译对照），百分比同步 + 可持久的相对偏移（`percentageOffset`），三击行跳转对齐。
- 核实到的实现：
  - 滚动容器：`contentEl.querySelector('.cm-scroller')`——与本插件同款 DOM 依赖，仅覆盖编辑模式（本插件另支持阅读模式 `.markdown-preview-view`）。
  - 同步回环：`isSyncing` 标志 + `requestAnimationFrame` 释放（本插件用 16ms 定时器，等价）。
  - 清理：`AbortController` 统一取消 scroll 监听（比逐个 `removeEventListener` 更简洁）。
  - 窗格发现：`getBoundingClientRect` 几何判定左右相邻 + 可见性（`offsetParent !== null`）。
- 对本项目价值：同文件三窗格场景下，本插件的"绝对内容坐标 + 重叠行"模型比纯百分比更合适（百分比在不同长度文档才需要偏移补偿）。
- 决定：**部分采纳**——借鉴 AbortController 清理思路（实施 O-001/O-002 时顺手统一）；"手动对齐/校准偏移"作为 O-008 的候选方案之一记录；几何法窗格发现不采纳（本插件用标记+注册表可精确管理自有窗格）。

### R-006 XeroAlpha/markdown-sync-scroll——私有 API 补丁的反面教材

- 仓库：https://github.com/XeroAlpha/markdown-sync-scroll （核实 README 原文）【事实】
- README 顶部自警："This plugin provides a patch to modify some private method of MarkdownView. It may not worked when you update your Obsidian version."；已知问题：重新链接窗格后滚动偏移不重算。
- 对本项目价值：证实①打补丁私有方法是本插件应避免的路线（本插件只用公开 API + DOM 选择器，脆弱性更低但非零，需在文档中声明）；②"窗格解除/重建链接后状态残留"是同类插件的通病，佐证 O-002 必须做窗格身份注册表而非即用即弃。
- 决定：**不采纳其路线**；采纳其教训（见 O-002 方案）。

### R-007 PDF Sync Scroll（社区插件）——窗格身份与手动对齐

- 来源：https://community.obsidian.md/plugins/pdf-sync-scroll （社区介绍页，检索摘要核实）【事实（摘要级）】；源码未核验。
- 可借鉴点：窗格选择"saved by pane identity and file path... falls back to the current session"（身份 + 文件路径双键、不可得时退化为会话级）——与 O-002 注册表设计（leaf 引用 + 文件路径校验）一致；"Align at current positions / Reset alignment" 手动对齐交互；对限制条件（DOM 非公开 API、平台支持范围）的如实声明。
- 决定：**部分采纳**——O-002 采用"注册表 + 文件路径校验 + 会话级失效兜底"同构方案；手动对齐交互暂不做（P3 探索）。

## 明确未核验的事项

- docs.obsidian.md 页面为客户端渲染，本轮无法抓取正文（curl 返回空壳 2722B）；官方规范以 d.ts 内 `@public`/`@since` 文档注释为准。若后续需要页面级规范（如插件上架指南），须另行核验。
- PDF Sync Scroll 仅核验了社区介绍页摘要，未读源码。
- 三个参考项目的移动端行为均未核验。
