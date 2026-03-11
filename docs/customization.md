# 自定义指南

## 修改分类

编辑 `src/App.jsx` 顶部的 `CAT` 数组：

```javascript
const CAT = [
  { id: "work", l: "工作", c: "#8BC6A4" },        // 薄荷绿
  { id: "ux_design", l: "体验设计", c: "#C4A4D4" }, // 淡紫
  { id: "ai_learn", l: "AI学习", c: "#E8B87A" },    // 奶茶橘
  { id: "invest_news", l: "投资资讯", c: "#89C4CB" },// 雾蓝
  { id: "invest_learn", l: "投资知识", c: "#92B4DC" },// 天蓝
  { id: "entertainment", l: "娱乐", c: "#E8A0A0" },  // 樱粉
];
```

你可以任意增删分类。推荐使用低饱和度的马卡龙色。

一些可参考的马卡龙色号：

| 颜色 | Hex | 适合场景 |
|------|-----|---------|
| 薄荷绿 | `#8BC6A4` | 工作、生产力 |
| 淡紫 | `#C4A4D4` | 设计、创意 |
| 奶茶橘 | `#E8B87A` | 学习、成长 |
| 雾蓝 | `#89C4CB` | 信息、资讯 |
| 天蓝 | `#92B4DC` | 知识、研究 |
| 樱粉 | `#E8A0A0` | 娱乐、休闲 |
| 芋泥紫 | `#B8A9C9` | 个人思考 |
| 柠檬黄 | `#E8D97A` | 运动、健康 |
| 豆沙粉 | `#D4A4A4` | 社交、沟通 |

## 修改内容类型

编辑 `TYP` 数组：

```javascript
const TYP = [
  { id: "browse", l: "浏览" },
  { id: "produce", l: "生产" },
  { id: "chat", l: "聊天" },
];
```

## 替换存储后端

默认使用 `window.storage`（Claude.ai Artifacts 环境）。如果要在其他环境使用，替换 `ld()` 和 `sv()` 函数：

### 使用 localStorage

```javascript
async function ld() {
  try {
    const d = localStorage.getItem("daily-digest");
    return d ? JSON.parse(d) : {};
  } catch { return {}; }
}

async function sv(d) {
  try {
    localStorage.setItem("daily-digest", JSON.stringify(d));
  } catch {}
}
```

### 使用后端 API

```javascript
async function ld() {
  const res = await fetch('/api/entries');
  return res.json();
}

async function sv(d) {
  await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });
}
```

## Screenpipe 高级配置

### 排除特定应用

在 Screenpipe 配置中排除不需要录制的应用：

```bash
screenpipe --ignored-windows "密码" --ignored-windows "银行"
```

### 调整截屏频率

```bash
screenpipe --fps 0.5  # 每 2 秒截一次（默认约 1fps）
```

### 限制存储空间

设置自动清理：

```bash
# 添加到 crontab，每天凌晨 3 点清理 30 天前的数据
echo "0 3 * * * find ~/.screenpipe/data -name '*.mp4' -mtime +30 -delete" | crontab -
```
