import { describe, expect, it } from "vitest";

import { createEditor, createEmail } from "../src/index.js";
import type { BlocksDocument } from "../src/index.js";
import { menuLinks } from "../src/internal.js";

const withMenu = (): BlocksDocument => {
  const document = createEmail();
  const column = document.rows[0]?.columns[0];
  if (column) {
    column.blocks = [{ id: "menu-1", props: { links: [] }, type: "menu" }];
  }
  return document;
};

const propsOf = (document: BlocksDocument) =>
  document.rows[0]?.columns[0]?.blocks[0]?.props;

const setProps = (props: Record<string, unknown>) => {
  const editor = createEditor({ document: withMenu() });
  const result = editor.apply({
    blockId: "menu-1",
    props,
    type: "updateBlockProps",
  });
  return { document: editor.getDocument(), result };
};

describe("Menu Block", () => {
  it("stores its links in order, with their alignment, color, size and gap", () => {
    const props = {
      align: "right",
      color: "#3b2a20",
      fontSize: 13,
      gap: 22,
      links: [
        { label: "Shop", url: "https://northbound.co/shop" },
        { label: "{{plan}} plans", url: "{{plans_url}}" },
        { label: "Journal" },
        { url: "https://northbound.co/about" },
        {},
      ],
      phone: { fontSize: 12 },
    };

    const { document, result } = setProps(props);

    expect(result).toStrictEqual({ ok: true });
    expect(propsOf(document)).toStrictEqual(props);
  });

  it("has no links when it's new", () => {
    const editor = createEditor({ document: createEmail() });
    const columnId = editor.getDocument().rows[0]?.columns[0]?.id ?? "";

    editor.apply({
      blockType: "menu",
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
      { links: [{ label: "Shop", url: "javascript:alert(1)" }] },
      /url/u,
    ],
    [
      "a blank label",
      { links: [{ label: " ", url: "https://a.co" }] },
      /blank/u,
    ],
    ["a gap over 100px", { gap: 101, links: [] }, /gap/u],
  ])("refuses %s", (_name, props, reason) => {
    expect(setProps(props).result).toStrictEqual({
      code: "invalidProps",
      ok: false,
      reason: expect.stringMatching(reason),
    });
  });
});

describe(menuLinks, () => {
  it("shows only links with a label and a URL, half the gap either side of each", () => {
    expect(
      menuLinks({
        gap: 20,
        links: [
          { label: "Shop", url: "https://a.co/shop" },
          { label: "Journal" },
          { url: "https://a.co/about" },
        ],
      })
    ).toStrictEqual({
      blockPadding: "16px 6px 16px 6px",
      linkPadding: 10,
      shown: [{ label: "Shop", url: "https://a.co/shop" }],
    });
  });

  it("never puts the links further out than the Block's edge", () => {
    expect(
      menuLinks({ links: [], paddingLeft: 4, paddingTop: 8 }).blockPadding
    ).toBe("8px 4px 16px 0px");
  });
});
