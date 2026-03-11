# Daily Digest 🧠

Screenpipe + Claude AI 驱动的每日数字生活知识沉淀工具。

自动采集电脑屏幕活动 → AI 智能分类 → 提炼核心结论 → 生成待办事项

## 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/daily-digest)

或手动部署：

```bash
git clone https://github.com/YOUR_USERNAME/daily-digest.git
cd daily-digest
# 直接用任何静态服务器
npx serve .
```

## 使用

1. 打开网站
2. 点击右上角「设置」，填入 [Anthropic API Key](https://console.anthropic.com/settings/keys)
3. 电脑上安装 Screenpipe：`brew install screenpipe && screenpipe`
4. 点击「⚡ 生成今日记录」

## 技术栈

- 纯 HTML 单文件，零构建
- React 18（CDN）
- localStorage 持久化
- Screenpipe API（本地 localhost:3030）
- Anthropic Claude API（直接浏览器调用）

## License

MIT
