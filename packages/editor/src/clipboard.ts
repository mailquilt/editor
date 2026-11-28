import type { Block, NewBlock, Row } from "@mailquilt/core";
import {
  copiedJson,
  loadCopied,
  menuLinks,
  SOCIAL_NETWORKS,
  videoLabel,
  videoShown,
} from "@mailquilt/core/internal";
import type { BlockProps, PasteRefusalCode } from "@mailquilt/core/internal";
import { DOMSerializer } from "prosemirror-model";

import { BLOCK_VIEWS, hasRichText } from "./block-types.js";
import { inertBody } from "./pasted-html.js";
import { pastedContent } from "./pasted-text.js";

/**
 * What a copy puts on the clipboard, and what a paste reads from it (ADR 0018).
 * A copy is plain text and simple HTML, made without MJML, whose wrapper holds
 * the Block or Row as JSON, so a paste into a Mail Quilt editor is exact and a
 * paste anywhere else is readable.
 */

/** The wrapper's attribute that holds what was copied, as JSON. */
const COPIED = "data-mail-quilt";

/** A Social Block's links that have a URL, as the export has them, each with its network's name. */
const linkedNetworks = (links: BlockProps["social"]["links"]) =>
  links.flatMap(({ network, url }) =>
    url === undefined ? [] : [{ label: SOCIAL_NETWORKS[network], url }]
  );

/** A Social or Menu Block's links as the export has them, each with its words. */
const linksOf = (block: Block) => {
  if (block.type === "social") {
    return linkedNetworks(block.props.links);
  }
  return block.type === "menu" ? menuLinks(block.props).shown : [];
};

/** A Block's text, with each Merge Tag as `{{name}}` and a blank line between paragraphs. */
const textOf = (block: Block) => {
  if (hasRichText(block)) {
    const { schema } = BLOCK_VIEWS[block.type].text;
    const doc = schema.nodeFromJSON(block.props.content);
    return doc.textBetween(0, doc.content.size, "\n\n");
  }
  if (block.type === "button") {
    return block.props.label;
  }
  if (block.type === "social" || block.type === "menu") {
    return linksOf(block)
      .map(({ label, url }) => `${label}: ${url}`)
      .join("\n");
  }
  if (block.type === "video") {
    // As the export has it: its line's words and its link, once it shows.
    const shown = videoShown(block.props);
    return shown?.line
      ? `${videoLabel(block.props)}: ${shown.url}`
      : (shown?.url ?? "");
  }
  return block.type === "image" ? (block.props.alt ?? "") : "";
};

/** A link, or else what it would wrap. */
const linked = (doc: Document, href: string | undefined, content: Node) => {
  if (href === undefined) {
    return content;
  }
  const link = doc.createElement("a");
  link.href = href;
  link.append(content);
  return link;
};

/** A Block as simple HTML: its text with its marks and Lists, an `img`, a link or a rule. */
const htmlOf = (doc: Document, block: Block): Node[] => {
  if (hasRichText(block)) {
    const { schema } = BLOCK_VIEWS[block.type].text;
    const text = schema.nodeFromJSON(block.props.content);
    const serializer = DOMSerializer.fromSchema(schema);
    if (block.type === "text") {
      return [serializer.serializeFragment(text.content, { document: doc })];
    }
    return text.children.map((paragraph) => {
      const heading = doc.createElement(`h${block.props.level}`);
      heading.append(
        serializer.serializeFragment(paragraph.content, { document: doc })
      );
      return heading;
    });
  }
  switch (block.type) {
    case "button": {
      const paragraph = doc.createElement("p");
      paragraph.append(
        linked(doc, block.props.href, doc.createTextNode(block.props.label))
      );
      return [paragraph];
    }
    case "image": {
      const { alt, href, src, width } = block.props;
      if (src === undefined) {
        return [];
      }
      const image = doc.createElement("img");
      image.src = src;
      image.alt = alt ?? "";
      if (width !== undefined) {
        image.width = width;
      }
      return [linked(doc, href, image)];
    }
    case "video": {
      // Its picture, linked to it, and its line, as the export has them.
      const shown = videoShown(block.props);
      if (!shown) {
        return [];
      }
      const image = doc.createElement("img");
      image.src = shown.picture;
      image.alt = block.props.alt ?? "";
      const line = doc.createElement("p");
      line.append(
        linked(doc, shown.url, doc.createTextNode(videoLabel(block.props)))
      );
      return [linked(doc, shown.url, image), ...(shown.line ? [line] : [])];
    }
    case "divider": {
      return [doc.createElement("hr")];
    }
    case "social":
    case "menu": {
      const links = linksOf(block);
      if (links.length === 0) {
        return [];
      }
      const paragraph = doc.createElement("p");
      for (const [index, { label, url }] of links.entries()) {
        paragraph.append(
          ...(index === 0 ? [] : [" "]),
          linked(doc, url, doc.createTextNode(label))
        );
      }
      return [paragraph];
    }
    default: {
      return [];
    }
  }
};

/** Puts a copy of a Block or Row on the clipboard, as text and as HTML. */
export const writeCopy = (
  data: DataTransfer,
  copied: { block: Block } | { row: Row }
) => {
  // A document of its own, where an Image's URL doesn't load.
  const doc = document.implementation.createHTMLDocument("");
  const wrapper = doc.createElement("div");
  wrapper.setAttribute(COPIED, copiedJson(copied));
  // A Row's Columns each in an element of its own.
  const columns =
    "block" in copied
      ? [{ blocks: [copied.block], holder: wrapper }]
      : copied.row.columns.map(({ blocks }) => ({
          blocks,
          holder: doc.createElement("div"),
        }));
  for (const { blocks, holder } of columns) {
    holder.append(...blocks.flatMap((block) => htmlOf(doc, block)));
    if (holder !== wrapper) {
      wrapper.append(holder);
    }
  }
  data.setData("text/html", wrapper.outerHTML);
  data.setData(
    "text/plain",
    columns
      .flatMap(({ blocks }) => blocks.map(textOf))
      .filter(Boolean)
      .join("\n\n")
  );
};

/**
 * What a paste brings, read as untrusted, or why it can't be pasted: as core
 * refused it, or with nothing in it that can, such as only spaces.
 */
export type Pasted =
  | { block: NewBlock }
  | { row: Row }
  | { files: File[] }
  | { refused: PasteRefusalCode | "nothing" };

/** The JSON a copy from a Mail Quilt editor holds, if the HTML is one. */
const copiedIn = (html: string) => {
  const holder = inertBody(html);
  return holder.querySelector(`[${COPIED}]`)?.getAttribute(COPIED) ?? undefined;
};

/**
 * What the clipboard brings outside any text: what a Mail Quilt editor copied,
 * checked by core, else image files, else text or HTML from outside as a Text
 * Block. Files come only without text, as an app such as Word puts a picture
 * of the text beside it. Refused as "nothing" when none of it can be pasted.
 */
export const readPasted = (data: DataTransfer): Pasted => {
  const html = data.getData("text/html");
  const text = data.getData("text/plain");
  const copied = html ? copiedIn(html) : undefined;
  if (copied !== undefined) {
    const loaded = loadCopied(copied);
    if (!loaded.ok) {
      return { refused: loaded.code };
    }
    return "row" in loaded
      ? { row: loaded.row }
      : { block: { props: loaded.block.props, type: loaded.block.type } };
  }
  const files = [...data.files];
  if (files.length > 0 && text === "") {
    return { files };
  }
  const content = pastedContent(BLOCK_VIEWS.text.text.schema, { html, text });
  return content
    ? { block: { props: { content }, type: "text" } }
    : { refused: "nothing" };
};
