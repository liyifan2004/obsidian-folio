# Dual Pane Sync View

[![GitHub release](https://img.shields.io/github/v/release/yourusername/obsidian-dual-pane-sync)](https://github.com/yourusername/obsidian-dual-pane-sync/releases)
[![License](https://img.shields.io/github/license/yourusername/obsidian-dual-pane-sync)](LICENSE)

> A plugin for [Obsidian](https://obsidian.md) that provides a seamless dual-pane reading experience with bidirectional scrolling.

**[English](README.md)** | [简体中文](docs/i18n/README.zh.md) | [繁體中文](docs/i18n/README.zh-TW.md) | [日本語](docs/i18n/README.ja.md) | [한국어](docs/i18n/README.ko.md) | [Français](docs/i18n/README.fr.md) | [Deutsch](docs/i18n/README.de.md) | [Español](docs/i18n/README.es.md) | [العربية](docs/i18n/README.ar.md)

---

## 📖 Overview

**Dual Pane Sync View** creates a synchronized dual-pane reading environment in Obsidian:

- **Left Pane**: Your native Obsidian editor/preview with full editing capabilities
- **Right Pane**: Automatically splits and displays the continuation of your content
- **Bidirectional Scrolling**: Scroll either pane, and the other follows automatically
- **Mode Adaptive**: Seamlessly switches between edit and preview modes

Perfect for reading long documents, comparing sections, or editing while referencing earlier content.

---

## ✨ Features

### 🔄 Bidirectional Synchronization
- Scroll the left pane → Right pane follows showing continuation
- Scroll the right pane → Left pane follows showing previous content
- Smooth 60fps scrolling performance

### 📝 Full Native Editing
- Left pane remains fully editable with all Obsidian features
- All plugins work normally (Vim mode, themes, etc.)
- Syntax highlighting and live preview

### 🎨 Adaptive Mode Switching
- Left pane switches between Edit/Preview mode → Right pane adapts automatically
- No interruption to the sync experience

### ⚙️ Customizable Overlap
- Adjust overlapping lines between panes (0-10 lines)
- Prevents toolbar from obscuring content
- Default: 2 lines overlap

### ⌨️ Hotkey Support
- Configure custom hotkeys for page navigation
- Single page up/down
- Double page up/down for quick browsing

---

## 🚀 Installation

### From Obsidian Community Plugins

1. Open **Settings** → **Community Plugins**
2. Turn off **Safe Mode**
3. Click **Browse** and search for "Dual Pane Sync View"
4. Click **Install**
5. Enable the plugin

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/yourusername/obsidian-dual-pane-sync/releases)
2. Extract the files to your vault's plugins folder: `<vault>/.obsidian/plugins/obsidian-dual-pane-sync/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

---

## 🎯 Usage

### Quick Start

1. Open any Markdown note in Obsidian
2. Click the **📑 Columns icon** in the left ribbon
3. The right pane automatically splits and follows your scrolling

### Hotkey Configuration

1. Open **Settings** → **Hotkeys**
2. Search for "Dual Pane Sync"
3. Bind your preferred keys:
   - **Toggle**: Enable/disable follow mode
   - **Page Up/Down**: Navigate by one screen
   - **Double Page**: Navigate by two screens (fast browsing)

**Recommended hotkeys:**
- `Page Up` / `Page Down`
- `Ctrl + ↑` / `Ctrl + ↓`
- `Cmd + ↑` / `Cmd + ↓` (Mac)

### Adjusting Overlap

1. Open **Settings** → **Dual Pane Sync View**
2. Adjust the **Overlap Lines** slider
3. Changes apply immediately

**Tip:** If the toolbar obscures content, increase the overlap to 3-4 lines.

---

## ⚙️ Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Overlap Lines** | Number of overlapping lines between panes | 2 |

---

## 📸 Screenshots

### Edit Mode
```
┌───────────────────────┬───────────────────────┐
│  Left: Edit Mode      │  Right: Edit Mode     │
│  (Fully editable)     │  (Shows continuation) │
│                       │                       │
│  ## Introduction      │  ## Getting Started   │
│  This is the start... │  To begin using...    │
│                       │                       │
└───────────────────────┴───────────────────────┘
```

### Preview Mode
```
┌───────────────────────┬───────────────────────┐
│  Left: Preview        │  Right: Preview       │
│  (Rendered view)      │  (Shows continuation) │
│                       │                       │
│  # Document Title     │  ## Next Section      │
│  Introduction text... │  More content...      │
│                       │                       │
└───────────────────────┴───────────────────────┘
```

---

## 🛠️ For Developers

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-dual-pane-sync.git

# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode (with hot-reload)
npm run dev
```

### Project Structure

```
obsidian-dual-pane-sync/
├── src/
│   ├── followMode.ts      # Core follow mode logic
│   ├── settings.ts        # Settings UI
│   ├── i18n.ts           # Internationalization
│   └── types.ts          # Type definitions
├── docs/i18n/            # Localized READMEs
├── main.ts               # Plugin entry
├── manifest.json         # Plugin manifest
└── README.md             # This file
```

---

## 🌍 Localization

This plugin supports 9 languages:

- 🇺🇸 English (Default)
- 🇨🇳 简体中文
- 🇹🇼 繁體中文
- 🇯🇵 日本語
- 🇰🇷 한국어
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇸🇦 العربية

The plugin automatically detects your Obsidian language setting.

---

## 📝 Changelog

### v1.0.0
- Initial release
- Bidirectional scroll synchronization
- Support for 9 languages
- Hotkey support
- Customizable overlap

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Reporting Issues

If you find a bug or have a suggestion:
1. Check if the issue already exists
2. Create a new issue with a clear description
3. Include steps to reproduce (for bugs)

---

## 📄 License

[MIT License](LICENSE) © 2024 [Your Name]

---

## 🙏 Acknowledgments

- Thanks to the Obsidian team for the amazing platform
- Thanks to the Obsidian community for feedback and suggestions

---

<div align="center">

**[⬆ Back to Top](#dual-pane-sync-view)**

Made with ❤️ for the Obsidian community

</div>
