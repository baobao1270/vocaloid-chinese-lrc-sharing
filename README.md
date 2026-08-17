# VC歌词分享网

一个以专辑为单位浏览与下载 LRC 的中文 VOCALOID 静态网站。

## 本地构建

依赖：
 - Python 3.12+
 - Bun 1.3.14+

```sh
bun run build
bun run check
bun run dev
```

## 内容维护
在 `data` 目录以专辑为单位存放整理好的内容。
 - 歌词文件位于 `data/<albumName>/*.lrc`
 - 专辑封面位于 `data/<albumName>/AlbumArtwork.*`

此外，还可通过 `site-content.yaml` 配置额外的信息。示例：

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
首次部署前需要登录 Cloudflare：

```sh
bunx wrangler login
```

确认 `wrangler.jsonc` 中的 `name` 是目标 Worker 名称后，可以直接部署：

```sh
bun run deploy
```
