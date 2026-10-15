# 工作流与恢复

## 阶段契约

| 阶段 | 输入 | 产出与门槛 | 运行方 |
|---|---|---|---|
| 项目接入 | 用户指定仓库、当前代码/政策 | project.json、事实文件、公共链接、时区、模型 | Agent |
| 缺口检查 | 现有文章、时间范围 | locale/date slots；draft也占位 | CLI slots |
| 挖掘 | 本地种子词/Trends CSV/HTTPS RSS | 原始数据、JEV概率、actual model、任务ID | CLI keywords/trends |
| 筛选排期 | 文章相关概率、现有意图 | calendar.json；不覆盖、不补凑、不排功能词 | CLI plan + Agent复核 |
| SERP/事实研究 | 每个选题 | 最少实际结果、国家/语言、时效、主来源事实 | CLI research + Agent |
| 原创简报 | 研究、项目体验/原创框架/真实数据 | brief与研究/context hash；原生outline | Agent + CLI brief |
| 起草与复核 | 锁定brief、来源、项目事实 | article、每轮draft/review、真实分数和模型 | CLI generate/batch |
| 批准 | 无硬失败且达质量门槛的准确稿件 | approved；或保留draft等待维护 | 配置质量门槛/明确手动批准 |
| 到期准备 | approved源文件、项目时区 | 不可变public快照+sitemap、私有schedule | CLI release |
| 部署 | 已授权的生产分支Hook | durable intent→requested/unknown/failed | CLI release --deploy |
| 核验 | Ready部署、同一版快照 | sitemap集合与200/404观察 | 平台检查 + CLI verify |
| 更新 | GSC、真实行为/引用、事实变化 | 更新建议、维护稿、重新复核 | Agent/项目数据流程 |

每个项目、每个语言分别处理。locale/date 是正常稿件占位键；本版本每语言每天一篇，不支持自动加更。现有项目有不同规则时用其 adapter，不要静默重排。

## 整月任务

1. `doctor`、`slots`，覆盖完整则停止，不花费模型调用。
2. 关键词库和趋势分别挖掘，`plan` 保留原计划。Agent检查与现有意图的重复；这个检查不是脚本的字面去重能够替代的。
3. 对每个缺口完成真实研究，选择原创角度，创建 brief-input 并执行 `brief`。不将广告/模型自述当实际SERP。
4. `generate` 或 `batch`；阅读正文，重点看产品承诺、语言自然度、来源支持、时效性。
5. `qa`，把批准内容的源文件与证据提交给现有代码审查/发布流程。未来稿件可以先合并，但需保持网站构建门禁。
6. 实际发布请求才进入部署阶段。周期写稿不自动授权生产部署或外部帖子。

## 定时任务

月度Agent准备研究和Brief池；每周CLI从池中生成少量稿件，保留draft；每小时release仅消费已批准且到期内容。没有可用brief时 batch 返回零条，不伪造来源。

GitHub示例分开editorial PR与release。若使用支持任务调度的Agent宿主，可直接定期调用完整Skill来准备新brief；具体调用/授权方式由宿主决定，本项目不内置某厂商Agent API。

## 中断与维护

- **关键词或模型请求失败**：检查账号/网络/实验接口，成功请求缓存可复用。没有自动付费重试；失败请求计费情况去Provider账单确认。
- **研究不足**：保存缺口，Agent用真实搜索补充；不得把5个虚构链接写成满足门槛。
- **文章不达标**：保留draft与attempt记录。默认batch跳过它。授权维护时编辑正文、保存旧版到review历史，再执行 `review --article`；manual模式需要重新批准。
- **项目事实/研究/brief变化**：旧review失效。先保存旧brief和研究到history，按当前证据更新同一brief文件的内容、contextHash、researchHash，再运行review。用脚本core.mjs的 `hash`/`loadProject` 生成hash，不手填评分或沿用旧批准。此操作只用于明确维护，不用于常规补缺口。
- **日期或slug变化**：检查占位冲突、旧URL重定向和既有外链，重新审核，按网站既有迁移流程处理。
- **部署超时/失败**：intent/unknown不等于未创建构建。先核对平台与当前main；确认可以重发时 `release --deploy --retry-deploy`。请求成功后检查Ready，再verify。
- **构建失败**：托管平台应保留上一稳定部署；修正源文件或adapter，重新构建。不要让静态请求现场读取未来Markdown绕过构建。

用户可指定更严格质量标准；不要为了达产量降低阈值、捏造样本、标记假人工review。审核记录是可审计文件，不是防恶意篡改的数字签名。
