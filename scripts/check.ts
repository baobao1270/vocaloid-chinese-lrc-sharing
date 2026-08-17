import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStoredZip } from "../site/zip.js";

type Catalog = {
  albums: Array<{
    id: string;
    cover: string | null;
    tracks: Array<{
      path: string;
      track: string;
      title: string;
      author: string | null;
      artist: string | null;
      lrc_by: string | null;
      staff: Array<{ role: string; name: string }>;
    }>;
  }>;
};

const catalog = (await Bun.file("dist/data/catalog.json").json()) as Catalog;
const sourceAlbums = (await readdir("data", { withFileTypes: true })).filter((entry) => entry.isDirectory());
let expectedTracks = 0;
const gb18030Pairs: string[] = [];

for (const album of sourceAlbums) {
  const files = await readdir(join("data", album.name), { withFileTypes: true });
  expectedTracks += files.filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".lrc")).length;
}

if (catalog.albums.length !== sourceAlbums.length) {
  throw new Error(`Expected ${sourceAlbums.length} albums, found ${catalog.albums.length}.`);
}

const actualTracks = catalog.albums.reduce((sum, album) => sum + album.tracks.length, 0);
if (actualTracks !== expectedTracks) {
  throw new Error(`Expected ${expectedTracks} tracks, found ${actualTracks}.`);
}

for (const album of catalog.albums) {
  if (album.cover) {
    if (!/^covers\/.+\.webp$/.test(album.cover)) {
      throw new Error(`Invalid cover path for ${album.id}: ${album.cover}`);
    }
    const cover = Bun.file(`dist/${decodeURIComponent(album.cover)}`);
    if (!(await cover.exists()) || (await cover.size) === 0) {
      throw new Error(`Missing WebP cover for ${album.id}.`);
    }
  }

  const seen = new Set<string>();
  for (const track of album.tracks) {
    if (!track.title || !track.track || !/^[a-f0-9]{64}\.lrc$/.test(track.path) || seen.has(`${track.track}\0${track.title}`)) {
      throw new Error(`Invalid track data in ${album.id}.`);
    }
    if ("file" in track) {
      throw new Error(`Track ${album.id}/${track.title} should not expose both file and path.`);
    }
    if (track.staff.some((credit) => typeof credit.role !== "string" || typeof credit.name !== "string" || !credit.role || !credit.name)) {
      throw new Error(`Invalid staff data in ${album.id}/${track.title}.`);
    }
    seen.add(`${track.track}\0${track.title}`);

    for (const encoding of ["utf8", "gb18030"]) {
      const file = Bun.file(`dist/lyrics/${encoding}/${track.path}`);
      if (!(await file.exists()) || (await file.size) === 0) {
        throw new Error(`Missing ${encoding} download for ${album.id}/${track.title}.`);
      }
    }

    gb18030Pairs.push(
      `dist/lyrics/utf8/${track.path}`,
      `dist/lyrics/gb18030/${track.path}`,
    );
  }
}

const python = Bun.spawn(["python3", "scripts/verify_gb18030.py", ...gb18030Pairs], { stdout: "ignore", stderr: "pipe" });
const [exitCode, stderr] = await Promise.all([python.exited, new Response(python.stderr).text()]);
if (exitCode !== 0) {
  throw new Error(`GB18030 validation failed: ${stderr.trim()}`);
}

const tempDirectory = await mkdtemp(join(tmpdir(), "vocaloid-chinese-lrc-sharing."));
const archivePath = join(tempDirectory, "archive.zip");
try {
  await Bun.write(archivePath, createStoredZip([
    { name: "01 - 测试歌曲.lrc", data: new TextEncoder().encode("[ti:测试歌曲]\r\n") },
    { name: "02 - sample.lrc", data: new TextEncoder().encode("[ti:sample]\r\n") },
  ]));
  const zipVerifier = Bun.spawn([
    "python3",
    "-c",
    String.raw`import sys, zipfile; archive = zipfile.ZipFile(sys.argv[1]); assert archive.testzip() is None; assert archive.read('01 - 测试歌曲.lrc') == '[ti:测试歌曲]\r\n'.encode('utf-8'); assert archive.read('02 - sample.lrc') == b'[ti:sample]\r\n'`,
    archivePath,
  ], { stdout: "ignore", stderr: "pipe" });
  const [zipExitCode, zipStderr] = await Promise.all([zipVerifier.exited, new Response(zipVerifier.stderr).text()]);
  if (zipExitCode !== 0) {
    throw new Error(`ZIP validation failed: ${zipStderr.trim()}`);
  }
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

console.log(`Verified ${catalog.albums.length} albums and ${actualTracks} LRC files in both encodings.`);
