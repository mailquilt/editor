import { loadDocument } from "@mailquilt/core";
import type { Block, Column, Row } from "@mailquilt/core";
import {
  blockStyles,
  EMAIL_LOOK,
  rowStyles,
  SOCIAL_NETWORKS,
  socialIcons,
} from "@mailquilt/core/internal";
import type { BlockProps, RowProps } from "@mailquilt/core/internal";

import { escapeAttribute, escapeText } from "./escape.js";
import { SHARED_COLUMN } from "./finish-html.js";
import { socialIconUrl } from "./social-icons.js";
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

/** How the email is rendered, apart from the email itself. */
export interface RenderEmailOptions {
  /**
   * The URL of a folder holding the Social Block's icons, copied from this
   * package's `icons`, in place of jsDelivr.
   */
  socialIconsUrl?: string | undefined;
}

/** What every Block is rendered with. */
interface BlockContext {
  fontFamily: string;
  socialIconsUrl: string | undefined;
}

/**
 * Each link that has a URL, as an icon with the network's name as its alt text.
 * Each icon's image is given, so MJML loads none from Mailjet.
 */
const socialToMjml = (
  props: BlockProps["social"],
  attributes: string,
  { socialIconsUrl }: BlockContext
) => {
  const { blockPadding, iconPadding, size, style } = socialIcons(props);
  const links = props.links.filter(
    (link): link is typeof link & { url: string } => link.url !== undefined
  );
  // As an Image without a URL, until a link has one.
  if (links.length === 0) {
    return "";
  }
  const icons = links.map(({ network, url }) => {
    const label = SOCIAL_NETWORKS[network];
    return `<mj-social-element alt="${escapeAttribute(label)}" href="${escapeAttribute(url)}" padding="${iconPadding}px" src="${escapeAttribute(socialIconUrl(network, style, socialIconsUrl))}"></mj-social-element>`;
  });
  return `<mj-social${attributes} icon-size="${size}px" mode="horizontal" padding="${blockPadding}px">${icons.join("")}</mj-social>`;
};

/**
 * A Block as MJML. The casts are safe, as core's styles for a type always set
 * the same properties.
 */
const blockToMjml = (block: Block, context: BlockContext) => {
  const { fontFamily } = context;
  const blockCss = blockStyles(block);
  const attributes = mjmlAttributes(blockCss);
  switch (block.type) {
    case "text": {
      return `<mj-text${attributes}>${richTextToHtml(block.props.content, fontFamily, blockCss as TextCss)}</mj-text>`;
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
    case "social": {
      return socialToMjml(block.props, attributes, context);
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
  context: BlockContext,
  shared: boolean
) =>
  `<mj-column width="${width}%"${shared ? ` css-class="${SHARED_COLUMN}"` : ""}>${blocks.map((block) => blockToMjml(block, context)).join("")}</mj-column>`;

/** Hides a Row below the phone width, where the email keeps its `<style>`. */
const HIDDEN_ON_PHONES = "mq-hide-phone";

/**
 * Columns that share a Row stack on phones unless the Row keeps them side by
 * side, which puts them in MJML's group, with their widths inline (ADR 0005).
 */
const stacksColumns = ({ columns, props }: Row) =>
  columns.length > 1 && (props as RowProps).stackOnPhone !== false;

const rowToMjml = (row: Row, context: BlockContext) => {
  const { hideOnPhone, stackOnPhone } = row.props as RowProps;
  const shared = stacksColumns(row);
  const columns = row.columns
    .map((column) => columnToMjml(column, context, shared))
    .join("");
  return `<mj-section${mjmlAttributes(rowStyles(row))}${hideOnPhone ? ` css-class="${HIDDEN_ON_PHONES}"` : ""}>${stackOnPhone === false ? `<mj-group>${columns}</mj-group>` : columns}</mj-section>`;
};

/** The room a Row leaves its Columns, inside its padding. */
const innerWidth = ({ props }: Row, emailWidth: number) => {
  const { paddingLeft = 0, paddingRight = 0 } = props as RowProps;
  return emailWidth - paddingLeft - paddingRight;
};

/** Throws if the document can't be trusted, and renders migrated older ones. */
export const toMjml = (
  document: unknown,
  { socialIconsUrl }: RenderEmailOptions = {}
) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const phoneRules = [
    rows.some(stacksColumns)
      ? `.${SHARED_COLUMN} { max-width:100% !important; }`
      : "",
    rows.some(({ props }) => (props as RowProps).hideOnPhone)
      ? `.${HIDDEN_ON_PHONES} { display:none !important; }`
      : "",
  ].filter(Boolean);
  const phoneStyles =
    phoneRules.length > 0
      ? `<mj-style>@media only screen and (max-width:479px) { ${phoneRules.join(" ")} }</mj-style>`
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
    ${phoneStyles}
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0" />
      <mj-text padding="${EMAIL_LOOK.blockPadding}" />
      <mj-button font-size="${EMAIL_LOOK.fontSize}" line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-image padding="${EMAIL_LOOK.blockPadding}" />
      <mj-divider padding="${EMAIL_LOOK.blockPadding}" />
      <mj-social padding="${EMAIL_LOOK.blockPadding}" />
      <mj-social-element border-radius="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${rows.map((row) => rowToMjml(row, { fontFamily: settings.fontFamily, socialIconsUrl })).join("")}
  </mj-body>
</mjml>`;
  // In the order MJML writes the Columns, for `finishHtml`.
  const sharedRowWidths = rows
    .filter(stacksColumns)
    .flatMap((row) => row.columns.map(() => innerWidth(row, settings.width)));
  return { mjml, sharedRowWidths };
};
