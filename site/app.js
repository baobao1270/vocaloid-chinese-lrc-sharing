import { createStoredZip } from "./zip.js";

const TEMPLATE_STORAGE_KEY = "vocaloid-chinese-lrc-sharing.filename-template";
const ENCODING_STORAGE_KEY = "vocaloid-chinese-lrc-sharing.encoding";
const DEFAULT_TEMPLATE = "%track - %title";
const DEFAULT_ENCODING = "utf8";
const KNOWN_TEMPLATES = new Set(["%track - %title", "%track %title", "%title"]);
const KNOWN_ENCODINGS = new Set(["utf8", "gb18030"]);
const PREVIEW_TRACK = { track: "08", title: "唱给雅音宫羽" };

const app = document.querySelector("#app");
const dialog = document.querySelector("#settings-dialog");
const customTemplate = document.querySelector("#custom-template");
const customTemplatePreview = document.querySelector("#custom-template-preview");
const settingsError = document.querySelector("#settings-error");
let catalog;

function renderDmcaEmail() {
  const target = document.querySelector("#dmca-email");
  if (!target) return;

  const email = `${target.dataset.user}@${target.dataset.domain}`;
  const anchor = document.createElement("a");
  anchor.href = `mailto:${email}`;
  anchor.textContent = email;
  target.replaceChildren(anchor);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function getTemplate() {
  return localStorage.getItem(TEMPLATE_STORAGE_KEY) || DEFAULT_TEMPLATE;
}

function getStoredEncoding() {
  const encoding = localStorage.getItem(ENCODING_STORAGE_KEY);
  return KNOWN_ENCODINGS.has(encoding) ? encoding : DEFAULT_ENCODING;
}

function labelForEncoding(encoding) {
  return encoding === "gb18030" ? "GB18030" : "UTF-8";
}

function applyTemplate(template, track) {
  const fileName = template
    .replaceAll("%track", track.track)
    .replaceAll("%title", track.title)
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${fileName || `${track.track} ${track.title}`}.lrc`;
}

function formatFileName(track) {
  return applyTemplate(getTemplate(), track);
}

function updateCustomTemplatePreview() {
  const template = customTemplate.value.trim();
  customTemplatePreview.hidden = !template;
  if (template) {
    customTemplatePreview.textContent = `预览：${applyTemplate(template, PREVIEW_TRACK)}`;
  }
}

function safeArchiveName(value) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

function albumAccentStyle(album) {
  if (!album.color || !/^[#\w\s(),.%+-]+$/.test(album.color)) return "";
  return ` style="--album-accent: ${album.color}"`;
}

function cover(album, className = "album-cover") {
  if (!album.cover) {
    return `<div class="${className} cover-placeholder" aria-label="暂无专辑封面"><span>${escapeHTML(album.title.slice(0, 1))}</span></div>`;
  }

  return `<img class="${className}" src="./${album.cover}" alt="《${escapeHTML(album.title)}》封面" loading="lazy" />`;
}

function renderTrustedRichText(value) {
  return String(value).replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
    const cleanUrl = url.replace(/[),.;!?，。；！？）]+$/, "");
    const suffix = url.slice(cleanUrl.length);
    return `${prefix}<a href="${escapeHTML(cleanUrl)}" rel="noreferrer" target="_blank">${escapeHTML(cleanUrl)}</a>${escapeHTML(suffix)}`;
  });
}

function valueOrDash(value) {
  return value ? escapeHTML(value) : '<span class="muted">佚名</span>';
}

function pluralTracks(count) {
  return `${count} 首${count === 0 ? "（暂未收录歌词）" : "歌词"}`;
}

function filteredAlbums(search) {
  const keyword = search.trim().toLocaleLowerCase("zh-CN");
  if (!keyword) return catalog.albums;

  return catalog.albums.filter((album) => album.title.toLocaleLowerCase("zh-CN").includes(keyword)
    || album.tracks.some((track) => [track.title, track.author, track.artist].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN").includes(keyword)));
}

function albumListMarkup(albums) {
  if (!albums.length) {
    return `
      <div class="empty-state">
        <strong>没有找到相关专辑</strong>
        <p>试试歌曲名、演唱者或歌词作者。</p>
        <button class="text-button" type="button" data-action="clear-search">清除搜索</button>
      </div>`;
  }

  return `
    <div class="album-grid">
      ${albums.map((album) => `
        <a class="album-card" href="#album/${encodeURIComponent(album.id)}" aria-label="查看《${escapeHTML(album.title)}》"${albumAccentStyle(album)}>
          <div class="card-cover-wrap">${cover(album)}</div>
          <div class="card-text">
            <h3>${escapeHTML(album.title)}</h3>
            <p>${pluralTracks(album.tracks.length)}</p>
          </div>
          <span class="card-arrow" aria-hidden="true">↗</span>
        </a>
      `).join("")}
    </div>`;
}

function updateHomeSearch(search) {
  const keyword = search.trim();
  const albums = filteredAlbums(search);
  const summary = document.querySelector("#album-list-summary");
  const content = document.querySelector("#album-list-content");

  if (summary) summary.textContent = keyword ? `找到 ${albums.length} 张相关专辑` : "点击专辑查看曲目与下载";
  if (content) content.innerHTML = albumListMarkup(albums);
}

function renderHome(search = "") {
  const trackCount = catalog.albums.reduce((total, album) => total + album.tracks.length, 0);

  app.innerHTML = `
    <section class="hero hero-compact">
      <form class="search-form" role="search">
        <label class="sr-only" for="album-search">搜索专辑、歌曲或创作者</label>
        <input id="album-search" name="q" value="${escapeHTML(search)}" placeholder="搜索专辑、歌曲或创作者" autocomplete="off" />
        <button class="search-submit" type="submit">搜索</button>
      </form>
      <div class="stat-line"><span>${catalog.albums.length} 张专辑</span><i></i><span>${trackCount} 份歌词</span></div>
    </section>
    <section class="album-section" aria-labelledby="album-list-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">专辑</p>
          <h2 id="album-list-title">专辑目录</h2>
        </div>
        <p id="album-list-summary"></p>
      </div>
      <div id="album-list-content"></div>
    </section>
  `;

  updateHomeSearch(search);
}

function renderStaff(staff) {
  if (!staff.length) return '<span class="muted">未附 Staff</span>';
  return `<details class="staff-details"><summary>查看 ${staff.length} 项</summary><div class="staff-content">${staff.map((credit) => `
    <p>${credit.role ? `<b>${escapeHTML(credit.role)}</b><span>：${escapeHTML(credit.name)}</span>` : `<span>${escapeHTML(credit.name)}</span>`}</p>
  `).join("")}</div></details>`;
}

function renderAlbum(album) {
  const hasTracks = album.tracks.length > 0;
  const copyright = album.copyright ? `
    <section class="license-card" aria-label="授权信息">
      <p class="eyebrow">授权</p>
      <h3>授权说明</h3>
      <div class="license-content">${renderTrustedRichText(album.copyright)}</div>
    </section>` : "";
  const albumStyle = albumAccentStyle(album);

  app.innerHTML = `
    <nav class="breadcrumbs" aria-label="面包屑"><a href="#">专辑目录</a><span>/</span><strong>${escapeHTML(album.title)}</strong></nav>
    <section class="album-hero"${albumStyle}>
      <div class="album-hero-cover">${cover(album, "album-cover album-cover-large")}</div>
      <div class="album-hero-text">
        <p class="eyebrow">专辑</p>
        <h1>${escapeHTML(album.title)}</h1>
        <p class="album-count">${pluralTracks(album.tracks.length)}</p>
        ${album.description ? `<p class="album-description">${escapeHTML(album.description)}</p>` : ""}
        <p class="album-links"><a href="${escapeHTML(album.vcpediaLink)}" rel="noreferrer" target="_blank">VCPedia ↗</a></p>
        <div class="download-panel">
          <div class="download-setting-group encoding-picker" aria-label="歌词编码">
            <span>文件编码</span>
            <label><input type="radio" name="album-encoding" value="utf8" ${getStoredEncoding() === "utf8" ? "checked" : ""} /><b>UTF-8</b></label>
            <label><input type="radio" name="album-encoding" value="gb18030" ${getStoredEncoding() === "gb18030" ? "checked" : ""} /><b>GB18030</b></label>
          </div>
          <button class="primary-button album-download" type="button" data-action="download-album" data-album="${escapeHTML(album.id)}" ${hasTracks ? "" : "disabled"}>
            下载全辑歌词 ZIP
          </button>
          <div class="download-setting-group naming-preview"><span>命名格式</span><code>${escapeHTML(getTemplate())}</code><button class="inline-button" type="button" data-action="open-settings">修改</button></div>
        </div>
      </div>
    </section>
    ${copyright}
    <section class="track-section" aria-labelledby="track-list-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">曲目</p>
          <h2 id="track-list-title">曲目列表</h2>
        </div>
        <p>Staff 可展开查看</p>
      </div>
      ${hasTracks ? `
        <div class="track-table-wrap">
          <table class="track-table">
            <thead><tr><th>曲目</th><th>歌曲</th><th>歌词作者</th><th>演唱者</th><th>LRC 制作者</th><th>Staff</th><th><span class="sr-only">下载</span></th></tr></thead>
            <tbody>
              ${album.tracks.map((track, index) => `
                <tr>
                  <td data-label="曲目" class="track-number">${escapeHTML(track.track)}</td>
                  <th scope="row" data-label="歌曲" class="track-title">${escapeHTML(track.title)}</th>
                  <td data-label="歌词作者">${valueOrDash(track.author)}</td>
                  <td data-label="演唱者">${valueOrDash(track.artist)}</td>
                  <td data-label="LRC 制作者">${valueOrDash(track.lrc_by)}</td>
                  <td data-label="Staff" class="staff-cell">${renderStaff(track.staff)}</td>
                  <td class="track-download"><button class="download-button" type="button" data-action="download-track" data-album="${escapeHTML(album.id)}" data-track-index="${index}">下载 <span>↓</span></button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>` : `
        <div class="empty-state compact"><strong>这张专辑暂未收录可下载的 LRC。</strong></div>`}
    </section>

  `;
}

function getAlbum(id) {
  return catalog.albums.find((album) => album.id === id);
}

function currentEncoding() {
  return document.querySelector('input[name="album-encoding"]:checked')?.value || getStoredEncoding();
}

function renderRoute() {
  const match = location.hash.match(/^#album\/(.+)$/);
  if (!match) {
    renderHome();
    return;
  }

  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    location.hash = "";
    return;
  }

  const album = getAlbum(id);
  if (!album) {
    location.hash = "";
    return;
  }
  renderAlbum(album);
}

function showSettings() {
  const current = getTemplate();
  const selected = KNOWN_TEMPLATES.has(current) ? current : "__custom__";
  document.querySelectorAll('input[name="template"]').forEach((input) => {
    input.checked = input.value === selected;
  });
  customTemplate.value = selected === "__custom__" ? current : "";
  updateCustomTemplatePreview();
  document.querySelectorAll('input[name="settings-encoding"]').forEach((input) => {
    input.checked = input.value === getStoredEncoding();
  });
  settingsError.hidden = true;
  dialog.showModal();
}

function closeSettings() {
  dialog.close();
}

function saveSettings() {
  const selected = document.querySelector('input[name="template"]:checked')?.value;
  const value = selected === "__custom__" ? customTemplate.value.trim() : selected;
  if (!value || (!value.includes("%track") && !value.includes("%title"))) {
    settingsError.textContent = "模板须至少包含 %track 或 %title。";
    settingsError.hidden = false;
    return false;
  }

  const encoding = document.querySelector('input[name="settings-encoding"]:checked')?.value || DEFAULT_ENCODING;
  localStorage.setItem(TEMPLATE_STORAGE_KEY, value);
  localStorage.setItem(ENCODING_STORAGE_KEY, KNOWN_ENCODINGS.has(encoding) ? encoding : DEFAULT_ENCODING);
  closeSettings();
  renderRoute();
  return true;
}

function selectedAlbumAndTrack(button) {
  const album = getAlbum(button.dataset.album);
  const index = Number.parseInt(button.dataset.trackIndex || "", 10);
  const track = Number.isInteger(index) ? album?.tracks[index] : undefined;
  return { album, track };
}

async function getTrackBytes(track, encoding) {
  const response = await fetch(`./lyrics/${encoding}/${track.path}`);
  if (!response.ok) throw new Error(`歌词文件无法读取（${response.status}）。`);
  return new Uint8Array(await response.arrayBuffer());
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function withBusy(button, task) {
  const original = button.innerHTML;
  button.disabled = true;
  try {
    await task((message) => { button.textContent = message; });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "下载时发生未知错误。请稍后重试。");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function downloadTrack(button) {
  const { track } = selectedAlbumAndTrack(button);
  if (!track) return;
  const encoding = currentEncoding();
  await withBusy(button, async () => {
    const bytes = await getTrackBytes(track, encoding);
    triggerDownload(new Blob([bytes], { type: `text/plain;charset=${labelForEncoding(encoding)}` }), formatFileName(track));
  });
}

async function downloadAlbum(button) {
  const album = getAlbum(button.dataset.album);
  if (!album || !album.tracks.length) return;
  const encoding = currentEncoding();
  await withBusy(button, async (setMessage) => {
    const entries = [];
    const usedNames = new Set();
    for (const [index, track] of album.tracks.entries()) {
      setMessage(`正在收集 ${index + 1}/${album.tracks.length}`);
      let name = formatFileName(track);
      let copy = 2;
      while (usedNames.has(name)) {
        name = formatFileName(track).replace(/\.lrc$/i, ` (${copy}).lrc`);
        copy += 1;
      }
      usedNames.add(name);
      entries.push({ name, data: await getTrackBytes(track, encoding) });
    }
    setMessage("正在创建 ZIP…");
    const zip = createStoredZip(entries);
    triggerDownload(new Blob([zip], { type: "application/zip" }), `${safeArchiveName(album.title)} LRC (${labelForEncoding(encoding)}).zip`);
  });
}

document.addEventListener("submit", (event) => {
  if (event.target.matches(".search-form")) {
    event.preventDefault();
    updateHomeSearch(new FormData(event.target).get("q")?.toString() || "");
  }
  if (event.target.matches(".settings-form")) {
    event.preventDefault();
    saveSettings();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches(".search-form input") && !event.isComposing) {
    updateHomeSearch(event.target.value);
  }
  if (event.target === customTemplate) {
    document.querySelector('input[name="template"][value="__custom__"]').checked = true;
    updateCustomTemplatePreview();
  }
});

document.addEventListener("compositionend", (event) => {
  if (event.target.matches(".search-form input")) {
    updateHomeSearch(event.target.value);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches('input[name="album-encoding"]')) {
    localStorage.setItem(ENCODING_STORAGE_KEY, event.target.value);
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "open-settings": showSettings(); break;
    case "close-settings": closeSettings(); break;
    case "save-settings": break;
    case "clear-search": {
      const input = document.querySelector("#album-search");
      if (input) {
        input.value = "";
        input.focus();
      }
      updateHomeSearch("");
      break;
    }
    case "download-track": downloadTrack(button); break;
    case "download-album": downloadAlbum(button); break;
    default: break;
  }
});

window.addEventListener("hashchange", renderRoute);
renderDmcaEmail();

try {
  const response = await fetch("./data/catalog.json");
  if (!response.ok) throw new Error("目录数据无法加载。");
  catalog = await response.json();
  renderRoute();
} catch (error) {
  app.innerHTML = `<div class="fatal-state"><strong>无法加载专辑目录</strong><p>${escapeHTML(error instanceof Error ? error.message : "请稍后重试。")}</p></div>`;
}
