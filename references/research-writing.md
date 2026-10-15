# 挖掘、证据与写作

## 挖掘与排序

`keywords` 使用 DataForSEO Labs `google/keyword_ideas/live`，保留 `keyword_info.search_volume/cpc/monthly_searches`、`keyword_properties.keyword_difficulty`。unknown=null；付费competition与自然KD分别保存。Raw响应在私有内容研究目录，可追溯task ID和获取时间。

`trends` 支持Google导出的CSV（含中文/英文列名）与HTTPS RSS。保留term、原始traffic、相关查询、新闻标题。新闻标题未经网页核实；不能据此声称发生某事。只解析不请求模型用 `--dry-run`。全部输入分批判别，`--top`仅限制显示选中条数。默认10条、阈值.75，可以不足10条。

JEV类：article、feature、both、adjacent、unrelated、needs_context。`probability=P(article)+P(feature)+P(both)`；`articleProbability=P(article)+P(both)`。排期要求顶层类别为article/both，articleProbability达阈值且不是待核实。概率是模型对类别的判断，不是月度需求、转化率或SEO胜率。

未知实体、名人/作品名称、福利政策与购买意图容易混淆。热度再高也不能改变是否直接相关；先看实际SERP与产品能否回答它。功能机会单独记录，不自动实现。没有合适机会时保留空白。

## 研究记录与搜索降级

CLI的DataForSEO SERP记录保留原始country/locationCode/languageCode、providerDatetime、retrievedAt、taskId、results、PAA、relatedSearches、AI Overview和spell。没有返回的可选元素用空数组表示“本次响应未观测到”，不声称全球不存在。

DataForSEO不可用时，由Agent执行实际网页搜索并存以下形式。不要只写source URL列表而未真正查询/阅读；snippet不是正文已读。

```json
{
  "version": 1,
  "kind": "research",
  "provider": "manual-web-search",
  "keyword": "实际查询词",
  "locale": "it",
  "country": "IT",
  "retrievedAt": "2026-10-15T03:00:00Z",
  "rankingsLocationLocked": false,
  "results": [
    {"title": "实际结果标题", "url": "https://真实来源.example/actual-path", "description": "实际摘要", "position": null}
  ],
  "peopleAlsoAsk": null,
  "relatedSearches": null,
  "aiOverview": null,
  "searchVolume": null,
  "keywordDifficulty": null,
  "cpc": null,
  "notes": "实际搜索工具、查询、抓取失败和地区限制；上面只展示单条格式，实际须达到项目配置的不同结果数量。"
}
```

每篇研究至少配置要求的不同结果数（默认5）；重复URL不算。阅读主要页面的标题/结构/不足，访问失败准确记录。复制重写竞品不构成原创洞察。

## Brief 与证据

从 `examples/brief-input.json` 构造输入。外部事实来源放在sources：

```json
{
  "url": "https://实际主来源.example/path",
  "facts": ["本页能够直接支持的具体事实，不能超出它的范围"],
  "verifiedAt": "2026-10-15T03:00:00Z",
  "verifiedBy": "agent"
}
```

`verifiedBy: agent`表示代理实际访问核对，不能自动改成human。来源支持的事实、原创洞察来源和canPublish应真实填写。SERP获取本身不会自动填好这些字段；脚本检查数据一致性，事实是否真正得到支持仍需要实际阅读。

原创insight可为original_framework；明确为编辑建议而不是实测结果。使用internal_data/experiment/real_example时须能提供实际样本、方法、限制和发布许可，不能编造素材凑内容比例。不要把项目客户隐私提交到Provider。

假定示例需标注为假定，虚构产品公开样例需标注来源与AI生成；不冒充客户评价或背书。涉及节日必须核实目标国家和当年日期；提前多久发布由项目策略决定。

## 写作与质检

每语言独立搜索意图、角度、例子和文稿，使用原生表达。仅真实互译且都到期的文章才可配置hreflang对等关系；本工具默认不生成translation group。

文章应给出直接答案、可执行步骤/取舍、至少一个原创信息增量，链接到适合该语言的实际页面。只允许配置中的native internalLinks和brief核实来源，防止链到未来/不存在文章。若想引用已有文章，先核实已公开，再加入该语言链接注册表；修改配置会改变contextHash，需按维护流程重审相关brief。

不设通用字数目标，不保证AI引用，不编造专家、数据、报价、用户故事。可以引用真实产品流程和明确来源支持的事实。SEO字段长度只是配置/校验约束，不是Google排名要求。

自动复核与确定性校验共同控制发布。前者评估事实、语言、信息增量；后者检查真实日期、exact content hash、native链接、唯一slug/slot和原始HTML禁用等。自动评分不是语义抄袭检测或专业人工审核；重要文章仍需实际阅读。
