# VC歌词分享网

一个以专辑为单位浏览与下载 LRC 的中文 VOCALOID 静态网站。它不使用 R2、数据库或 API：构建产物中的网页、封面和 UTF-8/GB18030 两种编码的 LRC 会一起作为 Cloudflare Worker 静态资产上传。

## 本地构建

需要 Bun 和带标准库的 Python 3.12。Python 只在构建阶段用于无损生成 GB18030 LRC；网站运行和 Cloudflare Worker 不依赖 Python 或第三方包。

```sh
bun run build
bun run check
bun run dev
```

`bun run check` 会核对一级专辑目录与曲目数量，并验证每一份 GB18030 文件都能无损还原为 UTF-8 源 LRC。

## 内容维护

- 只会读取 `data/<albumName>/*.lrc` 与 `data/<albumName>/AlbumArtwork.*`。构建时会把封面转换为 `dist/covers/{albumName}.webp`，不会修改 `data/` 中的源文件。
- `data/<albumName>/<subfolder>/` 的内容始终被忽略。
- `site-content.yaml` 是可选的、按专辑配置的站点内容；没有条目时网站不会显示授权卡片。示例：

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

## 部署

`wrangler.jsonc` 已指向 `dist/` 静态资产目录和 `src/worker.ts`，不需要把 LRC 上传到 R2。

首次部署前需要登录 Cloudflare：

```sh
bunx wrangler login
```

确认 `wrangler.jsonc` 中的 `name` 是目标 Worker 名称后，可以直接部署：

```sh
bun run deploy
```

该命令会依次执行：

1. `bun run build`：生成 `dist/`
2. `bun run check`：校验目录、编码和 ZIP 生成
3. `wrangler deploy`：发布 Cloudflare Worker 与静态资产
