# CLI 使用说明

下列示例在目标网站根目录执行。`ORBIT` 只是本终端的脚本路径简写，不是必需配置。

```sh
SKILL_DIR="${SKILL_DIR:-$PWD/.agents/skills/content-orbit-skill}"
ORBIT="$SKILL_DIR/scripts/cli.mjs"
node "$ORBIT" slots --project content-orbit-skill.project.json --from 2026-11-01 --months 1

# 1. 关键词库：种子词来自所选语言配置；也可 --seeds '词一|词二'
node "$ORBIT" keywords --project content-orbit-skill.project.json --locale it \
  --limit 50 --output content/editorial/opportunities/it/keywords.json

# 2. 趋势：CSV 或 HTTPS RSS；dry-run 只解析，不调用 JEV
node "$ORBIT" trends --project content-orbit-skill.project.json --locale it \
  --input 'https://trends.google.com/trending/rss?geo=IT' --dry-run
node "$ORBIT" trends --project content-orbit-skill.project.json --locale it \
  --input /path/to/trending_IT.csv --threshold .75 --top 10 \
  --output content/editorial/opportunities/it/trends.json

# 3. 将文章选题补到未占用的排期；功能建议单独记录
node "$ORBIT" plan --project content-orbit-skill.project.json \
  --input content/editorial/opportunities/it/keywords.json --from 2026-11-01 --months 1

# 4. 对选中的每个词研究 SERP，Agent 阅读结果和主要事实来源
node "$ORBIT" research --project content-orbit-skill.project.json --locale it \
  --keyword '实际选中的关键词' --output content/editorial/research/it/topic.json

# 5. Agent 按 examples/brief-input.json 准备简报，语言、日期和关键词须匹配
node "$ORBIT" brief --project content-orbit-skill.project.json \
  --input content/editorial/brief-inputs/it/topic.json \
  --research content/editorial/research/it/topic.json

# 6. 原生起草、独立复核、有限修订；同日期已有稿件就跳过
node "$ORBIT" generate --project content-orbit-skill.project.json \
  --brief content/editorial/briefs/it/2026-11-02.json
# 或从已准备的简报池按日期生成，适合周任务
node "$ORBIT" batch --project content-orbit-skill.project.json --limit 3
node "$ORBIT" qa --project content-orbit-skill.project.json

# manual 模式：仅在文章已获明确批准时执行，不绕过质量门槛
node "$ORBIT" approve --project content-orbit-skill.project.json \
  --article content/editorial/articles/it/2026/11/2026-11-02-实际slug.md \
  --by '实际批准人' --note '对该准确稿件的批准依据'

# 7. 本地准备到期快照和 sitemap，不部署
node "$ORBIT" release --project content-orbit-skill.project.json
# 8. 已配置并授权部署时，才发出 Hook
node "$ORBIT" release --project content-orbit-skill.project.json --deploy
# 确认托管平台 Ready 后，验证网站已接上快照与 sitemap
node "$ORBIT" verify --project content-orbit-skill.project.json --base-url https://example.com
```

所有命令输出 JSON，产物写入所选项目。显式文件参数按当前 shell 目录解析，输出文件须位于项目 `root` 内。发布日期使用配置的 IANA 时区；例如上海时区在 UTC 16:00 进入次日。

审核分数和相关概率属于模型判断。`traffic` 保留 Trends 的原始热度值，与月搜索量分别记录；DataForSEO 的付费竞争度与自然搜索 KD 也分别处理。未知指标使用 `null`，测得的零值保留为 `0`。达到阈值的结果可以少于 `--top` 指定的数量。

## 配置说明

| 配置 | 作用 |
|---|---|
| `name/siteUrl/description/audience/author` | 当前项目身份、实际能力和真实作者 |
| `factFiles/exclusions` | 可引用的项目事实与不应误称已支持的范围 |
| `timezone` | IANA 时区；排期、构建日期统一使用它 |
| `locales[]` | 每语言独立 country、DataForSEO languageCode/locationCode、articleBase、seedKeywords、internalLinks |
| `calendar` | `weekdays`：0=周日，1=周一；`months`：默认1个日历月 |
| `paths` | 内容、私有状态、生成快照；三者不可重叠且不能放进 `public/` |
| `models` | decision 默认 JEV 1.13；writer/reviewer 明确指定，允许相同文本模型的两次独立调用 |
| `quality` | 默认质量≥90、风险≤20、无硬失败，研究至少5个不同实际结果，最多2次修订 |
| `quality.approval` | 默认 `quality-gated`，达标稿自动进入到期队列；项目需要逐篇确认时可选 `manual` |
| `maxProviderCalls` | 每条命令的外部付费 POST 次数上限，默认20；不是美元预算 |
| `staticPages` | 已有公共页面的完整 sitemap 清单；不填假的 lastmod |
| `deployment.hookEnv` | 部署 Hook 的环境变量名，不存 Hook 本身 |

样例中的地区代码为 en/US=2840、it/IT=2380。语言与地区须与 Provider 支持的配置一致。JEV 使用实验性的 Decisions 接口执行分类；写作和复核使用支持 JSON 输出的文本模型。

## 调用与缓存

- `maxProviderCalls` 限制单条命令的外部付费 POST 次数，默认 20 次。写作修订会增加调用次数。
- 相同输入的成功响应可从缓存复用。DataForSEO 缓存按项目时区的日期区分，记录中保留最初的获取时间。
- 网络错误和超时不自动重试，模型不会自动替换。中断后重跑可复用成功调用的缓存。
- 请求记录保留 Provider 任务 ID、实际模型和返回的用量。失败请求也可能计费，费用以 Provider 账单为准。

草稿修改、审核失效和发布恢复的操作步骤见[工作流与维护](workflow.md)。

