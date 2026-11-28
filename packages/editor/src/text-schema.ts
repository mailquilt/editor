import { isAllowedLinkHref, isMergeTagName } from "@mailquilt/core/internal";
import { Schema } from "prosemirror-model";
import type { MarkSpec, NodeSpec } from "prosemirror-model";

/**
 * The marks of ADR 0001. Their names, order and HTML rules are the ones saved
 * and pasted text have always been read with (ADR 0003). Links come first, so
 * they stay around the others in the JSON and in the HTML.
 */
// oxlint-disable-next-line sort-keys -- The order is the JSON's.
const marks = {
  // Only the URL, as `core` requires. Parsing goes through core's check, so a
  // pasted link can't get past it.
  link: {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [
      {
        getAttrs: (element) => {
          const href = element.getAttribute("href") ?? "";
          return isAllowedLinkHref(href) ? { href } : false;
        },
        tag: "a[href]",
      },
    ],
    toDOM: ({ attrs }) => ["a", { href: attrs.href }, 0],
  },
  bold: {
    parseDOM: [
      { tag: "strong" },
      {
        getAttrs: (element) => element.style.fontWeight !== "normal" && null,
        tag: "b",
      },
      {
        clearMark: (mark) => mark.type.name === "bold",
        style: "font-weight=400",
      },
      {
        getAttrs: (value) =>
          /^(?:bold(?:er)?|[5-9]\d{2,})$/u.test(value) && null,
        style: "font-weight",
      },
    ],
    toDOM: () => ["strong", 0],
  },
  italic: {
    parseDOM: [
      { tag: "em" },
      {
        getAttrs: (element) => element.style.fontStyle !== "normal" && null,
        tag: "i",
      },
      {
        clearMark: (mark) => mark.type.name === "italic",
        style: "font-style=normal",
      },
      { style: "font-style=italic" },
    ],
    toDOM: () => ["em", 0],
  },
  underline: {
    parseDOM: [
      { tag: "u" },
      {
        consuming: false,
        getAttrs: (value) => (value.includes("underline") ? {} : false),
        style: "text-decoration",
      },
    ],
    toDOM: () => ["u", 0],
  },
} satisfies Record<string, MarkSpec>;

/**
 * Paragraphs of text, line breaks and Merge Tags, the nodes of ADR 0001 and
 * ADR 0017.
 */
const nodes = {
  doc: { content: "block+" },
  hardBreak: {
    group: "inline",
    inline: true,
    // A line of its own when copied as plain text.
    leafText: () => "\n",
    linebreakReplacement: true,
    parseDOM: [{ tag: "br" }],
    selectable: false,
    toDOM: () => ["br"],
  },
  /**
   * One unit of text. On the Canvas, the text view draws it with the Host app's
   * label. This is what a copy holds: `{{name}}`, with its braces hidden where
   * the editor's styles apply.
   */
  mergeTag: {
    atom: true,
    attrs: { name: { validate: "string" } },
    group: "inline",
    inline: true,
    leafText: ({ attrs }) => `{{${attrs.name as string}}}`,
    parseDOM: [
      {
        getAttrs: (element) => {
          const name = element.dataset.mergeTag ?? "";
          return isMergeTagName(name) ? { name } : false;
        },
        tag: "span[data-merge-tag]",
      },
    ],
    selectable: false,
    toDOM: ({ attrs }) => {
      const name = attrs.name as string;
      return [
        "span",
        { "data-merge-tag": name, "data-tooltip": `{{${name}}}` },
        ["span", { class: "merge-tag-hidden" }, "{{"],
        name,
        ["span", { class: "merge-tag-hidden" }, "}}"],
      ];
    },
  },
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  },
  text: { group: "inline" },
} satisfies Record<string, NodeSpec>;

/**
 * Bulleted and numbered Lists, one level deep, with one paragraph in each item.
 * A List pasted inside an item is skipped, so its items join the List around
 * it as items of their own.
 */
const lists = {
  bulletList: {
    content: "listItem+",
    group: "block",
    parseDOM: [
      { priority: 60, skip: true, tag: "li ul, li ol" },
      { tag: "ul" },
    ],
    toDOM: () => ["ul", 0],
  },
  listItem: {
    content: "paragraph",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0],
  },
  orderedList: {
    content: "listItem+",
    group: "block",
    parseDOM: [{ tag: "ol" }],
    toDOM: () => ["ol", 0],
  },
} satisfies Record<string, NodeSpec>;

/**
 * What a Block's text can hold. Each type of Block with text has its own, and
 * only a Text Block's has Lists.
 */
export const createTextSchema = ({ lists: withLists }: { lists: boolean }) =>
  new Schema({ marks, nodes: withLists ? { ...nodes, ...lists } : nodes });

export type TextSchema = ReturnType<typeof createTextSchema>;
