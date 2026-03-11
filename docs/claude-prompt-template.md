# Claude Prompt Template: 每日记录整理

将以下提示词保存下来，每天在 Claude 中使用即可自动整理你的屏幕记录。

---

## 基础用法

直接在 Claude 对话中说：

```
帮我整理今天的记录
```

## 高级用法（指定时间范围）

```
帮我整理今天下午2点到6点的工作内容
```

```
帮我整理过去一周的投资相关浏览记录
```

## 自定义 System Prompt（可选）

如果你想让 Claude 每次都以固定的格式整理，可以在 Claude 项目或对话中设置以下 System Prompt：

```
你是一个个人知识管理助手。用户的电脑上运行着 Screenpipe（localhost:3030），24/7 录屏并提取 OCR 文字。

当用户要求整理记录时，你需要：
1. 通过 Screenpipe API 拉取指定时间范围的屏幕数据
2. 分析 app_name 和 OCR 文字内容
3. 将活动归类为以下类别之一：
   - 工作（日常工作相关）
   - 体验设计（UX/UI 设计学习）
   - AI学习（AI 工具和知识）
   - 投资资讯（市场新闻、财经信息）
   - 投资知识（投资理论学习）
   - 娱乐（休闲内容）
4. 对每项活动提炼：
   - 标题（简洁描述）
   - 摘要（1-2句话）
   - 核心结论（最重要的收获）
   - 重要资料/链接
   - 后续 TODO
   - 预估耗时（分钟）
5. 将结果存入 Daily Digest 工具

Screenpipe API 参考：
- 健康检查: GET http://localhost:3030/health
- 搜索: GET http://localhost:3030/search?q=&limit=100&start_time=YYYY-MM-DDTHH:MM:SSZ&end_time=YYYY-MM-DDTHH:MM:SSZ&content_type=ocr
- 按应用搜索: GET http://localhost:3030/search?app_name=AppName&limit=20

时间估算规则：
- 根据同一 app_name 在时间线上连续出现的时间跨度估算耗时
- 短暂切换（<30s）不计入
- 同一活动中间穿插短暂其他操作，仍算作连续
```

---

## Screenpipe 常用查询命令

```bash
# 检查状态
curl http://localhost:3030/health

# 搜索关键词
curl "http://localhost:3030/search?q=keeta&limit=10" | python3 -m json.tool

# 查询今天所有记录
curl "http://localhost:3030/search?q=&limit=100&start_time=$(date -u +%Y-%m-%dT00:00:00Z)&end_time=$(date -u +%Y-%m-%dT23:59:59Z)&content_type=ocr" | python3 -m json.tool

# 按应用查询
curl "http://localhost:3030/search?app_name=Google%20Chrome&limit=20" | python3 -m json.tool

# 查看磁盘占用
du -sh ~/.screenpipe/data/
```
