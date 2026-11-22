import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";

const withSocial = (): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "social-1", props: { links: [] }, type: "social" }];
  }
  return document;
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setProps = (props: Record<string, unknown>) => {
  const editor = createEditor({ document: withSocial() });
  const result = editor.apply({
    blockId: "social-1",
    props,
    type: "updateBlockProps",
  });
  return { document: editor.getDocument(), result };
};

describe("Social Block", () => {
  it("stores its links in order, with their icons' style, size and alignment", () => {
    const props = {
      align: "center",
      iconSize: 48,
      iconStyle: "white",
      links: [
        { network: "youtube", url: "https://youtube.com/@shop" },
        { network: "facebook", url: "{{facebook_url}}" },
        { network: "website" },
      ],
    };

    const { document, result } = setProps(props);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual(props);
  });

  it("has no links when it's new", () => {
    const editor = createEditor({ document: createEmail() });
    const columnId = editor.getDocument().rows[0]?.columns[0]?.id ?? "";

    editor.apply({
      blockType: "social",
      columnId,
      index: 0,
      type: "insertBlock",
    });

    expect(propsOf(editor.getDocument())).toStrictEqual({ links: [] });
  });

  it.each([
    [
      "a URL the link allowlist refuses",
      // oxlint-disable-next-line no-script-url -- What's being refused.
      { links: [{ network: "x", url: "javascript:alert(1)" }] },
      /url/u,
    ],
    [
      "a network twice",
      {
        links: [
          { network: "x", url: "https://x.com/shop" },
          { network: "x", url: "https://x.com/other" },
        ],
      },
      /once/u,
    ],
    [
      "a network it has no icon for",
      { links: [{ network: "myspace", url: "https://myspace.com/shop" }] },
      /network/u,
    ],
    [
      "an icon size between its three",
      { iconSize: 36, links: [] },
      /iconSize/u,
    ],
  ])("refuses %s", (_name, props, reason) => {
    expect(setProps(props).result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});
