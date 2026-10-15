# 网站适配与按日期发布契约

## 框架无关的接入

本工具输出文章数据与sitemap，不替任何现有项目创建UI。先检查站点框架、构建脚本、文章schema、路由和既有sitemap规则，选最小适配方式。读取框架当前版本的本地/官方文档再写具体代码。

1. 网站构建前执行 `content-orbit-skill release --project content-orbit-skill.project.json`，**不加 --deploy**，避免构建Hook递归。
2. 构建初始化时读取 `.generated/content-orbit-skill/current.json` 一次，读取其directory中的 `articles.json` 和 `sitemap.xml`。
3. 路由静态参数、文章正文、metadata/Article schema、列表、相关文章、语言切换、feed、搜索索引和sitemap共同消费这一个快照。
4. public请求不得读取源Markdown、research、brief或review；不能通过请求时间、query日期、cold start、动态fallback暴露未来稿件。
5. 未知/未来/草稿slug应404，草稿预览需独立受鉴权且noindex，不能直接暴露静态源文件。
6. 仅将本次快照派生出的页面与sitemap作为站点产物，不把所有历史release、原始文件或整个输出目录映射到静态路径。SSR也只能打包本次公开快照。

示例构建读取（改成目标项目实际模块位置）：

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve('.generated/content-orbit-skill');
const current = JSON.parse(readFileSync(resolve(output,'current.json'),'utf8'));
const releaseDirectory = resolve(output,current.directory);
const published = JSON.parse(readFileSync(resolve(releaseDirectory,'articles.json'),'utf8'));
const sitemapXml = readFileSync(resolve(releaseDirectory,'sitemap.xml'),'utf8');
// 构建期把 published.articles 转成已有文章路由/数据；sitemapXml用于公开sitemap。
// 不在HTTP请求中重读content/editorial/articles。
```

Markdown渲染器必须安全配置，禁用raw HTML并过滤危险URL；本文脚本的链接规则不能替代网站渲染安全。正文中的H1由渲染器展示一次，布局不要再重复一个H1。

## sitemap 与本地化

默认sitemap是完整urlset：配置的staticPages + 当前公开文章，lastmod来自实际updated，不随每次cron改成今天。已有站点如有sitemap index/分片、产品或示例内容，应在自己的builder里合并相同快照中的文章，保留原有URL；相应调整verify的集合策略。不要仅把文章sitemap覆盖掉网站其余公共URL。

self canonical使用配置的siteUrl+locale.articleBase+slug；在网站自己的Article schema中使用真实作者、日期和公开URL。独立原生文章不要自动标成互译。私有路由、订单和客户分享遵守项目现有robots/noindex；本工具不改变这些规则。

## 调度、部署与恢复

源文章必须已进入生产构建读取的分支/内容源。CI在临时runner写出文件不等于网站Hook能读到；先合并源文件，再由Hook构建同一项目。模板weekly workflow产出PR，release workflow只读已合并内容。

默认release按项目本地“日期”门禁，不是精确时分秒发布时间。支持自选timezone和每小时检查；不包含跨时区同一locale多版本路由。需要精确时间/已有CMS release API时新增adapter，保留已批准与due同源条件。

Hook发送前保存intent。HTTP成功记录requested；响应丢失记unknown；不自动重发同一release。核对平台构建与Ready，必要时明确retry。调度器状态需要持久化并全局串行；本机目录锁只保护当前共享文件系统。GitHub Cache可能丢失，严格生产幂等需持久存储和分布式租约。Hook本身也可能按平台语义启动重复构建。

## 验收

- 构建cutoff前后的独立测试：公开数量和sitemap一起变化，future文章404。
- 文章静态参数、metadata、related、feed、schema与语言切换没有未来title/slug/body。
- runtime与浏览器bundle没有原始未来Markdown；只对公开snapshot做打包。
- 部署Ready后校验sitemap、公开200与未来404，浏览器实际阅读正文、canonical和原生内链。
- verify只是HTTP与URL集合检查；indexing、SERP位置、AI引用另需真实观察。普通站点SEO要求不因本Skill通过就视为完成。
