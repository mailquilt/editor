import { describe, expect, it } from "vitest";

import type { Block, Row } from "../src/index.js";
import { copiedJson, loadCopied } from "../src/internal.js";

const button: Block = {
  id: "b1",
  props: {
    backgroundColor: "#ff0000",
    href: "https://example.com",
    label: "Buy",
  },
  type: "button",
};

const row: Row = {
  columns: [
    { blocks: [button], id: "c1", props: {}, width: 50 },
    { blocks: [], id: "c2", props: {}, width: 50 },
  ],
  id: "r1",
  props: { backgroundColor: "#eeeeee" },
};

describe(loadCopied, () => {
  it("reads back a copied Block with every setting", () => {
    expect(loadCopied(copiedJson({ block: button }))).toStrictEqual({
      block: button,
      ok: true,
    });
  });

  it("reads back a copied Row with its Columns and Blocks", () => {
    expect(loadCopied(copiedJson({ row }))).toStrictEqual({ ok: true, row });
  });

  it("migrates a Block copied by an older version", () => {
    const json = JSON.stringify({
      block: {
        id: "t1",
        props: {
          content: {
            content: [
              {
                content: [{ text: "Hi {{name}}", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
        },
        type: "text",
      },
      version: 2,
    });

    expect(loadCopied(json)).toMatchObject({
      block: {
        props: {
          content: {
            content: [
              {
                content: [
                  { text: "Hi ", type: "text" },
                  { attrs: { name: "name" }, type: "mergeTag" },
                ],
              },
            ],
          },
        },
      },
      ok: true,
    });
  });

  // A crafted clipboard can't hold more than a saved email can.
  it.each([
    [
      "JSON that's malformed",
      `{"version":3,"block":`,
      "The copied content isn't JSON",
    ],
    [
      "a newer version, with the message value gives",
      JSON.stringify({ block: button, version: 5 }),
      "Version 5 is newer than the supported version 4",
    ],
    [
      "an unknown Block type",
      JSON.stringify({
        block: { id: "x", props: {}, type: "video" },
        version: 3,
      }),
      "block.type: Invalid type",
    ],
    [
      "a refused link",
      JSON.stringify({
        block: {
          ...button,
          // oxlint-disable-next-line no-script-url -- What's being refused.
          props: { ...button.props, href: "javascript:alert(1)" },
        },
        version: 3,
      }),
      "block.props.href:",
    ],
    [
      "a refused link in a Row, named in the Row",
      JSON.stringify({
        row: {
          ...row,
          columns: [
            {
              blocks: [
                { ...button, props: { ...button.props, href: "ftp://x" } },
              ],
              id: "c1",
              props: {},
              width: 100,
            },
          ],
        },
        version: 3,
      }),
      "row.columns.0.blocks.0.props.href:",
    ],
    [
      "neither a Block nor a Row",
      JSON.stringify({ version: 3 }),
      "Copied content holds one Block or one Row",
    ],
    [
      "a field it doesn't know",
      JSON.stringify({ block: button, script: "x", version: 3 }),
      "Copied content holds one Block or one Row",
    ],
    [
      "something that isn't an object",
      "[]",
      "Copied content holds one Block or one Row",
    ],
  ])("refuses %s", (_case, json, reason) => {
    const result = loadCopied(json);

    expect(result.ok).toBeFalsy();
    expect(result).toHaveProperty("reason", expect.stringContaining(reason));
  });
});
