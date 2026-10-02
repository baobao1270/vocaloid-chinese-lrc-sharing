import { createHash } from "node:crypto";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

type AlbumContent = {
  description?: string;
  copyright?: string;
  vcpedia_link?: string;
  color?: string;
};

type SiteContent = {
  _color?: Record<string, string>;
  [album: string]: AlbumContent | Record<string, string> | undefined;
};

type StaffCredit = {
  role: string;
  name: string;
};

type Track = {
  path: string;
  track: string;
  title: string;
  author: string | null;
  artist: string | null;
  lrc_by: string | null;
  staff: StaffCredit[];
};

type Album = {
  id: string;
  title: string;
  cover: string | null;
  tracks: Track[];
  description?: string;
  copyright?: string;
  vcpediaLink: string;
  color?: string;
};

const projectRoot = resolve(import.meta.dir, "..");
const lyricsRoot = join(projectRoot, "data");
const siteRoot = join(projectRoot, "site");
const distRoot = join(projectRoot, "dist");

function assetPath(...segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function parseStaffLine(line: string): StaffCredit {
  const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (!match) return { role: "其他", name: line };
  return { role: match[1].trim(), name: match[2].trim() };
}

function sha256Hex(data: ArrayBuffer) {
  return createHash("sha256").update(new Uint8Array(data)).digest("hex");
}

export function parseLrc(text: string, fileName: string, fileOrder: number): Omit<Track, "path"> {
  const metadata = new Map<string, string>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const timedLine = /^(?:\[[0-9]{1,3}:[0-5][0-9](?:[.:][0-9]{1,3})?])+\s*(.*)$/;
  const staff: StaffCredit[] = [];
  let beforeLyrics = true;

  for (const line of lines) {
    const tag = line.match(/^\[([A-Za-z]+):(.*)]\s*$/);
    if (tag) {
      metadata.set(tag[1].toLowerCase(), tag[2].trim());
      continue;
    }

    const timestamp = line.match(timedLine);
    if (!timestamp || !beforeLyrics) {
      continue;
    }

    const content = timestamp[1].trim();
    if (!content) {
      if (staff.length) beforeLyrics = false;
    } else if (/^[^:：]+[:：]\s*\S/.test(content)) {
      staff.push(parseStaffLine(content));
    } else {
      beforeLyrics = false;
    }
  }

  const fromName = fileName.replace(/\.lrc$/i, "").match(/^\s*(\d+)\s*-\s*(.+)$/);
  const track = fromName?.[1] ?? String(fileOrder + 1).padStart(2, "0");
  const title = metadata.get("ti") || fromName?.[2] || basename(fileName, extname(fileName));

  return {
    track,
    title,
    author: metadata.get("au") || null,
    artist: metadata.get("ar") || null,
    lrc_by: metadata.get("by") || null,
    staff,
  };
}

async function convertAllToGb18030(pairs: string[]) {
  const python = Bun.spawn(["python3", join(projectRoot, "scripts", "encode_gb18030.py"), ...pairs], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([
    python.exited,
    new Response(python.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(`GB18030 conversion failed. Python 3 is required: ${stderr.trim()}`);
  }
}

function albumContentFor(siteContent: SiteContent, albumName: string): AlbumContent {
  const content = siteContent[albumName];
  if (!content || Array.isArray(content)) return {};
  return content as AlbumContent;
}

function sharedTrackField(tracks: Track[], field: "artist" | "author") {
  if (!tracks.length) return null;

  const values = tracks.map((track) => track[field]?.trim()).filter(Boolean);
  if (values.length !== tracks.length) return null;

  const uniqueValues = new Set(values);
  return uniqueValues.size === 1 ? values[0] : null;
}

function colorForAlbum(siteContent: SiteContent, tracks: Track[], content: AlbumContent) {
  if (content.color) return content.color;

  const colorMap = siteContent._color || {};
  const sharedArtist = sharedTrackField(tracks, "artist");
  if (sharedArtist && colorMap[sharedArtist]) return colorMap[sharedArtist];

  const sharedAuthor = sharedTrackField(tracks, "author");
  if (sharedAuthor && colorMap[sharedAuthor]) return colorMap[sharedAuthor];

  return undefined;
}

async function build() {
  const siteContentFile = Bun.file(join(projectRoot, "site-content.yaml"));
  const siteContent = ((await siteContentFile.exists()) ? Bun.YAML.parse(await siteContentFile.text()) : {}) as SiteContent;
  const albumEntries = await readdir(lyricsRoot, { withFileTypes: true });

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await cp(siteRoot, distRoot, { recursive: true });

  const gitSha = await (async () => {
    const git = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], { stdout: "pipe", stderr: "ignore" });
    const [exitCode, stdout] = await Promise.all([git.exited, new Response(git.stdout).text()]);
    return exitCode === 0 ? stdout.trim() : "unknown";
  })();
  for (const file of ["index.html", "404.html"]) {
    const path = join(distRoot, file);
    const htmlFile = Bun.file(path);
    if (await htmlFile.exists()) {
      const html = await htmlFile.text();
      await Bun.write(path, html.replace(/<!--\s*SITE_VERSION\s*-->/g, gitSha));
    }
  }

  const albums: Album[] = [];
  const gb18030Pairs: string[] = [];
  let totalTracks = 0;

  for (const entry of albumEntries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))) {
    const albumPath = join(lyricsRoot, entry.name);
    const directFiles = await readdir(albumPath, { withFileTypes: true });
    const lrcFiles = directFiles
      .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".lrc"))
      .map((item) => item.name)
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }));
    const artwork = directFiles.find((item) => item.isFile() && /^AlbumArtwork\.[a-z0-9]+$/i.test(item.name));
    const tracks: Track[] = [];

    for (const [index, lrcFile] of lrcFiles.entries()) {
      const source = join(albumPath, lrcFile);
      const sourceFile = Bun.file(source);
      const sourceText = await sourceFile.text();
      const sourceBytes = await sourceFile.arrayBuffer();
      const assetRelativePath = `${sha256Hex(sourceBytes)}.lrc`;
      const utf8Output = join(distRoot, "lyrics", "utf8", assetRelativePath);
      const gb18030Output = join(distRoot, "lyrics", "gb18030", assetRelativePath);

      await mkdir(join(utf8Output, ".."), { recursive: true });
      await mkdir(join(gb18030Output, ".."), { recursive: true });
      await Bun.write(utf8Output, sourceBytes);
      gb18030Pairs.push(source, gb18030Output);

      tracks.push({
        path: assetRelativePath,
        ...parseLrc(sourceText, lrcFile, index),
      });
    }

    let cover: string | null = null;
    if (artwork) {
      const source = join(albumPath, artwork.name);
      const outputName = `${entry.name}.webp`;
      const output = join(distRoot, "covers", outputName);
      await mkdir(join(output, ".."), { recursive: true });
      await sharp(source).webp({ quality: 86 }).toFile(output);
      cover = assetPath("covers", outputName);
    }

    const content = albumContentFor(siteContent, entry.name);
    const color = colorForAlbum(siteContent, tracks, content);

    totalTracks += tracks.length;
    albums.push({
      id: entry.name,
      title: entry.name,
      cover,
      tracks,
      vcpediaLink: content.vcpedia_link || `https://vcpedia.cn/${encodeURIComponent(entry.name)}`,
      ...(content.description ? { description: content.description } : {}),
      ...(content.copyright ? { copyright: content.copyright } : {}),
      ...(color ? { color } : {}),
    });
  }

  await convertAllToGb18030(gb18030Pairs);

  await mkdir(join(distRoot, "data"), { recursive: true });
  await Bun.write(
    join(distRoot, "data", "catalog.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), albums })}\n`,
  );

  console.log(`Built ${albums.length} albums and ${totalTracks} tracks into dist/.`);
}

if (import.meta.main) await build();
