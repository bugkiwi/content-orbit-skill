# content-orbit-skill

**I hate AI slop. But AI is useful.**

我讨厌 AI 泔水，但 AI 确实有用。这个 Skill 用真实研究、原创信息和可追溯的质量门槛，把 AI 用在有价值的内容生产上。

为指定项目挖掘 SEO/GEO 机会、研究选题、生成原生语言文章，并按日历逐步 release，同步更新 sitemap。产品事实、语言市场、模型、排期与发布方式都由项目配置决定。

**适用对象：** 有明确产品事实、希望持续写原生多语言文章、愿意做真实研究和质量复核的项目。支持不同框架；网站接入通过构建适配器完成。

## 安装 Skill

需要 Node.js 22+。在要使用 Skill 的项目根目录，按标准 [Skills CLI](https://github.com/vercel-labs/skills) 方式安装：

```sh
npx skills add https://github.com/bugkiwi/content-orbit-skill
```

安装器会引导选择 Agent 与安装方式。也可指定 Agent 和范围：

```sh
# 当前项目，供 Codex 和 Claude Code 使用
npx skills add https://github.com/bugkiwi/content-orbit-skill --agent codex --agent claude-code

# 用户级安装，供多个项目使用
npx skills add https://github.com/bugkiwi/content-orbit-skill --global --agent codex --agent claude-code
```

安装后，在 Agent 中调用 `$content-orbit-skill`，并指定目标项目。例如：

```text
使用 $content-orbit-skill，为当前项目研究并准备下个月的文章。
先检查真实产品事实和现有文章，按项目语言和时区排期。
```

**Skill 安装与脚本依赖安装是两步。** Skills CLI 负责安装技能文件；第一次执行脚本前，还需要在安装器显示的 Skill 目录运行 `npm ci`。默认项目级安装可这样执行：

```sh
(cd .agents/skills/content-orbit-skill && npm ci)
```

如果选择全局安装或不同目录，把路径换成安装器显示的实际路径。Skill 可由兼容 Agent Skills 标准的宿主加载；各宿主的调用入口与目录可能不同。安装路径说明见 [Codex 官方 Skill 文档](https://developers.openai.com/codex/skills/)。

## 设计流程

```text
指定项目 + 项目事实/政策 + 语言市场 + 原生公共链接
                         |
            +------------+-------------+
            |                          |
    DataForSEO 关键词扩展        Google Trends CSV / HTTPS RSS
    搜索量 / KD / CPC                 新闻标题 / 热度
            +------------+-------------+
                         |
                JEV：实际意图与项目关联
             文章 / 小功能 / 邻近 / 无关 / 待核实
                         |
            文章机会去重 -> 补排期缺口
                         |
              SERP研究 + 主来源事实核实
                         |
            原创洞察 + 原生语言 Brief / Outline
                         |
                 文本模型写作 -> 独立复核调用
                         ^                 |
                         +--- 最多2轮修订 -+
                                           |
                        +------------------+-----------------+
                        |                                    |
                 不达标：保存 draft                 达标 + 配置的批准方式
                 不能进入发布队列                            |
                                                   approved，等待日期
                                                            |
                     定时 release / 网站构建 -> 本地时区日期门禁
                                                            |
                   不可变文章快照 <---- 同一批数据 ----> sitemap.xml
                              |
                    站点构建 -> 部署请求 -> Ready 检查
                              |
                    HTTP / sitemap / 未来404验证
                              |
                    GSC / 转化 / AI实际引用 -> 更新
```

**三个不同的时钟：** 发现机会通常每周；研究和写稿可每周或每月；release 每小时检查。写完一整月稿件，不意味着今天公开一个月的内容。Skill 本身不常驻运行，需要宿主 Agent、CI 或 Cron 触发。

## 项目结构

```text
content-orbit-skill/
├── SKILL.md                    Agent 使用入口，可整体安装为 Skill
├── agents/openai.yaml          Skill 发现元数据
├── scripts/                    CLI、JEV、DataForSEO、写作、发布实现
├── references/                 分阶段工作流、证据规范、网站发布契约
├── examples/
│   ├── project.json            每项目独立配置
│   ├── product-facts.md        项目事实模板
│   ├── brief-input.json        研究后填写的写作简报
│   └── github/                 每周挖掘/写稿 PR、到期发布工作流模板
├── tests/                      隔离、离线的行为验证
├── .env.example
└── package-lock.json
```

## 依赖与环境

- **Node.js 22+、npm**。运行时依赖 `zod`、`dotenv`、`csv-parse`、`fast-xml-parser`、`undici`；由 lockfile 安装。脚本不依赖特定网站框架或业务数据库。
- 能读取项目、访问真实搜索/网页并使用本 Skill 的 Agent：负责项目事实核对、原始来源阅读、原创 Brief、人工抽样式的代理检查。自动模型审稿始终标记为 model，不能冒充人工。
- **OpenRouter API Key**：JEV 决策、写作和复核需要；文本模型必须支持 JSON 输出。
- **DataForSEO Login/Password 与可用余额**：关键词扩展和指定语言/地区的 Google SERP。没有时可由 Agent 进行真实网页搜索并记录降级边界；关键词指标保持未知。
- 定时生成需要可按时调用 Agent 的宿主，或提前准备 Brief 后由 CI `batch` 生成。定时上线需要现有站点构建、部署和调度平台；纯本地 `release` 不需要外部凭据。

## 接入一个指定项目

以下以 `/path/to/website` 为要生成文章的网站仓库，不要直接在 `examples/` 中运营真实内容。

```sh
# 在目标网站项目根目录执行；全局安装时修改 SKILL_DIR
SKILL_DIR="$PWD/.agents/skills/content-orbit-skill"
cp "$SKILL_DIR/examples/project.json" content-orbit-skill.project.json
cp "$SKILL_DIR/examples/product-facts.md" product-facts.md
cp "$SKILL_DIR/.env.example" .env
```

修改 JSON 与事实文件，尤其是：品牌、网站、受众、真实产品能力、作者、原生语言路由、内链和种子词。清除示例文字。`root` 相对于 JSON 所在目录；内容、状态、输出路径相对于 root。不同项目分别使用配置、目录、事实文件和 `.env`。

在目标项目 `.gitignore` 加入 `.env`、`.content-orbit-skill/`、`.generated/`；把 `content/editorial/` 中文章、研究、Brief、审核和排期提交到版本库。原始来源材料需要相应公开/存储权限；不要放客户私密素材。

```dotenv
OPENROUTER_API_KEY=填写自己的OpenRouter密钥
DATAFORSEO_LOGIN=填写自己的API登录名
DATAFORSEO_PASSWORD=填写自己的API密码
CONTENT_ORBIT_DEPLOY_HOOK=仅配置已授权的生产分支部署Hook
```

默认只加载**所选项目根目录的 `.env`**；用 `--env /absolute/file` 选择其他文件。CI 直接注入 Secrets。既有环境变量优先于 dotenv 文件。`HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` 可选，支持小写变量。

```sh
node "$SKILL_DIR/scripts/cli.mjs" doctor \
  --project content-orbit-skill.project.json
```

`doctor` 只输出凭据是否存在。离线排期、QA、构建不需要 API Key。

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

样例 en/US=2840、it/IT=2380 仅为配置示例；可增加任意受支持语言和地区。模型 ID 仅作为示例，各项目按可用性和实际写作质量选择。JEV 使用实验性 Decisions 接口，**不会把 JEV 当作文章生成模型**；接口变化需更新 provider adapter。

## 命令与端到端流程

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

# 3. 将强文章机会补到未占用排期。特征机会不自动变文章。
node "$ORBIT" plan --project content-orbit-skill.project.json \
  --input content/editorial/opportunities/it/keywords.json --from 2026-11-01 --months 1

# 4. 对选中的每个词研究 SERP，Agent 阅读结果和主要事实来源
node "$ORBIT" research --project content-orbit-skill.project.json --locale it \
  --keyword '实际选中的关键词' --output content/editorial/research/it/topic.json

# 5. Agent 按 examples/brief-input.json 写简报，native locale/date/keyword 须匹配
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

所有命令输出 JSON，默认产物写入所选项目。显式文件参数按当前 shell 目录解析；输出文件必须留在项目 root 内。日期必须是真实日历日期。UTC `16:00` 对上海时区已是次日；不按服务器本地日期判定。

审核分数、相关概率都是模型判断；不代表转化率、收录率或搜索效果。`traffic` 是 Trends 原始热度字符串，不能当成月搜索量；DataForSEO 的付费竞争值不是自然搜索 KD。未知指标使用 `null`，真实测得的0保留为0。没有达标词时返回不足10条或空列表。

## 定期运行与逐步 release

推荐三个层次：

1. **每周/每月 Agent 工作流：** 调用本 Skill，读取项目事实与缺口，挖掘、去重、研究、准备 Brief、写作复核，提交内容变更供项目现有流程处理。
2. **每周机器任务（可选）：** `examples/github/editorial.yml` 挖词、补计划，并从**预先研究好的 Brief 池**生成最多3篇，产出 PR。新发现的词不会自动获得事实核实与原创洞察；需要下一次 Agent 研究工作补 Brief。模板不自动合并。
3. **每小时 release：** `examples/github/release.yml` 读取已合并的批准内容，按项目时区构建到期快照，必要时请求网站重建。网站构建也必须运行本地 `release`，确保新部署使用构建时的到期快照。

一个定时 Agent 的任务文本示例：

```text
使用 $content-orbit-skill，项目配置 /path/to/website/content-orbit-skill.project.json。
每周检查未来一个月的缺口，结合项目种子词和 IT Trends RSS 挖掘机会。
仅对直接文章机会做真实研究、原创 Brief、原生写作与复核。
保留现有稿件，缺少证据就记录阻塞，不补凑文章。
把新增内容交给本仓库的 PR 流程；本任务不包含部署。
```

Skill 文件不是一个调度服务；定时 Agent 需在实际宿主中配置。这里只提供任务文本与可运行 CI 模板，**没有在任何账户上创建自动化**。

要用 GitHub 模板：在网站仓库安装本工具（可用 `npm install --save-dev github:bugkiwi/content-orbit-skill#main`；生产 CI 建议固定到已审查的 commit SHA，或使用可检出的 vendored `file:tools/content-orbit-skill`），提交对应 lockfile，将模板复制到 `.github/workflows/`，配置 Secrets，再按站点包管理器、配置名和内容目录调整模板。`add-paths` 默认 `content/editorial`，自定义目录时连同缓存的状态目录一并修改；示例要求配置在仓库根且 `root: "."`。使用 pnpm/yarn 的项目更换安装和调用命令。

调度不是准点 SLA：GitHub 定时任务运行在默认分支，可能延迟；每小时17分仅用于补偿检查，实际可见时间还取决于构建。CI `concurrency` 防同组并发，本机项目锁防并发写入；不要让另一套调度器同时运营同一项目。

## 网站构建适配与 sitemap

`release` 产生：

```text
.generated/content-orbit-skill/
├── current.json                原子切换的指针
└── releases/<releaseId>/
    ├── articles.json           仅已批准、发布/更新日期都到期的正文与公开元数据
    ├── sitemap.xml             同一批文章 + staticPages
    └── release.json            构建日期、时区、releaseId、数量
.content-orbit-skill/
├── schedule.json               私有：下一个待发布日期，无公开路由
├── cache/                      成功 Provider 响应缓存，用于断点复用
├── deployments/<releaseId>.json
└── run.lock/                   本机排他锁
```

`releaseId` 取决于公开文章与 sitemap，日期变化而内容不变不会产生新 release。先写不可变目录，再原子更新 `current.json`；网站一次构建只解析一次指针，页面和 sitemap 读同一目录。不要把整个目录、历史 release、原始文章或研究目录作为静态资源公开。

**必须完成一个站点适配器，才能实际发布文章。** 见 [publication.md](references/publication.md)：构建前执行 release，路由/元数据/列表/相关文章/feeds 共用快照；未知/未来文章404；sitemap 消费同一批数据。现有 sitemap 较复杂时将当前清单合并进现有 sitemap builder，保留原有规则；当前 CLI 输出的是完整 urlset，不自动抓取并覆盖既有线上 sitemap。

未来 Markdown 仍可以安全地提交进源码库，前提是未来正文不被打包进可下载 runtime/browser assets。CLI 无公开日期覆盖参数，也不提供请求时读取原始 Markdown 的后门。`release` 只处理本地文件；`--deploy` 必须有 Hook 才会请求远程。

部署请求前持久化 intent，响应超时记为 `unknown`；同一 release 默认不再提交，防止盲目重复构建。确认托管平台实际状态后才用 `--deploy --retry-deploy`。`requested` 表示 Hook 接受，不等于 Ready 或发布成功。失败时不会自动移回旧 release；生产仍由托管平台保留上一部署。

GitHub 模板通过 Cache 跨 runner 保留 ledger，但缓存可能被驱逐、写入可能中断；这是低频发布的尽力去重，不是跨平台严格 exactly-once。重要生产任务请将 ledger 放到持久卷/事务存储并使用全局租约，或采用托管平台原生受鉴权的调度端点。不要将本机锁误当分布式锁。

`verify` 检查线上 sitemap 集合与当前本地快照一致、到期路由200及未公开文章404；不证明正文渲染、hreflang 或主站其他 SEO 要求。适配完成后还需运行网站自己的构建、路由、metadata/schema 和浏览器检查。

## 成本、错误与恢复

- 每次 Provider POST 都可能计费；没有自动网络重试或偷偷切模型。最多2轮改稿会产生额外写作/复核调用。
- 成功请求按请求内容缓存；JEV、写作/复核可重用相同输入。DataForSEO 缓存按项目时区当日分隔。缓存复用不代表重新测量；保留原始 retrieval timestamp。
- 关键词原始响应、任务ID、模型ID和用量保留。失败/超时调用也可能计费，不能把成功响应的 cost 汇总冒充完整账单。没有预估美元硬上限，`maxProviderCalls` 是每进程次数限制。
- API Key 缺失、SERP不足、未知实体或质量不达标，都有可见失败/草稿状态。错误不输出密钥或 Hook；不要用 `set -x` 调试凭据命令。
- 生成中断后重跑会复用已缓存的成功调用并跳过已存在文章。低分草稿不会被普通 batch 覆盖。修改/重新复核需要明确的维护任务，详见 workflow reference。
- 项目锁中断后可能残留；先确认 owner.json 中进程已停止，再手动移除锁。不要因为等待就盲删活跃锁。

## 开发与验证

开发本 Skill 可直接克隆仓库：

```sh
git clone https://github.com/bugkiwi/content-orbit-skill.git
cd content-orbit-skill
npm ci
npm run check
```

测试使用临时项目与内存 Provider 响应，不消耗 API 余额或操作生产：覆盖未来内容门禁、sitemap同步、日期/时区、审核绑定、项目隔离、已有稿件跳过、手动批准、有限改稿、缓存、锁与部署超时。

本地测试使用隔离项目和模拟 Provider 响应。真实 Provider 账户权限、实验接口及最终网站构建适配，需要在目标项目中验证。仓库提供工作流模板，安装 Skill 不会自动创建定时任务或修改网站。

## 官方接口参考

- [DataForSEO Google Keyword Ideas](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live/)
- [DataForSEO Google organic live advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/)
- [OpenRouter TypeSafe 模型入口](https://openrouter.ai/typesafe)
- [GitHub Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Google AI 搜索内容指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

可引用的原创信息、正常可索引页面和事实准确性贯穿流程。分批发布时间、文章数量或某种文件格式都不保证收录和 AI 引用。
