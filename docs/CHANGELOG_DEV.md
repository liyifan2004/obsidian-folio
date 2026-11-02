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
