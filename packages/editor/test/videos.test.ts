import { describe, expect, it } from "vitest";

import { youTubeId } from "../src/videos.js";

describe(youTubeId, () => {
  it.each([
    ["a watch link", "https://www.youtube.com/watch?v=q8Ln2kXa_-9&t=42"],
    [
      "a phone's watch link",
      "https://m.youtube.com/watch?feature=x&v=q8Ln2kXa_-9",
    ],
    ["a short link", "https://youtu.be/q8Ln2kXa_-9?si=abc"],
    ["a Short", "https://youtube.com/shorts/q8Ln2kXa_-9"],
    ["an embed link", "https://www.youtube-nocookie.com/embed/q8Ln2kXa_-9"],
    ["a live link", "https://www.youtube.com/live/q8Ln2kXa_-9"],
    ["a YouTube Music link", "https://music.youtube.com/watch?v=q8Ln2kXa_-9"],
  ])("finds the video in %s", (_name, url) => {
    expect(youTubeId(url)).toBe("q8Ln2kXa_-9");
  });

  it.each([
    ["another site", "https://vimeo.com/824190553"],
    ["a channel", "https://www.youtube.com/@northbound"],
    ["a Merge Tag", "{{video_url}}"],
    [
      "a site that only ends like YouTube",
      "https://notyoutube.com/watch?v=q8Ln2kXa_-9",
    ],
  ])("finds no video in %s", (_name, url) => {
    expect(youTubeId(url)).toBeUndefined();
  });
});
