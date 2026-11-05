# 开发记录（CHANGELOG_DEV）

面向维护者的开发日志：每次实质性开发记一条。只记有长期价值的内容，调试细节不入。

## 2026-10-23 第一批：摸底 + 功能账簿 + 可靠性修复（O-001–O-005）

**目标与完成内容**：建立长期维护依据（功能账簿、技术调研），并修复首轮审查确认的 2 个 P1、3 个 P2 缺陷。

**关键文件与功能 ID**：
- 新增 `docs/FEATURE_LEDGER.md`（F-001–F-019、O-001–O-008）、`docs/TECHNICAL_REFERENCES.md`（R-001–R-007）、本文件。
- `main.ts`：`saveSettings` 不再重建跟随引擎（O-001，影响 F-009/F-012）；`onunload` 改调 `destroy()`（O-002）。
- `src/followMode.ts`：
  - O-002（F-001/002/003/018/019）：新增窗格身份注册表 `followerRegistry`（main/left/right，跨停止保留）；`acquireOrCreateFollower` 复用注册表/标记窗格，`retireObsoleteFollowers` 回收目标模式不需要的自有同文件窗格；`startFollowMode(mode, {mainLeaf})` 支持指定主窗格并做角色恢复（点击跟随窗格启动时还原原主窗格）；`destroy()` 卸载时保留标记供重载识别。删除 `closeExistingFollowWindows`/`toggleFollowMode`（前者被注册表机制取代，后者为死代码）。
  - O-003（F-003/016/019）：`stopFollowMode({silent})` 静默通道，内部转换与异常清理不再弹「已停止」。
  - O-004（F-013/014）：删除 400ms 文件轮询，改为 `file-open`/`active-leaf-change`/`layout-change` 事件（100ms 防抖）触发 `reconcile()`；500ms 轮询保留为模式切换检测 + 事件兜底（`checkMainModeChange`）；`syncAllToFile` 加 `isReconciling` 防回环。
  - O-005（F-004–007）：`pageScroll` 未激活时回退到活动 Markdown 视图，无可用视图时提示。
  - R-001：`getScrollContainer`/`getLeafMode` 改用公开 API `MarkdownView.getMode()`；R-005：scroll 监听清理改用 `AbortController`。

**技术方案与理由**：
- 设置对象按引用共享、`doSync` 实时读 `overlapLines`，故 O-001 的正确修复是「不重建」而非「重建前清理」（消除而非补丁）。
- O-002 取「注册表 + 文件路径校验 + 标记兜底」三键方案（参考 R-007 的窗格身份思路）：只复用/回收本插件创建且仍显示目标文件的窗格，用户已接管的窗格不动，非破坏性。
- 轮询→事件（R-002）：模式切换无专用事件，故保留 500ms 兜底，未追求完全事件化。

**测试与结果**：`npm run lint`（0 error；1 个既有警告 `settings-tab/prefer-setting-definitions`，决策见 O-006/R-003）；`npm run build`（`tsc -noEmit -skipLibCheck` + esbuild 均通过）；改后全文件逐行复核。**未做**：Obsidian 实机验证（本环境无 Obsidian）——重点手测项：双↔三切换不累积窗格、停止后重启复用窗格、拖动重叠滑块无副作用、翻页命令未激活回退、编辑⇄阅读切换跟随。

**未解决/风险**：
- 插件重载后（注册表丢失）从跟随窗格启动的边角场景见 F-019 条目（非破坏性，已记录）。
- O-008（侧栏 ±0.5 比例粗估）未动，候选方案记录于 R-005/R-007。
- 移动端全功能待实机核实（manifest `isDesktopOnly: false`）。

**文档同步**：FEATURE_LEDGER（O 状态、受影响 F 条目、架构速览、更新记录）已同步；TECHNICAL_REFERENCES 为本次新增。

**提交**：`505678e`（fix：O-001–O-005 代码）、`4f007c5`（docs：账簿/技术参考/开发记录）。

## 2026-10-23 第二批：语言手动选择（O-007 → F-020）

**目标与完成内容**：消化 O-007 死代码/残留文案——把预留的语言选择做成功能，而非删除文案。

**关键文件**：`src/types.ts`（`LanguageSetting`、`resolveLanguage`（非法值回退自动检测）、`settingLanguageAuto` 新键 ×9、`settingLanguageDesc` ×9 更新）；`src/settings.ts`（语言下拉：自动 + 9 语言，切换即生效并重绘）；`main.ts`（onload 按 `resolveLanguage` 应用）。

**方案与理由**：持久化字段 `language: 'auto' | 语言码`（缺省 auto，向后兼容）；命令名为注册时固化，无法动态改名，故在设置描述中注明「重载后更新」而非引入额外弹窗。原 `settingLanguage*` 文案键、`getLanguageName`/`getAvailableLanguages` 导出全部投入使用；`getCurrentLanguage`、`totalChars`/`currPos` 仍为残留（低价值，留待 i18n 清理）。

**测试与结果**：`npm run lint` 0 error（同一既有警告）；`npm run build` 通过；grep 确认 `settingLanguageAuto` 9 处齐全。**未做**：实机验证（下拉交互与切换即时生效待手测）。

## 2026-11-03 第四批：发布 1.0.4

**目标与完成内容**：把 2026-11-02 第三批的两处用户可感知修复（O-008 滚动几何、O-012 尺寸监听）正式发布。

**版本号**：1.0.3 → 1.0.4。用仓库自带的 `npm version patch`（`version-bump.mjs` 同步 manifest.json + versions.json），保证三处版本号一致。

**本次发布包含的用户可感知变更**：
- **O-008 滚动几何**：跟随窗格与主窗格的滚动位置改用精确像素逆运算，往返误差 0（旧实现随文档长度线性放大，100,000px 文档峰值误差达 49,256px）。
- **O-012 尺寸监听**：模式切换后重新 observe 滚动容器，修复「切换到编辑/阅读模式后，拖动栏宽不再同步」的问题。

**发布 tag**：`1.0.4`（与仓库既有 `1.0.1`/`1.0.2`/`1.0.3` 的裸版本号格式一致），`release.yml` 会在 tag push 时自动构建、校验并发布 GitHub Release（含 Artifact Attestations）。

**验证**：`npm run verify`（typecheck → lint → stylelint → test → build）全通过；`npm test` 28/28。

**未做**：Obsidian 实机验证（本环境无 Obsidian）。本次发布的两处修复都依赖真实 DOM 行为，手测项：① 主窗格切编辑/阅读后跟随窗格是否同步切换；② 切换后拖动栏宽是否仍同步；③ 三栏模式跨模式滚动对齐精度。

---

## 2026-11-02 第三批：滚动几何修正 + 测试体系 + CI（O-008–O-010）

**目标与完成内容**：把上一批留下的 O-008（侧栏滚动反推粗估）从「探索中」落地，同时补上仓库的两个结构性缺口——零自动化测试、零 CI。

**关键文件**：
- 新增 `src/scrollMath.ts`（108 行，纯函数）：`clampScroll`、`rightScrollFromMain`、`leftScrollFromMain`、`mainScrollFromRight`、`mainScrollFromLeft`、`pageScrollTarget`。不 import obsidian、不碰 DOM，因此可被单测直接验证。
- `src/followMode.ts`：`doSync` 的主窗格目标位置不再用「±0.5 比例」粗估，改为调用 `mainScrollFromRight`/`mainScrollFromLeft` 按像素几何逆运算；跟随窗格目标位置改用 `rightScrollFromMain`/`leftScrollFromMain`，与正向严格互逆。`pageScroll` 改用 `pageScrollTarget`。
- `src/types.ts`：新增 `getTranslationKeys(lang)` 导出，供测试校验 9 语言键集。
- 新增 `test/mocks/obsidian.ts`（Obsidian API 最小桩）、`test/scroll-math.test.ts`（17 例）、`test/i18n.test.ts`（11 例）、`vitest.config.mts`。
- 新增 `.github/workflows/ci.yml`；`release.yml` 补 test 步骤。

**O-008 的问题证据**：旧实现在跟随窗格滚动时用 `mainRatio = rightRatio - 0.5`（左窗格为 `+0.5`）反推主窗格位置。这隐含假设「窗格高度 = 文档可滚动高度的 50%」——只对特定文档长度成立。误差随文档长度线性放大：

| 文档可滚动高度 | 旧实现平均误差 | 旧实现峰值误差 | 新实现 |
| --- | --- | --- | --- |
| 1,500 px | 5.9 px | 6 px | 0 px |
| 5,000 px | 1,378 px | 1,756 px | 0 px |
| 20,000 px | 6,939 px | 9,256 px | 0 px |
| 100,000 px | 36,503 px | 49,256 px | 0 px |

（统计已排除文档两端「跟随窗格已滚到底/顶」的饱和样本——那种情况下主窗格位置在信息上本就不可知，属固有限制而非计算误差。）

**方案与理由**：不引入任何依赖即可精确求解，因为正向公式本身就是纯线性映射（`rightScroll = mainScroll + clientHeight - overlap`），其逆映射是同一个表达式的逆运算。原实现之所以用比例而非像素，是把「文档位置」与「窗格像素高度」混在一个无量纲的 0.5 里——引入 `scrollMath.ts` 后，正反向公式相邻且成对，测试可以直接断言往返一致性，未来改公式必然同时改两处。

**为什么不引入 `obsidian-test-mocks` 等现成桩库**：该类库能覆盖 Obsidian API 全貌，但本仓库当前的测试需求只涉及纯计算与 i18n，两处都不需要模拟 Obsidian 运行时；引入新依赖（供应链面 + 维护面）换来的只是几行桩代码。已沿用本机 fleet 内既有的自研桩模式（与 jev 的 `test/mocks/obsidian.ts` 同构），保持一致且零新增依赖。

**依赖升级**（vitest 5 的 peer 要求，与 fleet 内 jev / adaptive-workspace 对齐）：`@types/node` ^16.11.6 → ^22.0.0；`esbuild` 0.17.3 → ^0.28.0。两者均为 devDependency，不影响发布产物。构建产物 `main.js` 大小 63,996 字节。

**测试与结果**：
- `npm run typecheck`（`tsc -noEmit -skipLibCheck`）通过。
- `npm run lint` 0 error，1 个**既有**警告（`settings-tab/prefer-setting-definitions`），属 O-006 已决策不采纳项，基线未变。
- `npm run lint:styles` 通过。
- `npm test` → 2 个测试文件、**28 例全绿**。
- `npm run build` 通过；产物中已确认不含旧的 ±0.5 逻辑。

**未解决/风险**：
- **Obsidian 实机验证未做**（本环境无 Obsidian）。本次修复的核心场景是「三栏模式下从左/右窗格滚动，主窗格精确对齐」，必须在真实 Obsidian 里手测确认。
- i18n 死键（`featureTriple`/`featurePageUp`/`featurePageDown`/`totalChars`/`currPos`/`modeDual`/`modeTriple`，共 7 个 × 9 语言）仍未清理——低价值，且删除会改动 9 张翻译表，留待与下一次 i18n 整理一并处理；本次已在 `test/i18n.test.ts` 中锁定「各语言键集与英文基线完全一致」，故清理时可安全批量进行。
- `getCurrentLanguage()` 导出仍未被使用，同上留待清理。

**文档同步**：FEATURE_LEDGER 的架构速览、F-012 条目、O-008/009/010 条目、更新记录均已同步。

---

## 2026-11-03（自动化轮）：O-011 / O-012 / O-013

### O-011 跟随窗格不跟随主窗格的编辑/阅读模式切换（P1）

**问题证据**：`checkMainModeChange()` 在检测到主窗格模式变化后只做了两件事——`setupScrollSync()`（重建滚动监听）和 `forceSyncAll()`（强制同步滚动）。**没有任何调用改变跟随窗格的模式**。账簿 F-014 的「已知问题」栏其实已经自述了这个缺口：「跟随窗格模式由 F-013 的 openFile 带上，若 F-013 未触发则只重建监听不切换跟随窗格模式（跨功能缝隙）」。也就是说：主窗格单独切模式（F-013 不触发，因为文件没变）时，跟随窗格永远留在旧模式。

**为什么这不只是"体验不一致"**：编辑模式与阅读模式的滚动容器根本不是同一个元素——编辑模式是 `.cm-scroller`（CodeMirror 6），阅读模式是 `.markdown-preview-view`。`doSync()` 的像素几何换算假设各窗格共享同一套坐标系；一旦一个窗格在 `.cm-scroller`、另一个在 `.markdown-preview-view`，两者的行高、缩进、行数都不同，O-008 刚修好的互逆关系立刻失效——主窗格会跳到完全错误的位置。

**执行顺序（重要）**：本轮实现过程中发现一个顺序陷阱并已修正——**必须先切跟随窗格的模式，再重建滚动监听与尺寸监听**。因为模式切换会替换滚动容器元素，若先调用 `setupScrollSync()`，新绑定的监听器会挂在一个即将被替换掉的旧容器上，等于白绑。因此 `checkMainModeChange` 改为调用新的 `applyModeChange(mode)`，由它按「切模式 → 等渲染 → 重建监听 → 强制同步」的顺序串起来。

**方案**：新增 `syncFollowerModes(mode)`，走 Obsidian 文档化的 `leaf.getViewState()` / `leaf.setViewState()` 一对 API：取出当前 view state，改写 `state.mode`（`'source'` / `'preview'`）与 `state.source`（`true` = 纯源码，`false` = 实时预览），再写回。这是社区驱动模式切换的通用路径（与 `markdown:toggle-preview` 命令底层一致），不依赖任何私有 API，兼容各版本。

**为什么不直接调 `markdown:toggle-preview` 命令**：那是全局命令，作用于 active leaf，无法指定目标窗格。

### O-012 模式切换后尺寸监听静默失效（P1）

**问题证据**：`setupResizeListener()` 只在 `setupFollow()` 里调用一次（启动时）。而滚动容器是随模式切换更换元素的——旧容器（`.cm-scroller`）在模式切换后脱离文档，新容器（`.markdown-preview-view`）从未被 observe。`ResizeObserver` 观察的是**具体元素对象**，不是选择器，所以它会一直盯着那个已经脱离文档的旧节点：尺寸变化不再触发回调，F-015（调整栏宽后阅读位置不跑偏）在用户第一次切换模式之后就静默死掉了。

**方案**：在 `applyModeChange()` 里（紧随模式切换之后）调用 `setupResizeListener()`。该方法内部先 `disconnect()` 再对三个窗格重新 `observe()`，重复调用幂等。顺带也修好了「模式切换后 `getScrollContainer()` 返回了新容器，但 observer 还守着旧容器」这一状态不一致。

**副作用评估**：重建 observer 会丢失一次正在进行的 resize 防抖（`resizeDebounceTimer` 未被清），但 `checkMainModeChange` 紧接着就会 `forceSyncAll()`，位置会被重新对齐，无实际影响。

### O-013 账簿文档漂移（P3）

「架构速览」里的 doSync 描述仍写着「从左/右窗格反推主窗格时用 ±0.5 比例粗估（followMode.ts:484、489，已知粗糙点）」——这正是 2026-11-02 的 O-008 已经修掉的东西。账簿与实际代码冲突时以代码为准，本轮已把该段改为像素几何描述，mermaid 图里的「doSync 比例滚动同步」同步改为「doSync 像素几何滚动同步」。

### 验证

- `npm run verify`（typecheck → lint → stylelint → test → build）**全通过**。
- `npm run lint` 0 error，1 个**既有**警告（`settings-tab/prefer-setting-definitions`，属 O-006 已决策不采纳项，基线未变）。
- `npm test` 28/28（scroll-math 17 + i18n 11）。
- `npm run build` 通过。

**未做 / 残留风险**：Obsidian 实机验证未做（本环境无 Obsidian）。本轮两个修复都强依赖真实 DOM 行为，重点手测项：① 主窗格切编辑/阅读后，跟随窗格是否在同一时刻切换；② 切换后拖动栏宽，F-015 是否仍生效（验证 O-012 真的修好了）；③ 三栏模式下跨模式滚动的对齐精度。O-011 与 O-012 都改动了 `checkMainModeChange` 这一个入口，逻辑上互不冲突，但两者叠加后的实际表现仍需实机确认。

## 2026-11-03 第三批：i18n 死键清理（O-014）

**目标与完成内容**：消化 O-007 遗留的 i18n 残留——7 个从未被调用的键在 9 张翻译表里各躺了一份。

**问题证据**：用 TS 编译器 API 解析 `translations` 对象的属性名，与全仓 `t('...')` 调用点求差集，得到 7 个死键：
`featureTriple`、`featurePageUp`、`featurePageDown`、`totalChars`、`currPos`、`modeDual`、`modeTriple`（×9 语言 = 63 条），
外加一个从未被引用的导出 `getCurrentLanguage()`。

**方案与理由**：全部删除（含被清空的注释段）。这批键的来源有两个：从未实现的功能（字符数/位置读数），以及早期设置页布局的遗留。
它们不产生运行时成本（缺键会静默回退英文，而多余键根本不会被读），但会让**每一次键集变更都要动 9 张表**——
这正是真正需要消除的维护成本。删完后 41 键/语言降到 34 键/语言。

**一个需要留意的坑**：首次尝试用 TS AST 的 `getFullStart()` + `getEnd()` 删属性，结果把相邻字符串值截断了
（`getFullStart()` 会带上**下一个**节点的前导 trivia）。改为按行匹配 `^\t\t'key':` 整行删除才安全。
这类"批量改翻译表"的操作，优先用行级匹配而不是 AST 区间裁剪。

**验证**：`npm run verify` 全通过；`npm test` 37/37；键集一致性另用 TS 编译器 API 独立复核（无缺失、无多余、无重复）。

---

## 2026-11-05 · lint 覆盖范围补全到整个仓库

**背景**：在 obsidian-jev-inbox-router 上发现一类问题 —— **eslint 配置写了、规则装了，但没人跑**（配置存在却从未接进 `verify` / CI）。
本轮复查全 fleet 的 lint 接入情况时，发现 folio 有**同型的另一面**：
`lint` 脚本是 `eslint main.ts src package.json`，**只点名 3 处**，
于是 `test/` 下的 5 个测试文件完全游离在 lint 之外。

**完成内容**：

1. **lint 范围从 3 处扩到整个仓库**：`eslint main.ts src package.json` → `eslint .`。
   实测覆盖文件数 **6 → 12**，新增 `test/` 下 5 个文件与 `version-sync.d.mts`。
2. **补 `globalIgnores`**：`main.js`（esbuild 产物，仓库根目录同时有 `main.ts`）、
   `*.config.mjs` / `*.config.mts`（构建期配置）、`version-*.mjs`（构建期脚本）、
   `tools/`（Python 脚本）。这些不是插件源码，拿插件规则审只会得到假告警，
   而且它们不进发布产物（商店只下载 `main.js` / `manifest.json` / `styles.css`）。
   顺带解决了 `vitest.config.mts` 的解析错误（不在 tsconfig 的 project service 里）。
3. **补 test/ 的规则豁免块**：与 jev / MSE 同构。
   `no-unsupported-api` 需要额外放开 —— 它只比对「API 的 `@since` 版本 vs manifest 的
   `minAppVersion`」，**不理解 `requireApiVersion("1.13.0")` 这样的运行时守卫**。
   folio 的 minAppVersion 是 1.8.7，而 `SettingTab.update` 是 1.13.0 才有的：
   源码里 `this.update()` 有守卫（`src/settings.ts` 的 `refresh()`）是安全的，
   而测试要**直接替换** `update()` 来断言「1.13+ 走 update()、旧版不走」——
   两种情况都不进发布产物。

**扩展覆盖立刻抓到了东西**：改成 `eslint .` 后第一次运行报了 2 个 error
（`no-unsupported-api` × 2）与 1 个 warning（`display` 的 deprecated），
都在 `test/settings-definitions.test.ts` 里 —— 正是此前完全没被检过的那部分代码。

**验证**：`npm run verify` 全绿（typecheck + lint 0 问题 + stylelint + vitest 53/53 + build）。

**未解决/风险**：
- folio 的 lint 仍未在真实 Obsidian 中实机验证（本环境无 GUI）。
- `no-unsupported-api` 不理解运行时守卫，所以**源码**里的版本相关调用仍需人工核对
  （本轮确认过 folio 源码里的 `update()` 有 `requireApiVersion` 守卫）。

## 2026-11-06 · README 精简重写（商店可读性）

**背景**：插件已在 Obsidian 社区商店上架。商店页面直接渲染 README，
README 就是用户搜索到插件后看到的**第一份说明** —— 它太长了。

同时发现两个问题：
1. README 里的插件图标（`assets/icon.png`，`width="96"`）在商店里变得巨大。
2. README 篇幅远超优秀社区插件，用户要点 "Show more" 才能看全。

**调研结论**（实测 14 个高质量社区插件的 README）：
- **87% 的优秀插件不放插件图标**。商店网页头部用的是**通用 lucide 图标**，
  **不读**仓库里的 `icon.png`；Obsidian 应用内插件列表的图标来自 `manifest.json`
  的 `icon` 字段，与 README 无关。→ **README 里放图标没有任何功能价值**，
  只有「撑满一行」的代价。
- 商店 CSS 有 `img,video{max-width:100%;height:auto}`，图片不会溢出，
  但**没写 width 的图会撑满容器宽度**。
- 商店 README 越长，首屏可见内容越少（实测 Tasks 只露 608 字符）。
- **15 个插件里 0 个有目录（TOC）**。
- 设置项说明、原理说明普遍**链到 docs**，README 里只列功能名 + 链接。
- License 普遍**一行链接**，从不贴全文。
- 语言切换行放在 H1 之后，当前语言加粗。

**改动**：

| 行数 | 改动前 | 改动后 |
|---|---|---|
| `README.md` | 144 行 / 4920 字节 | 60 行 |

1. **去掉插件图标**（5 个仓库全部）。徽章保留（shields.io 本身就是小图）。
2. **新建 `docs/user-guide.md`**（中文）/ `docs/user-guide.en.md`（英文）：
   把原本 README 里的完整内容搬过去 —— 设置项表、技术原理、开发说明、
   已知限制，一条不丢。
3. **README 重写**，结构统一为：
   H1 → 语言切换 → 一句话副标题 → 徽章 → 演示图 → 功能（每条链到 user-guide 对应小节）
   → 安装 → 文档 → 许可证。**4–8 个 H2**，不放 TOC。
4. **保留在 README 里的例外**（不能链走的内容）：

- **兼容性要求**（Obsidian 1.8.7+、桌面与移动端均支持）—— 影响用户能否安装，必须留在 README。
- **9 种界面语言**的切换链接保留在 README（它是插件功能之一，不是文档）。

5. **顺带修掉的问题**：无。

**验证**：
- 所有 README 内部链接与锚点用 GitHub 锚点算法**逐条校验，0 无效**。
- 所有 README 与 user-guide 的**编码完整**（0 个 U+FFFD 替换字符）。
- 各仓库 `npm run verify` 全绿（typecheck + lint 0 问题 + stylelint + vitest + build）。

**未解决/风险**：
- **未在真实 Obsidian 商店页面确认渲染效果**（本环境无 GUI，商店页面是客户端渲染，
  WebFetch 拿不到内容）。图标已移除，理论上不会再有「巨大图标」问题。
- 商店页面 README 的折叠阈值具体数值未测（调研只测到了字符数，未换算成行数）。

## 2026-11-06 补上声明式 render 契约守卫

**目标与完成内容**：新增 `test/settings-render-guard.test.ts`，
锁住 Obsidian 1.13+ 声明式渲染器的两条契约。

**背景**：fleet 里 `obsidian-adaptive-workspace` 与 `obsidian-jev-inbox-router`
已有这两条守卫，本仓库与 MSE、mineru 没有 —— 覆盖不一致。
本轮先补 folio 与 MSE（两者用 vitest，基建现成）。

**两条契约**：

- **`render()` 的返回值会被当作「行销毁前的清理函数」调用。**
  官方 d.ts（obsidian 1.14.4）：
  `render: (setting: Setting, group: SettingGroup) => void | (() => void)`。
  写成表达式体并返回非函数值 → Obsidian 当函数调用 →
  `TypeError: t is not a function` → **设置子页面永远打不开**。
  （社区插件 `PKM-er/obsidian-editing-toolbar` 4.1.6 的真实事故。）
- **自定义块必须画进还活着的容器。**
  `Setting` 结构是 `settingEl > (infoEl, controlEl)`；
  `setting.settingEl.empty()` 会把 controlEl 一起清掉（脱离 DOM），
  之后往 controlEl 画的内容**不会出现在页面上**。

**为什么这个仓库价值最高**：folio 的三个自定义区块（commands / features /
links）全部用表达式体 `render: (setting) => this.renderX(setting)` ——
正是事故的高发写法。

**为什么不用共享 mock**：`test/mocks/obsidian.ts` 的 `Setting` 桩只有
`controlEl`（没有 `settingEl` / `infoEl`），`empty()` 也不跟踪「脱离」状态。
「A 被清空导致 B 失效」这类缺陷在「每个属性都是独立对象」的朴素桩里
**天然查不出来** —— 所以自包含一个能跟踪脱离状态的 fake。

**反证（两个注入都当场失败，恢复后通过）**：

- 注入「render 返回组件对象」→
  `AssertionError: expected { fake: true } to be undefined`，2 例失败
- 注入「render 里调 `settingEl.empty()`」→
  `AssertionError: expected false to be true`，容器脱离用例失败

**验证**：`npm run verify` 全通过（typecheck → lint 0 问题 → stylelint →
test → build）；测试 **53 → 55**。

**未解决/风险**：
- **未在真实 Obsidian 里验证**（本环境无 GUI）。守卫能证明「返回值语义」
  与「容器未脱离」两条契约成立，但证明不了渲染结果的视觉正确性。
- **`obsidian-mineru` 尚未补这套守卫** —— 它的测试基建是自建的
  `node test/run.mjs` + `verify-*.ts`，没有 vitest 也没有 obsidian mock，
  要测 `settings.ts` 需先建 mock 基建，属结构性改动，本轮不做。
