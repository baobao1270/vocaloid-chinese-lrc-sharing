import { describe, expect, test } from "bun:test";
import { parseLrc } from "./build";

describe("LRC staff parsing", () => {
  test("Reads credits after leading empty timestamps without sorting their times", () => {
    const track = parseLrc([
      "[ti:长青赋]",
      "[00:04.700]",
      "[00:07.380]作编曲：阿泠",
      "[00:17.080]作词：安陵影钦",
      "[00:17.000]调教：流绪",
      "[00:21.000]",
      "[00:27.080]少风流 醉倚楼",
    ].join("\n"), "02 - 长青赋.lrc", 0);

    expect(track.track).toBe("02");
    expect(track.staff).toEqual([
      { role: "作编曲", name: "阿泠" },
      { role: "作词", name: "安陵影钦" },
      { role: "调教", name: "流绪" },
    ]);
  });

  test("Stops at lyrics when the staff separator is absent", () => {
    const track = parseLrc([
      "[00:00.000]作词：Example",
      "[00:01.000][洛] First lyric",
      "[00:02.000]角色：This remains a lyric",
    ].join("\n"), "01 - Example.lrc", 0);

    expect(track.staff).toEqual([{ role: "作词", name: "Example" }]);
  });

  test("Does not interpret lyric-only content as staff", () => {
    const track = parseLrc([
      "[00:00.000]",
      "[00:01.000]First lyric",
      "[00:02.000]作词：This remains a lyric",
    ].join("\n"), "01 - Example.lrc", 0);

    expect(track.staff).toEqual([]);
  });

  test("Preserves separated roles and slash-separated contributor names", () => {
    const track = parseLrc([
      "[ar:乐正绫]",
      "[00:00.000]吉他实录：疯狂奥麦斯",
      "[00:01.000]贝斯实录：疯狂奥麦斯",
      "[00:02.000]调教：FFF君/玖蝶",
      "[00:03.000]",
      "[00:04.000]First lyric",
    ].join("\n"), "07 - Alhambra.lrc", 0);

    expect(track.artist).toBe("乐正绫");
    expect(track.staff).toEqual([
      { role: "吉他实录", name: "疯狂奥麦斯" },
      { role: "贝斯实录", name: "疯狂奥麦斯" },
      { role: "调教", name: "FFF君/玖蝶" },
    ]);
  });
});
