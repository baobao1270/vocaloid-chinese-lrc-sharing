# AGENTS.md

本文件为参与维护 `vocaloid-chinese-lrc-sharing` 的 coding agent / 自动化助手提供项目约定。

## 项目概览

这是一个使用 Bun 构建、部署到 Cloudflare Workers Static Assets 的静态歌词分享网站。

- 站点名称：`VC歌词分享网`
- Worker 名称：见 `wrangler.jsonc` 的 `name`
- 源歌词目录：`data/`
- 静态前端源码：`site/`
- Worker 入口：`src/worker.ts`
- 构建产物：`dist/`

网站不使用数据库、R2 或运行时 API。构建时会把歌词、WebP 封面、目录 JSON 和静态页面一起生成到 `dist/`。源 `data/` 目录不会被构建脚本修改。

## 常用命令

```sh
bun install
bun run build
bun run check
bun run dev
bun run deploy
```

说明：

- `bun run build`：读取 `data/` 和 `site-content.yaml`，生成 `dist/`
- `bun run check`：校验专辑/曲目数量、UTF-8/GB18030 文件、ZIP 生成
- `bun run dev`：本地预览 `dist/`
- `bun run deploy`：依次执行 build、check、`wrangler deploy`

部署前需确保已登录 Cloudflare：

```sh
bunx wrangler login
```

## 内容目录约定

只读取一级专辑目录中的 LRC 和封面：

```text
data/<albumName>/*.lrc
data/<albumName>/AlbumArtwork.*
```

`data/<albumName>/<subfolder>/` 中的内容会被忽略。

封面源文件保持在 `data/<albumName>/AlbumArtwork.*`；构建时统一转换为 WebP，输出到 `dist/covers/{albumName}.webp`，catalog 中的 `cover` 也指向 `covers/{albumName}.webp`。

LRC 元数据字段：

- `[ti:...]`：歌曲名
- `[ar:...]`：演唱者
- `[au:...]`：歌词作者
- `[by:...]`：LRC 制作者

缺失 LRC 制作者时，网页显示 `佚名`。

## `site-content.yaml`

`site-content.yaml` 用于站点内容补充和颜色配置。示例：

```yaml
_color:
  洛天依: '#66ccff'
  乐正绫: '#ee0000'
  言和: '#99ffcc'
  心华: '#ee82ee'
专辑名称:
  description: 这里填写专辑简介；未配置时专辑页不显示简介。
  copyright: |
    一些授权说明，可以使用 <b>HTML</b> 和 https://example.com/auto-render-links
    假定所有 HTML 都是可信的。
  vcpedia_link: https://vcpedia.cn/专辑条目名和专辑名称不同，可以用此配置覆盖
  color: gray
```

字段说明：

- `description`：专辑简介，未配置时不显示
- `copyright`：专辑授权说明，按可信 HTML 渲染，并自动渲染裸 URL
- `vcpedia_link`：覆盖默认 `https://vcpedia.cn/{专辑名称}` 链接
- `color`：覆盖专辑强调色
- `_color`：用于自动推断专辑强调色的名称到颜色映射

专辑颜色规则：

1. 优先使用专辑显式配置的 `color`
2. 如果所有曲目的 `演唱者` 字段完全相同，且该名称存在于 `_color`，使用对应颜色
3. 否则如果所有曲目的 `歌词作者` 字段完全相同，且该名称存在于 `_color`，使用对应颜色
4. 都匹配不到时，使用 CSS 默认强调色

## 目录 JSON 约定

`dist/data/catalog.json` 中的曲目字段：

- `path`：歌词下载路径，格式为 `{sha256}.lrc`；实际文件位于 `dist/lyrics/<encoding>/{sha256}.lrc`
- `track`：曲目编号字符串，同时用于展示和排序含义，不再额外输出 `order`
- `title`：歌曲名
- `author`：歌词作者，来自 LRC `[au:...]`
- `artist`：演唱者，来自 LRC `[ar:...]`
- `lrc_by`：LRC 制作者，来自 LRC `[by:...]`
- `staff`：结构化 Staff，格式为 `[{ "role": "作词", "name": "某人" }]`

不再输出原始 `file` 字段。前端下载只需要 `path`，单曲按钮使用曲目数组索引定位曲目，避免同时暴露原始文件名和下载路径。

## 前端维护约定

- `site/index.html`：页面骨架、设置弹窗、页脚声明
- `site/app.js`：目录渲染、搜索、下载设置、ZIP 下载逻辑
- `site/styles.css`：视觉样式，以天依蓝为主色
- `site/zip.js`：无压缩 ZIP 生成逻辑

注意事项：

- 不要在网页上显示 logo。
- 下载按钮文案应明确下载的是歌词，不是专辑音频/视频。
- 页脚 DMCA 邮箱需要由 JS 动态拼接，避免在 HTML 中直接出现完整邮箱地址。
- `copyright` 内容被视为可信 HTML；不要对非可信来源开放此字段。

## 构建与部署注意事项

- 修改 `site/`、`scripts/`、`data/` 或 `site-content.yaml` 后，应运行：

```sh
bun run build && bun run check
```

- 提交/部署前确认 `dist/` 是最新构建产物。
- `wrangler.jsonc` 中 `assets.directory` 应保持为 `./dist`。
- `src/worker.ts` 当前仅处理 `/health`，其他请求交给静态资产绑定。

## 依赖与类型

项目使用 Bun 与 TypeScript 类型配置：

- `@types/bun`
- `@cloudflare/workers-types`
- `tsconfig.json`

不要用手写全局 `types.d.ts` 替代官方类型，除非确实是项目特有的类型补充。
