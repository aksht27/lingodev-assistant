# GlobalDev Assistant

![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D1.106.0-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg) ![License](https://img.shields.io/badge/License-MIT-yellow.svg) ![LingoHack25](https://img.shields.io/badge/LingoHack25-WeMakeDevs-orange.svg)

**AI-powered VS Code extension that automates localization directly in your workflow.**

Built for [LingoHack25](https://www.wemakedevs.org/hackathons/lingohack25) • Integrates Lingo CLI, SDK, and MCP for real-time i18n assistance without leaving your IDE.

## The Problem

Developers hardcode strings, then spend 7-16 hours manually extracting, creating keys, and resolving merge conflicts when adding i18n.

**GlobalDev Assistant automates this in 5-10 minutes.**

## Features

- 🔍 **Real-time Detection** — Auto-highlight hardcoded strings (Lingo MCP)
- ⚡ **One-click Extraction** — Move to Lingo CLI managed files instantly
- 🤖 **AI Translation** — Context-aware translation via Lingo CLI/SDK
- 🌐 **Live Preview** — See translations in browser without leaving IDE
- 🔄 **CI/CD Ready** — Automated workflows with GitHub Actions/GitLab

## Quick Start

```bash
# 1. Install extension
code --install-extension lingodev.lingodev-assistant

# 2. Initialize Lingo in your project
npx lingo.dev@latest init

# 3. Extract strings
# Select text → Ctrl+Shift+P → "GlobalDev: Extract Selected String"
```

**Example:**
```typescript
// Before
const greeting = "Hello, welcome!";

// After
const greeting = t('welcome_greeting');
```

**Supported:** JavaScript, TypeScript, JSX, TSX • React, Vue, Angular, Next.js, Nuxt.js • react-i18next, vue-i18n, i18next • JSON, YAML

## How It Works

**Lingo Products Integrated:**
- **CLI** — String extraction & file management
- **SDK** — Runtime translation & live preview
- **MCP** — AI-powered code analysis

```
Code → Lingo MCP (detect) → Lingo CLI (extract) → Lingo SDK (preview) → CI/CD
```

## Roadmap

**Current:** Lingo CLI extraction • MCP detection • SDK preview • AI translation  
**Next:** CI/CD templates • Multi-IDE support  
**Future:** [Lingo Compiler](https://lingo.dev/en/compiler) integration for build-time AST compilation (zero-config React i18n)

## Hackathon Info

**LingoHack25** by WeMakeDevs • Solo Project by Akshat Gupta • November 2024

| Product | Status | Purpose |
|---------|--------|----------|
| Lingo CLI | ✅ Active | String extraction & file management |
| Lingo SDK | ✅ Active | Live browser preview |
| Lingo MCP | ✅ Active | AI code analysis |
| Lingo Compiler | 🔮 Future | Build-time AST compilation |

## License & Support

MIT License • Built during LingoHack25 hackathon  
[📚 Docs](https://docs.lingo.dev) • [🐛 Issues](https://github.com/akshatgupta/globaldev-assistant/issues) • [💬 Discord](https://discord.gg/wemakedevs)

---

<div align="center">

[⭐ Star on GitHub](https://github.com/akshatgupta/lingodev-assistant) • [🏆 LingoHack25](https://www.wemakedevs.org/hackathons/lingohack25)

*Built with ❤️ by Akshat Gupta using Lingo CLI, SDK & MCP*

</div>
