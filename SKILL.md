---
name: daily-digest
description: 每日数字生活记录与知识沉淀工具。当用户提到"整理今天的记录"、"帮我记录"、"每日总结"、"今天做了什么"、"帮我回顾今天"、"生成日报"、"屏幕记录整理"、"Screenpipe"等关键词时，务必使用此技能。即使用户只是问"今天干了啥"或"帮我看看今天的工作内容"，也应触发此技能。此技能会从 Screenpipe 采集的屏幕数据中自动提取、分类、提炼用户的每日活动，生成结构化的知识沉淀记录，并输出为一个可交互的 React 单文件应用。
---

# Daily Digest — 每日数字生活知识沉淀

## 概述

本技能帮助用户将每天在电脑上的所有行为（浏览、生产、聊天）自动整理为结构化的知识沉淀记录。

**核心能力：**
- 从 Screenpipe（本地屏幕录制工具）API 拉取用户当日屏幕数据
- 用 AI 自动分类为 6 大类别
- 提炼每项活动的核心结论、重要资料、后续 TODO
- 估算每项活动的耗时
- 输出为一个交互式 React 单文件应用（Artifact），包含 24 小时时间分布可视化

---

## 前置条件

用户需要在电脑上安装并运行 Screenpipe：

```bash
# macOS
brew install screenpipe
screenpipe

# 验证
curl http://localhost:3030/health
```

如果用户还没有安装 Screenpipe，先引导用户完成安装（详见底部「Screenpipe 安装引导」章节），然后再执行整理。

如果 Screenpipe 不可用（未安装或未运行），仍然可以让用户口述今天的活动，手动整理。

---

## 工作流程

### 第一步：获取屏幕数据

通过 Claude in Chrome 或 MCP 标签组访问 Screenpipe API：

```
GET http://localhost:3030/search?q=&limit=200&start_time={YYYY-MM-DD}T00:00:00Z&end_time={YYYY-MM-DD}T23:59:59Z&content_type=ocr
```

如果用户指定了时间范围（如"整理下午的内容"），调整 start_time 和 end_time。

API 返回的每条数据格式：
```json
{
  "type": "OCR",
  "content": {
    "frame_id": 123,
    "text": "屏幕上的OCR文字...",
    "timestamp": "2026-03-11T09:43:21Z",
    "app_name": "Google Chrome",
    "window_name": "窗口标题"
  }
}
```

### 第二步：分析和分类

将获取到的屏幕数据按以下规则处理：

**去重和聚合：**
- 按 `app_name + window_name` 聚合同一窗口的多个帧
- 合并时间上连续的同一活动
- 忽略系统噪音（控制中心、Dock、菜单栏、空帧）

**分类体系（6 大类别）：**

| id | 名称 | 颜色 | 识别规则 |
|---|---|---|---|
| work | 工作 | #8BC6A4 | 公司内部工具（学城、大象、Ones等）、工作文档、设计工具中的工作项目、工作聊天 |
| ux_design | 体验设计 | #C4A4D4 | 设计文章/教程、Figma 中的学习项目、UX 方法论相关 |
| ai_learn | AI学习 | #E8B87A | ChatGPT/Claude 使用、AI 工具配置、AI 相关文章 |
| invest_news | 投资资讯 | #89C4CB | 财经新闻、金融平台（智堡、东财等）、市场数据 |
| invest_learn | 投资知识 | #92B4DC | 投资理论学习、金融课程、分析方法研究 |
| entertainment | 娱乐 | #E8A0A0 | 视频、社交媒体非工作内容、游戏 |

**内容类型：**
- `browse`（浏览）：阅读文章、查看网页、浏览文档
- `produce`（生产）：写文档、编辑设计稿、写代码、整理笔记
- `chat`（聊天）：即时通讯对话（大象、微信、Slack 等）

**耗时估算规则：**
- 根据同一 app_name + window_name 在时间线上连续出现的帧数和时间跨度估算
- 短暂切换（< 30s）不计入
- 同一活动中穿插短暂其他操作，仍算连续

### 第三步：生成每条记录

对每个识别出的活动，提炼以下字段：

```javascript
{
  id: "ai_时间戳_序号",
  title: "简短标题",           // 简洁描述活动，15字以内
  cat: "work",                // 分类 id
  typ: "browse",              // 内容类型
  dur: 30,                    // 耗时（分钟）
  sum: "1-2句话摘要",          // 概括做了什么
  take: "核心结论",            // 最重要的收获/结论
  res: "重要链接\n每行一个",   // 相关资料和链接
  todo: "待办事项\n每行一个",  // 需要跟进的事
  time: "下午/17:30/凌晨",    // 大致时间
  ts: Date.now() + 序号       // 排序用时间戳
}
```

### 第四步：输出 React 应用

使用 `create_file` 将完整的 React 单文件应用保存到 `/mnt/user-data/outputs/daily-journal.jsx`，然后用 `present_files` 呈现给用户。

应用必须包含以下完整功能模块（详见下方「应用规格」章节）。

---

## 应用规格

### 技术要求

- React 单文件组件，使用 `useState`、`useEffect`、`useCallback`、`useRef`
- 使用 `window.storage` API 持久化数据（Claude Artifacts 环境）
- 零外部依赖
- 支持中文界面

### 数据结构

```javascript
// 按日期存储，key 为 YYYY-MM-DD
{
  "2026-03-11": [entry1, entry2, ...],
  "2026-03-12": [entry3, entry4, ...]
}
```

### UI 布局（紧凑高效风格）

```
┌─────────────────────────────────────────────┐
│  ‹ 3月11日 周二 ›                    今天     │ ← 日期行（可点击弹出日历选择器）
├─────────────────────────────────────────────┤
│  [⚡ 生成今日记录]    拉取数据中...            │ ← 一键生成按钮
├─────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░░░░░░░░░░░░           │ ← 24h 时间分布条
│  ■工作 2h55m  ■AI学习 1h25m  空闲 19h32m    │ ← 图例
├─────────────────────────────────────────────┤
│  全部 工作5 AI学习3 投资资讯2    10条·10结论   │ ← 分类筛选 + 统计
├─────────────────────────────────────────────┤
│  工作  Keeta客服Session分析    1h30m  下午 编辑│ ← 记录行
│        Notion整理走查核心结论...                │    摘要
│        结论 用户在各页面间反复跳转耗时久...      │    核心结论（黑色字）
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  工作  学城 — 服务门户2.0          25m  下午   │
│        ...                                   │
└─────────────────────────────────────────────┘
                                          [+] ← 手动添加按钮
```

### 视觉设计规范

**色彩：** 低饱和度马卡龙色系

| 元素 | 颜色 |
|------|------|
| 工作 | `#8BC6A4`（薄荷绿）|
| 体验设计 | `#C4A4D4`（淡紫）|
| AI学习 | `#E8B87A`（奶茶橘）|
| 投资资讯 | `#89C4CB`（雾蓝）|
| 投资知识 | `#92B4DC`（天蓝）|
| 娱乐 | `#E8A0A0`（樱粉）|
| 背景 | `#FFFFFF` |
| 分割线 | `#F5F5F5` |
| 标题文字 | `#1A1A1A` |
| 摘要文字 | `#999999` |
| 结论文字 | `#1A1A1A`（黑色，醒目）|
| 结论标签 | `#BBBBBB` |

**字体：** `-apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif`

**布局原则：**
- 紧凑高效，无多余装饰
- 每条记录占 3-4 行：分类+标题+时长+时间为第一行，摘要第二行，结论第三行
- 点击整行可展开显示资料和 TODO
- URL 自动识别为可点击链接

### 核心功能

1. **「⚡ 生成今日记录」按钮**
   - 点击后调用 Screenpipe API 拉取数据
   - 调用 Claude API（`claude-sonnet-4-20250514`）分析分类
   - 状态反馈：拉取中 → 分析中 → 完成/失败
   - 生成的记录自动替换当日 AI 生成的旧记录

2. **24 小时时间分布条**
   - 横条总长代表 24 小时
   - 每个分类按 dur 总和占比填充对应颜色
   - 未记录时间留白（灰色底），显示"空闲 xxhxxm"

3. **日期导航**
   - 左右箭头切换日期
   - 点击日期文字弹出日历下拉面板
   - "今天"快捷入口在日期行最右侧

4. **分类筛选**
   - 只显示有数据的分类
   - 点击切换筛选，再点取消
   - 同行右侧显示统计：条数 · 结论数 · 待办数

5. **设置面板**
   - 可配置 Screenpipe 地址（默认 `http://localhost:3030`）

6. **手动添加/编辑**
   - 右下角 + 按钮弹出表单
   - 支持编辑和删除已有记录

### 一键生成按钮的实现逻辑

```javascript
async function handleGenerate() {
  // 1. 从 Screenpipe 拉取数据
  const spData = await fetch(`${screenpipeUrl}/search?q=&limit=200&start_time=${date}T00:00:00Z&end_time=${date}T23:59:59Z&content_type=ocr`).then(r => r.json());

  // 2. 去重聚合（按 app_name + window_name）
  // 3. 构建 prompt，要求 Claude 返回 JSON 数组
  // 4. 调用 Claude API（使用 Anthropic API in Artifacts）
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  // 5. 解析返回的 JSON 数组，存入当日记录
}
```

---

## Screenpipe 安装引导

如果用户还没有安装 Screenpipe，按以下步骤引导：

### macOS

```bash
brew install screenpipe
screenpipe
```

首次启动需授权：系统设置 → 隐私与安全 → 屏幕录制 + 麦克风 → 允许 screenpipe

### 设置开机自启动（macOS）

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

### Windows

```powershell
iwr https://raw.githubusercontent.com/screenpipe/screenpipe/main/install.ps1 | iex
screenpipe
```

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/screenpipe/screenpipe/main/install.sh | sh
screenpipe
```

### 验证

```bash
curl http://localhost:3030/health
# 应返回 {"status":"healthy",...}
```

---

## 无 Screenpipe 时的降级方案

如果用户没有安装 Screenpipe 或 Screenpipe 未运行：

1. 询问用户今天大致做了什么
2. 根据口述内容手动分类和提炼
3. 仍然输出相同格式的 React 应用
4. 在应用中的生成按钮旁提示"Screenpipe 未连接，请手动添加记录"

---

## 输出说明

生成应用后，向用户简要说明：
1. 已从 Screenpipe 拉取 X 条数据，生成 Y 条结构化记录
2. 点击「⚡ 生成今日记录」可随时刷新
3. 数据跨会话持久化保存
4. 可通过分类标签筛选查看
5. 点击记录行可展开查看资料和 TODO
