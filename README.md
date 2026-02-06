# Dual Pane Sync View - 双栏同步阅读插件

一个为 Obsidian 设计的双栏同步阅读插件，让你在大屏幕上更高效地阅读长文档。

## 功能特性

### 🖥️ 双栏连续阅读
- 左右两栏显示同一篇文档的连续内容
- 左栏显示前半部分时，右栏自动显示接续的后半部分
- 充分利用超宽屏/4K显示器的横向空间

### 🔄 同步滚动
- 在任何一侧滚动，另一侧同步跟随
- 保持两侧内容的连续性
- 可在工具栏开关同步功能

### ⌨️ 快捷键翻页
- `Page Down` / `空格键`: 下一页
- `Page Up`: 上一页
- 支持命令面板操作

## 安装方法

### 开发模式安装

1. 将你的 Obsidian 插件文件夹克隆/复制到 vault 的插件目录：
   ```
   <你的Vault>/.obsidian/plugins/dual-pane-sync-view/
   ```

2. 确保包含以下文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`

3. 在 Obsidian 中启用插件：
   - 打开设置 → 第三方插件
   - 开启"Dual Pane Sync View"

## 使用方法

### 打开双栏视图

**方式一：功能区图标**
- 点击左侧功能区中的 "📑" (columns) 图标

**方式二：命令面板**
- `Ctrl+P` 打开命令面板
- 搜索 "打开双栏同步视图"

**方式三：从当前笔记打开**
- `Ctrl+P` 打开命令面板
- 搜索 "在当前笔记打开双栏视图"

### 翻页操作

| 操作 | 方式 |
|------|------|
| 下一页 | 点击"下一页"按钮 / PageDown / 空格 |
| 上一页 | 点击"上一页"按钮 / PageUp |
| 切换同步 | 工具栏"同步滚动"复选框 |

## 文件结构

```
obsidian_view_sync/
├── main.ts              # 主插件入口
├── main.js              # 编译后的插件 (构建生成)
├── manifest.json        # 插件清单
├── styles.css           # 样式文件
├── src/
│   └── dualPaneView.ts  # 双栏视图核心实现
├── package.json         # npm 配置
├── tsconfig.json        # TypeScript 配置
└── esbuild.config.mjs   # 构建配置
```

## 开发

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
cd obsidian_view_sync
npm install
```

### 开发模式（热重载）
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

## 技术实现

### 核心思路
1. **自定义视图**: 继承 `ItemView` 创建双栏阅读视图
2. **Markdown 渲染**: 使用 `MarkdownRenderer.render()` 渲染文档内容
3. **滚动同步**: 通过监听 `scroll` 事件，计算滚动比例并同步到另一侧
4. **分页逻辑**: 基于面板高度计算翻页步长

### 关键类

#### `DualPaneSyncPlugin`
- 插件主类，管理生命周期
- 注册命令和视图
- 处理用户交互

#### `DualPaneSyncView`
- 双栏视图实现
- 负责内容渲染和滚动同步
- 提供翻页功能

## 设置选项

在 `main.ts` 中的 `DualPanePluginSettings` 可以配置：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `scrollSyncEnabled` | 是否启用滚动同步 | `true` |
| `pageScrollStep` | 翻页步长比例 | `0.9` (90% 面板高度) |

## 兼容性

- **Obsidian 版本**: v0.15.0+
- **平台**: 桌面端 & 移动端
- **主题**: 适配所有官方主题和大多数社区主题

## 未来计划

- [ ] 支持双栏编辑模式
- [ ] 自定义栏宽比例
- [ ] 双栏对比模式（对比两个文档）
- [ ] 记住每个文档的阅读位置
- [ ] 更多分页动画效果

## 许可证

MIT License
