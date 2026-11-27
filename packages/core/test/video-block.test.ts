import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";
import {
  blockSettingsFields,
  playMarkColor,
  videoShown,
} from "../src/internal.js";

const withVideo = (): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "video-1", props: {}, type: "video" }];
  }
  return document;
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setProps = (props: Record<string, unknown>) => {
  const editor = createEditor({ document: withVideo() });
  const result = editor.apply({
    blockId: "video-1",
    props,
    type: "updateBlockProps",
  });
  return { document: editor.getDocument(), result };
};

const fieldKeys = (props: Record<string, unknown>) =>
  blockSettingsFields({ props, type: "video" }).map(({ key }) => key);

describe("Video Block", () => {
  it("stores its link, thumbnail, alt text, play button and line", () => {
    const props = {
      alt: "Roaster tipping beans",
      color: "#9a4a1c",
      label: "Watch {{first_name}}'s roast",
      play: "on",
      playThumbnail: "https://cdn.example.com/q8Ln2kXa-play.jpg",
      thumbnail: "https://i.ytimg.com/vi/q8Ln2kXa/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=q8Ln2kXa",
    };

    const { document, result } = setProps(props);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual(props);
  });

  it("has nothing set when it's new", () => {
    const editor = createEditor({ document: createEmail() });
    const columnId = editor.getDocument().rows[0]?.columns[0]?.id ?? "";

    editor.apply({
      blockType: "video",
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(propsOf(editor.getDocument())).toStrictEqual({});
  });

  it.each([
    [
      "a link the link allowlist refuses",
      // oxlint-disable-next-line no-script-url -- What's being refused.
      { url: "javascript:alert(1)" },
      /url/u,
    ],
    [
      "a thumbnail the image allowlist refuses",
      { thumbnail: "data:image/png;base64,AAAA" },
      /thumbnail/u,
    ],
    ["a blank line", { label: " " }, /blank/u],
    ["a play button it doesn't have", { play: "over" }, /play/u],
  ])("refuses %s", (_name, props, reason) => {
    expect(setProps(props).result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });

  it("has the line's fields only while the line shows", () => {
    expect(fieldKeys({})).toContain("label");
    expect(fieldKeys({ play: "none" })).not.toContain("label");
  });
});

describe(videoShown, () => {
  const shown = {
    thumbnail: "https://a.co/t.jpg",
    url: "https://a.co/v",
  };

  it.each([
    ["without a link", { thumbnail: shown.thumbnail }, undefined],
    ["without a thumbnail", { url: shown.url }, undefined],
    [
      "with the line below",
      shown,
      { line: true, picture: shown.thumbnail, url: shown.url },
    ],
    [
      "with the play button drawn on a copy",
      { ...shown, play: "on", playThumbnail: "https://a.co/p.jpg" },
      { line: false, picture: "https://a.co/p.jpg", url: shown.url },
    ],
    [
      "with the line, set on the picture but with no copy drawn",
      { ...shown, play: "on" },
      { line: true, picture: shown.thumbnail, url: shown.url },
    ],
    [
      "with neither",
      { ...shown, play: "none", playThumbnail: "https://a.co/p.jpg" },
      { line: false, picture: shown.thumbnail, url: shown.url },
    ],
  ] as const)(
    "shows a Video %s as the email does",
    (_name, props, expected) => {
      expect(videoShown(props)).toStrictEqual(expected);
    }
  );
});

describe(playMarkColor, () => {
  it.each([
    ["a dark line", "#9a4a1c", "#ffffff"],
    ["a light line", "#fde68a", "#000000"],
    ["a light line written as rgb()", "rgb(255, 255, 255)", "#000000"],
  ])("draws the ▶ in the color that reads best on %s", (_name, line, mark) => {
    expect(playMarkColor(line)).toBe(mark);
  });
});
