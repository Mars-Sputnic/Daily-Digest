# Daily Digest 🧠

**自动采集你每天在电脑上的所有行为，AI 智能分类、提炼核心结论、生成待办事项。**

一套完整的「Screenpipe + Claude AI」知识沉淀工作流。Screenpipe 负责 24/7 录屏采集，Claude 负责智能分类与提炼，最终呈现在一个极简的日记视图中。

---

## 核心功能

- **全自动屏幕采集** — Screenpipe 在后台录屏、OCR 文字提取、音频转录，零操作
- **AI 智能分类** — 自动将内容归类为：工作 / 体验设计 / AI学习 / 投资资讯 / 投资知识 / 娱乐
- **核心结论提炼** — 从每项活动中提取最重要的信息
- **待办事项生成** — 自动生成后续需要跟进的 TODO
- **时间追踪** — 每项活动记录耗时，24 小时时间条可视化展示分类占比
- **持久化存储** — 数据跨会话保存，支持按日浏览历史记录
- **可点击链接** — 资料中的 URL 自动识别为可点击链接

---

## 架构

```
┌─────────────────────────────────────────────┐
│                 你的电脑                      │
│                                             │
│  ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │Screenpipe│───▶│ Claude   │───▶│ Daily  │ │
│  │ 24/7录屏 │    │ AI 提炼  │    │ Digest │ │
│  │ OCR+音频 │    │ 分类+结论│    │ 日记UI │ │
│  └──────────┘    └──────────┘    └────────┘ │
│   localhost:3030       ▲                     │
│                        │                     │
│                  你说一句话：                  │
│              "帮我整理今天的记录"              │
└─────────────────────────────────────────────┘
```

---

## 快速开始

### 1. 安装 Screenpipe（免费开源）

**macOS（推荐 Homebrew）：**

```bash
brew install screenpipe
```

**Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/screenpipe/screenpipe/main/install.sh | sh
```

**Windows（PowerShell）：**

```powershell
iwr https://raw.githubusercontent.com/screenpipe/screenpipe/main/install.ps1 | iex
```

> 详见 [Screenpipe 官方文档](https://docs.screenpi.pe/getting-started)

### 2. 启动 Screenpipe

```bash
screenpipe
```

首次启动需要授权：
- **macOS**：系统设置 → 隐私与安全 → 屏幕录制 → 允许 screenpipe
- **macOS**：系统设置 → 隐私与安全 → 麦克风 → 允许 screenpipe

验证是否正常运行：

```bash
curl http://localhost:3030/health
```

返回 `"status":"healthy"` 即表示运行正常。

### 3. 设置开机自启动（macOS）

```bash
cat > ~/Library/LaunchAgents/com.screenpipe.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.screenpipe</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/screenpipe</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/screenpipe.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/screenpipe.err</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.screenpipe.plist
```

关闭自启动：

```bash
launchctl unload ~/Library/LaunchAgents/com.screenpipe.plist
```

### 4. 使用 Daily Digest UI

`src/App.jsx` 是一个 React 组件，可以在以下环境中使用：

**方式一：在 Claude.ai Artifacts 中使用（推荐）**

1. 打开 [claude.ai](https://claude.ai)
2. 在对话中让 Claude 创建一个 Artifact，把 `src/App.jsx` 的内容粘贴进去
3. Artifact 会自动渲染，数据通过 `window.storage` 持久化

**方式二：集成到你自己的 React 项目**

```bash
npm install react react-dom
```

```jsx
import DailyDigest from './App.jsx';

function MyApp() {
  return <DailyDigest />;
}
```

> 注意：需要实现 `window.storage` 接口（get/set/delete/list），或替换为 localStorage。

### 5. 一键生成当日记录

打开 Daily Digest 界面后，点击 **「⚡ 生成今日记录」** 按钮，系统会自动：

1. 从 Screenpipe API 拉取当天的屏幕数据
2. 调用 Claude API 智能分析
3. 自动按 6 大分类归类
4. 提炼每项活动的核心结论
5. 生成后续 TODO 和耗时估算
6. 保存到当日记录中

全程无需手动操作，也不需要在 Claude 对话中输入任何指令。

> **设置 Screenpipe 地址：** 点击界面右上角「设置」，确认 Screenpipe 地址正确（默认 `http://localhost:3030`）。

你也可以在 Claude 对话中说「帮我整理今天的记录」，效果相同。

---

## Screenpipe API 常用接口

| 接口 | 说明 |
|------|------|
| `GET /health` | 检查服务状态 |
| `GET /search?q=关键词&limit=50` | 搜索屏幕内容 |
| `GET /search?q=&start_time=2026-03-11T00:00:00Z&end_time=2026-03-11T23:59:59Z&content_type=ocr` | 按时间范围查询 |
| `GET /search?app_name=Google Chrome&limit=20` | 按应用筛选 |

更多接口参考 [Screenpipe API 文档](https://docs.screenpi.pe)。

---

## 自定义分类

编辑 `src/App.jsx` 顶部的 `CAT` 数组即可自定义分类：

```javascript
const CAT = [
  { id: "work", l: "工作", c: "#8BC6A4" },
  { id: "ux_design", l: "体验设计", c: "#C4A4D4" },
  { id: "ai_learn", l: "AI学习", c: "#E8B87A" },
  { id: "invest_news", l: "投资资讯", c: "#89C4CB" },
  { id: "invest_learn", l: "投资知识", c: "#92B4DC" },
  { id: "entertainment", l: "娱乐", c: "#E8A0A0" },
];
```

- `id`：分类唯一标识
- `l`：显示名称
- `c`：颜色（推荐使用低饱和度马卡龙色）

---

## 数据存储

- **Screenpipe 数据**：`~/.screenpipe/data/`（本地 SQLite + mp4 文件）
- **Daily Digest 数据**：通过 `window.storage` API 持久化（Claude.ai Artifacts 环境下跨会话保存）
- **磁盘占用**：Screenpipe 约 20-30GB/月，可设置自动清理

---

## 隐私与安全

- 所有数据 100% 存储在本地，不上传任何服务器
- Screenpipe 是开源软件（MIT 协议），代码完全可审计
- 你可以随时在系统设置中关闭屏幕录制权限
- 停止录制：`Ctrl+C`（手动模式）或 `launchctl unload`（自启动模式）

---

## 常见问题

**Q: Screenpipe 占用多少 CPU/内存？**

通常 CPU < 20%，内存约 1GB。它采用智能截屏策略，只在屏幕内容变化时才截图。

**Q: 我可以排除某些应用不被录制吗？**

可以。Screenpipe 支持通过配置排除特定应用。参考 [Screenpipe 配置文档](https://docs.screenpi.pe)。

**Q: 可以在没有 Claude 的情况下使用吗？**

可以。Daily Digest UI 支持手动添加记录（点击右下角 + 按钮）。Screenpipe 也可以独立使用其内置搜索功能。

**Q: 如何清理 Screenpipe 的历史数据？**

```bash
# 删除 30 天前的数据
find ~/.screenpipe/data -name "*.mp4" -mtime +30 -delete
```

**Q: Windows 用户怎么设置自启动？**

创建一个快捷方式放到启动文件夹：
1. 按 `Win+R`，输入 `shell:startup`
2. 创建 `screenpipe.bat` 文件，内容为 `screenpipe`

---

## 技术栈

- **采集层**：[Screenpipe](https://github.com/screenpipe/screenpipe)（Rust，开源 MIT）
- **智能层**：[Claude AI](https://claude.ai)（Anthropic）
- **UI 层**：React（单文件组件，零依赖）
- **存储**：本地持久化（window.storage / localStorage）

---

## 许可证

MIT License

---

## 致谢

- [Screenpipe](https://github.com/screenpipe/screenpipe) — 开源 24/7 屏幕录制引擎
- [Anthropic Claude](https://claude.ai) — AI 智能分类与提炼
