#!/bin/bash
# Daily Digest - Screenpipe 一键配置脚本 (macOS)
# 用法: chmod +x setup-screenpipe.sh && ./setup-screenpipe.sh

set -e

echo "🧠 Daily Digest - Screenpipe 配置工具"
echo "========================================"
echo ""

# 1. 检查 Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ 未检测到 Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew 已安装"
fi

# 2. 安装 Screenpipe
if command -v screenpipe &> /dev/null; then
    echo "✅ Screenpipe 已安装 ($(screenpipe --version 2>/dev/null || echo 'version unknown'))"
else
    echo "📦 正在安装 Screenpipe..."
    brew install screenpipe
    echo "✅ Screenpipe 安装完成"
fi

# 3. 设置开机自启动
echo ""
read -p "是否设置 Screenpipe 开机自启动？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    PLIST_PATH="$HOME/Library/LaunchAgents/com.screenpipe.plist"
    SCREENPIPE_PATH=$(which screenpipe)

    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.screenpipe</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SCREENPIPE_PATH}</string>
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
PLIST

    launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "✅ 开机自启动已配置"
    echo "   关闭自启动: launchctl unload $PLIST_PATH"
fi

# 4. 启动并检查
echo ""
echo "🚀 正在等待 Screenpipe 启动..."
sleep 3

for i in {1..10}; do
    if curl -s http://localhost:3030/health | grep -q "healthy"; then
        echo "✅ Screenpipe 运行正常！"
        echo ""
        echo "📊 API 地址: http://localhost:3030"
        echo "🔍 搜索接口: http://localhost:3030/search?q=关键词"
        echo "💾 数据目录: ~/.screenpipe/data/"
        echo ""
        echo "========================================"
        echo "✨ 配置完成！"
        echo ""
        echo "接下来："
        echo "  1. 打开 claude.ai"
        echo "  2. 说：帮我整理今天的记录"
        echo "  3. Claude 会从 Screenpipe 拉取数据并自动整理"
        exit 0
    fi
    echo "   等待中... ($i/10)"
    sleep 2
done

echo "⚠️  Screenpipe 可能还在启动中。"
echo "   请手动运行: screenpipe"
echo "   然后验证: curl http://localhost:3030/health"
