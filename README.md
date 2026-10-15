# content-orbit-skill

**I hate AI slop. But AI is useful.**

用于 SEO/GEO 内容研究、写作和定期发布的 Agent Skill。它根据指定项目的产品资料和目标市场筛选选题，生成文章与审核记录，再按发布日期生成网站所需的文章数据和 sitemap。

适用于维护产品博客、多语言内容站和编辑日历。各项目独立配置语言、模型、排期和发布方式，通过现有网站的构建流程上线。

## 工作流程

内容生产与定时发布分别运行。前者负责形成可发布的文章，后者根据日期将批准稿件交给网站构建流程。

### 选题、研究与写作

```mermaid
flowchart TD
    Project["项目配置与产品资料"] --> Keywords["DataForSEO<br/>种子词扩展与关键词指标"]
    Project --> Trends["Google Trends<br/>CSV / HTTPS RSS"]
    Keywords --> Fit["JEV 相关性判断<br/>搜索意图与项目匹配"]
    Trends --> Fit
    Fit --> Topics["筛选文章机会<br/>去重并补充排期"]
    Fit -. "功能建议或待核实词" .-> Notes["单独记录<br/>暂不进入文章排期"]
    Topics --> Research["SERP 研究与事实核对<br/>搜索结果、主要来源与当地日期"]
    Research --> Brief["写作简报<br/>读者、原创信息、提纲与引用"]
    Brief --> Draft["文本模型起草<br/>按目标语言分别撰写"]
    Draft --> Review["独立模型复核与规则校验<br/>事实、语言、链接与审核记录"]
    Review --> Pass{"是否通过？"}
    Pass -- "通过" --> Approved["批准稿件<br/>提交内容仓库，等待发布日期"]
    Pass -- "返修，最多 2 轮" --> Draft
    Pass -- "仍不通过" --> Held["保留草稿与复核意见<br/>等待后续维护"]
```

Agent 负责阅读来源和准备简报，模型生成文章并单独复核。每轮修订保留草稿和审核记录；项目可选择自动按质量标准批准，或逐篇确认。

### 定时发布与维护

```mermaid
flowchart TD
    Schedule["定时任务<br/>按配置周期检查"] --> Due{"稿件是否已到期<br/>使用项目配置的时区"}
    Approved["已合并的批准稿件"] --> Due
    Due -- "未到期" --> Waiting["保留排期<br/>等待下一次检查"]
    Due -- "已到期" --> Snapshot["生成本次发布快照<br/>仅包含已批准且到期的文章"]
    Snapshot --> Articles["文章数据<br/>正文、元数据与列表"]
    Snapshot --> Sitemap["sitemap.xml<br/>本次文章与既有公共页面"]
    Articles --> Deploy["网站构建与部署"]
    Sitemap --> Deploy
    Deploy --> Verify["部署验证<br/>公开页面、sitemap 与未来文章 404"]
    Verify --> Observe["效果观察<br/>搜索表现、AI 引用与转化"]
    Observe -. "维护建议" .-> Update["更新选题、来源与现有文章<br/>重新研究和审核"]
```

网站路由与 sitemap 读取同一份快照，未来稿件不进入公开构建。搜索表现与内容维护由项目维护者或定时 Agent 跟进；部署与检查方式见[网站发布说明](references/publication.md)。

## 安装

需要 Node.js 22+、npm，以及支持 Agent Skills 的工具。

在目标项目目录执行：

```sh
npx skills add https://github.com/bugkiwi/content-orbit-skill
```

安装器会提示选择 Agent 和安装范围。也可通过参数指定，例如：

```sh
npx skills add https://github.com/bugkiwi/content-orbit-skill --agent codex --agent claude-code
```

添加 `--global` 可安装到用户目录。安装路径和选项见 [Skills CLI 文档](https://github.com/vercel-labs/skills)。

执行脚本前，进入安装器显示的 Skill 目录安装依赖。默认项目级路径为：

```sh
(cd .agents/skills/content-orbit-skill && npm ci)
```

安装后可在 Agent 中调用：

```text
使用 $content-orbit-skill，为当前项目准备下个月的文章。
先检查产品资料和现有文章，再研究选题、安排日期并生成稿件。
```

## 项目配置

在目标网站根目录复制配置模板。全局安装时，将 `SKILL_DIR` 改为实际安装路径。

```sh
SKILL_DIR="$PWD/.agents/skills/content-orbit-skill"
cp "$SKILL_DIR/examples/project.json" content-orbit-skill.project.json
cp "$SKILL_DIR/examples/product-facts.md" product-facts.md
```

配置分为两部分：

| 文件 | 内容 |
| --- | --- |
| [`content-orbit-skill.project.json`](examples/project.json) | 网站地址、语言与市场、关键词、内链、排期、模型和发布设置 |
| [`product-facts.md`](examples/product-facts.md) | 当前产品能力、价格、政策及可用于文章的资料 |

修改模板中的示例内容后，运行 `doctor` 检查配置和凭据状态：

```sh
node "$SKILL_DIR/scripts/cli.mjs" doctor --project content-orbit-skill.project.json
```

`root` 相对于配置文件所在目录；内容、状态和输出路径相对于 `root`。配置字段与命令参数见 [CLI 使用说明](references/cli.md)。

### 环境变量

在目标项目的 `.env` 中配置以下变量。完整模板见 [`.env.example`](.env.example)。

```dotenv
OPENROUTER_API_KEY=
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
CONTENT_ORBIT_DEPLOY_HOOK=
```

| 变量 | 用途 |
| --- | --- |
| `OPENROUTER_API_KEY` | JEV 相关性判断、文章生成和模型复核 |
| `DATAFORSEO_LOGIN`、`DATAFORSEO_PASSWORD` | 关键词扩展和指定市场的 Google 搜索结果研究 |
| `CONTENT_ORBIT_DEPLOY_HOOK` | 可选；用于 `release --deploy` 请求网站重新构建 |

默认读取所选项目根目录的 `.env`，也可用 `--env` 指定文件；CI 通过 Secrets 注入。已有环境变量优先。代理连接支持 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY`。

在网站仓库中忽略 `.env`、`.content-orbit-skill/`、`.generated/` 和 `node_modules/`。文章、研究资料、简报和审核记录保存在 `content/editorial/`，随内容变更提交。

## 使用

完整操作包括选题挖掘、搜索研究、简报、写作和发布，见 [工作流说明](references/workflow.md)。以下为常用命令，在目标网站目录执行：

```sh
ORBIT="$SKILL_DIR/scripts/cli.mjs"

# 检查未来一个月的排期缺口
node "$ORBIT" slots --project content-orbit-skill.project.json

# 从意大利 Google Trends RSS 筛选相关选题
node "$ORBIT" trends --project content-orbit-skill.project.json --locale it \
  --input 'https://trends.google.com/trending/rss?geo=IT' --threshold .75 --top 10

# 根据已完成研究的简报生成文章
node "$ORBIT" batch --project content-orbit-skill.project.json --limit 3

# 校验文章、来源和审核记录
node "$ORBIT" qa --project content-orbit-skill.project.json

# 为到期文章生成快照和 sitemap
node "$ORBIT" release --project content-orbit-skill.project.json
```

默认排期为一个日历月；已存在的文章会占用对应语言和日期，包括草稿。生成器跳过这些位置，保留已有内容。每篇文章默认至少研究五个不同的搜索结果，并经过单独的模型复核。

默认发布标准为质量分数至少 90、风险分数不高于 20，且没有事实等硬性问题。项目也可设置为逐篇批准。分数属于模型评审结果，事实核对和正文检查仍由内容维护者负责。

所有命令输出 JSON。DataForSEO 和 OpenRouter 调用需要相应账户余额；排期查询、校验和本地发布快照生成无需 API 凭据。调用次数、缓存和重试行为见 [CLI 使用说明](references/cli.md)。

## 定时运行

内容生产与网站发布分别调度。仓库提供两份 GitHub Actions 模板：

| 任务 | 模板 | 行为 |
| --- | --- | --- |
| 每周选题与写作 | [`editorial.yml`](examples/github/editorial.yml) | 挖掘关键词、补充排期，从已准备的简报中生成文章并创建 PR |
| 每小时发布检查 | [`release.yml`](examples/github/release.yml) | 检查已合并、已批准且到期的文章，按需请求网站重建 |

新选题的来源阅读和简报准备由 Agent 完成，可通过所用 Agent 工具的定时任务执行。`batch` 只处理已准备的简报。

使用 GitHub 模板时，在网站仓库安装本工具并提交 lockfile：

```sh
npm install --save-dev github:bugkiwi/content-orbit-skill#main
```

将模板复制到 `.github/workflows/`，配置 Secrets，并按项目调整安装命令、内容路径和状态缓存目录。生产环境建议将依赖固定到已审查的 commit SHA。模板的配置文件位于仓库根目录，`root` 为 `"."`。

发布任务需要保留部署状态记录，并与其他发布任务串行运行。GitHub 模板使用 Cache；需要更严格的并发和恢复控制时，应使用持久存储。部署失败与超时处理见 [发布说明](references/publication.md)。

## 网站接入

网站构建前执行 `release`，读取 `.generated/content-orbit-skill/current.json` 指向的发布目录：

| 文件 | 用途 |
| --- | --- |
| `articles.json` | 文章正文与公开元数据 |
| `sitemap.xml` | 配置的静态页面和本次发布的文章 URL |
| `release.json` | 发布标识、构建日期、时区和文章数量 |

文章路由、元数据、列表和相关文章应读取同一份快照，未来或未知文章返回 404。已有 sitemap 的网站应将文章数据合并到原有生成逻辑中，保留其他公共页面。

`release` 只生成本地文件。配置部署 Hook 后，使用 `release --deploy` 请求重建；构建完成后运行 `verify` 检查 sitemap 和文章路由。具体接入约定见 [网站发布说明](references/publication.md)。

## 开发

```sh
git clone https://github.com/bugkiwi/content-orbit-skill.git
cd content-orbit-skill
npm ci
npm run check
```

测试使用隔离项目和模拟 Provider 响应，覆盖排期、审核记录、未来内容隔离、sitemap、缓存和部署恢复。真实 Provider 连接及网站构建需在目标环境验证。

## 文档

- [Skill 入口](SKILL.md)
- [工作流与维护](references/workflow.md)
- [研究、证据与写作规范](references/research-writing.md)
- [CLI 命令与配置](references/cli.md)
- [网站接入与发布](references/publication.md)
