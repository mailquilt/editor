import { describe, expect, it } from "vitest";

import type { Block, Row } from "../src/index.js";
import { copiedJson, DOCUMENT_VERSION, loadCopied } from "../src/internal.js";

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

const NEWER = DOCUMENT_VERSION + 1;

describe(loadCopied, () => {
  it("reads back a copied Block", () => {
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
      "notCopied",
    ],
    [
      "a newer version, with the message value gives",
      JSON.stringify({ block: button, version: NEWER }),
      `Version ${NEWER} is newer than the supported version ${DOCUMENT_VERSION}`,
      "newerVersion",
    ],
    [
      "a newer version that adds a field of its own",
      JSON.stringify({ block: button, version: NEWER, wrapper: {} }),
      `Version ${NEWER} is newer`,
      "newerVersion",
    ],
    [
      "a version above this one that isn't a whole number",
      JSON.stringify({ block: button, version: DOCUMENT_VERSION + 0.5 }),
      "version:",
      "invalid",
    ],
    [
      "a Row that's null",
      JSON.stringify({ row: null, version: 3 }),
      "row: Invalid type",
      "invalid",
    ],
    [
      "both a Block and a Row",
      JSON.stringify({ block: button, row, version: 3 }),
      "Copied content holds one Block or one Row",
      "notCopied",
    ],
    [
      "an unknown Block type",
      JSON.stringify({
        block: { id: "x", props: {}, type: "carousel" },
        version: 3,
      }),
      "block.type: Invalid type",
      "invalid",
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
      "invalid",
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
      "invalid",
    ],
    [
      "neither a Block nor a Row",
      JSON.stringify({ version: 3 }),
      "Copied content holds one Block or one Row",
      "notCopied",
    ],
    [
      "a field it doesn't know",
      JSON.stringify({ block: button, script: "x", version: 3 }),
      "Copied content holds one Block or one Row",
      "notCopied",
    ],
    [
      "something that isn't an object",
      "[]",
      "Copied content holds one Block or one Row",
      "notCopied",
    ],
  ])("refuses %s", (_case, json, reason, code) => {
    expect(loadCopied(json)).toStrictEqual({
      code,
      ok: false,
      reason: expect.stringContaining(reason),
    });
  });
});
