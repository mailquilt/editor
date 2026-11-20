import { loadDocument } from "@mailquilt/core";
import type { Block, Column, Row } from "@mailquilt/core";
import { blockStyles, EMAIL_LOOK, rowStyles } from "@mailquilt/core/internal";

import { escapeAttribute, escapeText } from "./escape.js";
import { SHARED_COLUMN } from "./finish-html.js";
import {
  headingToHtml,
  plainTextToHtml,
  richTextToHtml,
} from "./text-to-html.js";
import type { TextCss } from "./text-to-html.js";

// An email as MJML: its settings, Rows, Columns and Blocks, with each Block's
// text written by `text-to-html.ts`.

/** MJML's attributes share their CSS names, apart from this one. */
const mjmlAttributes = (styles: Record<string, string>) =>
  Object.entries(styles)
    .map(
      ([name, value]) =>
        ` ${name === "text-align" ? "align" : name}="${escapeAttribute(value)}"`
    )
    .join("");

const linkAttribute = (href: string | undefined) =>
  href === undefined ? "" : ` href="${escapeAttribute(href)}"`;

/**
 * A Block as MJML. The casts are safe, as core's styles for a type always set
 * the same properties.
 */
const blockToMjml = (block: Block, fontFamily: string) => {
  const blockCss = blockStyles(block);
  const attributes = mjmlAttributes(blockCss);
  switch (block.type) {
    case "text": {
      return `<mj-text${attributes}>${richTextToHtml(block.props.content, blockCss as TextCss)}</mj-text>`;
    }
    case "heading": {
      return `<mj-text${attributes}>${headingToHtml(block.props, fontFamily, blockCss as TextCss)}</mj-text>`;
    }
    case "button": {
      const { href, label } = block.props;
      return `<mj-button${attributes}${linkAttribute(href)}>${plainTextToHtml(label)}</mj-button>`;
    }
    case "image": {
      const { alt = "", href, src } = block.props;
      // Until it has a URL, there's no image, and a link would have nothing in it.
      if (src === undefined) {
        return "";
      }
      return `<mj-image${attributes} alt="${escapeAttribute(alt)}" src="${escapeAttribute(src)}"${linkAttribute(href)}></mj-image>`;
    }
    case "divider": {
      return `<mj-divider${attributes}></mj-divider>`;
    }
    case "spacer": {
      return `<mj-spacer${attributes}></mj-spacer>`;
    }
    // Never reached, as core checked each Block's type. A type this doesn't
    // handle fails to compile here.
    default: {
      const unknown: never = block;
      throw new Error(`Can't render unknown Block ${JSON.stringify(unknown)}`);
    }
  }
};

const columnToMjml = (
  { blocks, width }: Column,
  fontFamily: string,
  shared: boolean
) =>
  `<mj-column width="${width}%"${shared ? ` css-class="${SHARED_COLUMN}"` : ""}>${blocks.map((block) => blockToMjml(block, fontFamily)).join("")}</mj-column>`;

const rowToMjml = (row: Row, fontFamily: string) =>
  `<mj-section${mjmlAttributes(rowStyles(row))}>${row.columns.map((column) => columnToMjml(column, fontFamily, row.columns.length > 1)).join("")}</mj-section>`;

/** Throws if the document can't be trusted, and renders migrated older ones. */
export const toMjml = (document: unknown) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const sharedColumns = rows.some(({ columns }) => columns.length > 1)
    ? `<mj-style>@media only screen and (max-width:479px) { .${SHARED_COLUMN} { max-width:100% !important; } }</mj-style>`
    : "";
  const language = settings.language
    ? ` lang="${escapeAttribute(settings.language)}"`
    : "";
  const preheader = settings.preheader
    ? `<mj-preview>${escapeText(settings.preheader)}</mj-preview>`
    : "";
  const mjml = `<mjml${language}>
  <mj-head>
    ${preheader}
    ${sharedColumns}
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0" />
      <mj-text padding="${EMAIL_LOOK.blockPadding}" />
      <mj-button font-size="${EMAIL_LOOK.fontSize}" line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-image padding="${EMAIL_LOOK.blockPadding}" />
      <mj-divider padding="${EMAIL_LOOK.blockPadding}" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map((row) => rowToMjml(row, settings.fontFamily)).join("")}
  </mj-body>
</mjml>`;
  return { emailWidth: settings.width, mjml };
};
