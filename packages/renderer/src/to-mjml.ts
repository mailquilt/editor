import { loadDocument } from "@mailquilt/core";
import type { Block, Column, EmailStyle, Row } from "@mailquilt/core";
import {
  blockBoxStyles,
  blockStyles,
  columnStyles,
  EMAIL_LOOK,
  linkColor,
  menuLinks,
  onPhone,
  playMarkColor,
  rowStyles,
  SOCIAL_NETWORKS,
  socialIcons,
  videoLabel,
  videoShown,
} from "@mailquilt/core/internal";
import type {
  BlockProps,
  ColumnProps,
  RowProps,
} from "@mailquilt/core/internal";

import { escapeAttribute, escapeText } from "./escape.js";
import {
  BOXED_BLOCK,
  HIDDEN_ON_PHONES,
  PHONE_ONLY,
  PHONE_VALUES,
  ROUNDED_COLUMN,
  SHARED_COLUMN,
  SHOWN_ON_PHONES,
  SHOWN_ON_PHONES_BLOCK,
  VIDEO_LINE,
} from "./finish-html.js";
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
  headingFontFamily: string;
  socialIconsUrl: string | undefined;
  style: EmailStyle;
  /**
   * Each Box's border and corners, in the order MJML writes their Blocks, for
   * `finishHtml`, as MJML has no attribute for them on a Block.
   */
  boxes: string[];
  /**
   * Each Video's line under its picture, in the order MJML writes their
   * Blocks, for `finishHtml`, as MJML's image has nothing under it.
   */
  videoLines: string[];
  /** The email's Phone values, as CSS rules for its phone media query. */
  phoneRules: string[];
}

/** The CSS properties whose value differs on a phone, as `!important` rules. */
const changedOnPhone = (
  desktop: Record<string, string>,
  phone: Record<string, string>,
  properties: readonly string[]
) =>
  properties
    .filter((property) => phone[property] !== desktop[property])
    .flatMap((property) =>
      phone[property] === undefined
        ? []
        : [`${property}:${phone[property]} !important;`]
    )
    .join("");

const PADDING = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
] as const;

/**
 * A class for something with Phone values, whose rules, from `rules` given
 * that class's selector, join the email's phone media query. Nothing for
 * something without any, or whose Phone values change nothing.
 */
const phoneClass = (
  context: BlockContext,
  rules: (selector: string) => readonly string[]
) => {
  const name = `${PHONE_VALUES}${context.phoneRules.length + 1}`;
  const made = rules(`.${name}`);
  if (made.length === 0) {
    return;
  }
  context.phoneRules.push(made.join(" "));
  return name;
};

/**
 * The padding a Social or Menu Block's cell has, less what its icons or links
 * keep around them, or none for a Block whose cell has its Box's padding.
 */
const ownPadding = ({ props, type }: Pick<Block, "props" | "type">) => {
  if (type === "social") {
    return socialIcons(props as BlockProps["social"]).blockPadding;
  }
  return type === "menu"
    ? menuLinks(props as BlockProps["menu"]).blockPadding
    : undefined;
};

/** A rule, or none while it has nothing to set. */
const rule = (selector: string, declarations: string) =>
  declarations ? [`${selector} { ${declarations} }`] : [];

/**
 * A Block's Phone values as rules: its padding on its cell, a Social or Menu
 * Block's as its icons or links take it; its font size and line height on what's inside; and
 * an Image's width, which stops at its Column's as on a desktop.
 */
const blockPhoneRules = (block: Block, style: EmailStyle) => {
  const phone = onPhone(block);
  return (selector: string) => {
    const own = ownPadding(block);
    const padding =
      own === undefined
        ? changedOnPhone(blockBoxStyles(block), blockBoxStyles(phone), PADDING)
        : changedOnPhone(
            { padding: own },
            { padding: ownPadding(phone) as string },
            ["padding"]
          );
    const desktopLook = blockStyles(block, style);
    const phoneLook = blockStyles(phone, style);
    const { width } = phone.props as { width?: number };
    return [
      ...rule(selector, padding),
      ...rule(
        `${selector} *`,
        changedOnPhone(desktopLook, phoneLook, ["font-size", "line-height"])
      ),
      ...(block.type === "image" &&
      width !== undefined &&
      width !== block.props.width
        ? [
            `${selector} table { width:100% !important; max-width:${width}px !important; }`,
            `${selector} td { width:auto !important; }`,
          ]
        : []),
    ];
  };
};

/** A Row's or Column's padding on a phone, on the cell inside it. */
const boxPhoneRules =
  (desktop: Record<string, string>, phone: Record<string, string>) =>
  (selector: string) =>
    rule(
      `${selector} > table > tbody > tr > td`,
      changedOnPhone(desktop, phone, PADDING)
    );

/**
 * What only phones show, between markers `finishHtml` turns into markup that
 * hides it everywhere else, Outlook on Windows included.
 */
const phonesOnly = (kind: "block" | "row", mjml: string) =>
  `<mj-raw><!--${PHONE_ONLY}${kind}--></mj-raw>${mjml}<mj-raw><!--/${PHONE_ONLY}${kind}--></mj-raw>`;

/** The `css-class` attribute for these classes, or none. */
const classAttribute = (...classes: (string | false | undefined)[]) => {
  const names = classes.filter(Boolean);
  return names.length > 0 ? ` css-class="${names.join(" ")}"` : "";
};

/**
 * A Block's Box as MJML's attributes: its padding and background. Its border
 * and corners go to `finishHtml`, with a class that marks where. A Social
 * or Menu Block's padding is its own, as its icons or links take part of it.
 */
const boxAttributes = (
  block: Block,
  context: BlockContext,
  /** One more class, after the Box's, for `finishHtml`. */
  marker?: string
) => {
  const { boxes, style } = context;
  const {
    border,
    "border-radius": corners,
    "background-color": background,
    ...padding
  } = blockBoxStyles(block);
  const rest = [
    border === undefined ? "" : `border:${border};`,
    corners === undefined ? "" : `border-radius:${corners};`,
  ].join("");
  if (rest) {
    boxes.push(rest);
  }
  // The Box's class first, as `finishHtml` finds it by its start.
  const classes = classAttribute(
    rest && BOXED_BLOCK,
    marker,
    (block.props as { showOn?: string }).showOn === "desktop" &&
      HIDDEN_ON_PHONES,
    "phone" in block.props && phoneClass(context, blockPhoneRules(block, style))
  );
  return (
    mjmlAttributes({
      ...(ownPadding(block) === undefined ? padding : {}),
      ...(background === undefined
        ? {}
        : { "container-background-color": background }),
    }) + classes
  );
};

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
  return `<mj-social${attributes} icon-size="${size}px" mode="horizontal" padding="${blockPadding}">${icons.join("")}</mj-social>`;
};

/**
 * Each link that has a label and a URL, in a row that wraps, with half the gap
 * on either side of each. A space between links keeps their words apart where
 * an inbox shows the email's first words, and the row's font size of 0, which
 * a phone's font size can't change, keeps it from widening the gap. Outlook on
 * Windows ignores an inline link's padding, so there, as in MJML's navbar,
 * each link is a cell of a table.
 */
const menuToMjml = (
  props: BlockProps["menu"],
  attributes: string,
  {
    color,
    "font-size": fontSize,
    "line-height": lineHeight,
    "text-align": align,
  }: Record<string, string>,
  fontFamily: string
) => {
  const { blockPadding, linkPadding, shown } = menuLinks(props);
  const cell = `padding:0px ${linkPadding}px;`;
  const links = shown.map(
    ({ label, url }) =>
      `<a href="${escapeAttribute(url)}" style="${escapeAttribute(`display:inline-block;color:${color};font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight};text-decoration:none;word-break:break-word;overflow-wrap:anywhere;${cell}`)}">${plainTextToHtml(label)}</a>`
  );
  return `<mj-text${attributes} padding="${blockPadding}"><div style="font-size:0px !important;line-height:0px !important;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${align}"><tr><td style="${cell}"><![endif]-->${links.join(` <!--[if mso | IE]></td><td style="${cell}"><![endif]-->`)}<!--[if mso | IE]></td></tr></table><![endif]--></div></mj-text>`;
};

/**
 * A Video's line under its picture: a play mark, which screen readers skip,
 * and its words, in one link to the video. The mark is text, a ▶ kept from
 * becoming an emoji, in white or black on a round cell of the line's color,
 * which Outlook on Windows draws square.
 */
const videoLine = (
  props: BlockProps["video"],
  url: string,
  {
    color,
    "font-size": fontSize,
    "line-height": lineHeight,
  }: Record<string, string>,
  fontFamily: string
) =>
  `<tr><td align="center" style="padding:12px 0px 0px 0px;"><a href="${escapeAttribute(url)}" style="${escapeAttribute(`color:${color};font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight};text-decoration:none;`)}" target="_blank"><span aria-hidden="true" style="${escapeAttribute(`display:inline-block;width:24px;height:24px;border-radius:12px;background-color:${color};color:${playMarkColor(color as string)};font-size:10px;line-height:24px;text-align:center;vertical-align:middle;`)}">&#9654;&#65038;</span>&nbsp;&nbsp;<span style="text-decoration:underline;vertical-align:middle;word-break:break-word;overflow-wrap:anywhere;">${plainTextToHtml(videoLabel(props))}</span></a></td></tr>`;

/**
 * A Video as an image linked to it, the drawn copy while the play button is on
 * the picture, with its line under it, which `finishHtml` adds from
 * `videoLines`, marked by its class.
 */
const videoToMjml = (
  block: Extract<Block, { type: "video" }>,
  context: BlockContext,
  blockCss: Record<string, string>
) => {
  const shown = videoShown(block.props);
  if (!shown) {
    return "";
  }
  if (shown.line) {
    context.videoLines.push(
      videoLine(block.props, shown.url, blockCss, context.fontFamily)
    );
  }
  const attributes = boxAttributes(
    block,
    context,
    shown.line ? VIDEO_LINE : undefined
  );
  return `<mj-image${attributes} alt="${escapeAttribute(block.props.alt ?? "")}" href="${escapeAttribute(shown.url)}" src="${escapeAttribute(shown.picture)}"></mj-image>`;
};

/**
 * A Block as MJML. The casts are safe, as core's styles for a type always set
 * the same properties. A Block the email leaves out, such as an Image without
 * a URL, has no Box either.
 */
const blockToMjml = (block: Block, context: BlockContext) => {
  const mjml = blockMjml(block, context);
  return mjml && block.props.showOn === "phone"
    ? phonesOnly("block", mjml)
    : mjml;
};

/**
 * Whether the email leaves a Block out until it has what it shows: an Image
 * its image, a Social or Menu Block a link, and a Video its link and thumbnail.
 */
const isLeftOut = (block: Block) => {
  switch (block.type) {
    case "image": {
      return block.props.src === undefined;
    }
    case "social": {
      return block.props.links.every(({ url }) => url === undefined);
    }
    case "menu": {
      return menuLinks(block.props).shown.length === 0;
    }
    case "video": {
      return !videoShown(block.props);
    }
    default: {
      return false;
    }
  }
};

/** A Block as MJML, wherever it shows. */
const blockMjml = (block: Block, context: BlockContext) => {
  if (isLeftOut(block)) {
    return "";
  }
  const { fontFamily, headingFontFamily, style } = context;
  const blockCss = blockStyles(block, style);
  // A Video's styles are its line's, which MJML's image doesn't take, and its
  // Box has the class that marks its line.
  const attributes =
    block.type === "video"
      ? ""
      : mjmlAttributes(blockCss) + boxAttributes(block, context);
  switch (block.type) {
    case "text": {
      const textCss = blockCss as TextCss;
      return `<mj-text${attributes}>${richTextToHtml(block.props.content, fontFamily, textCss, linkColor(block.props, style, textCss.color))}</mj-text>`;
    }
    case "heading": {
      const textCss = blockCss as TextCss;
      return `<mj-text${attributes}>${headingToHtml(block.props, headingFontFamily, textCss, linkColor(block.props, style, textCss.color))}</mj-text>`;
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
    case "menu": {
      return menuToMjml(block.props, attributes, blockCss, fontFamily);
    }
    case "video": {
      return videoToMjml(block, context, blockCss);
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
  column: Column,
  context: BlockContext,
  shared: boolean
) => {
  const { blocks, props, width } = column;
  const { phone, verticalAlign } = props as ColumnProps;
  const styles = columnStyles(column);
  const phoneName =
    phone &&
    phoneClass(context, boxPhoneRules(styles, columnStyles(onPhone(column))));
  const attributes = mjmlAttributes({
    // The cell its padding goes on, which MJML adds only for padding.
    ...(phoneName && !PADDING.some((side) => side in styles)
      ? { padding: "0px" }
      : {}),
    ...styles,
    ...(verticalAlign === undefined ? {} : { "vertical-align": verticalAlign }),
  });
  const rendered = blocks.map((block) => blockToMjml(block, context));
  // A Block the email leaves out has no Box to round.
  const rounded = blocks.some(
    (block, index) =>
      rendered[index] !== "" &&
      blockBoxStyles(block)["border-radius"] !== undefined
  );
  // In this order, as `finishHtml` finds them by it.
  const classes = classAttribute(
    rounded && ROUNDED_COLUMN,
    shared && SHARED_COLUMN,
    phoneName
  );
  return `<mj-column width="${width}%"${attributes}${classes}>${rendered.join("")}</mj-column>`;
};

/**
 * Columns that share a Row stack on phones unless the Row keeps them side by
 * side, which puts them in MJML's group, with their widths inline (ADR 0005).
 */
const stacksColumns = ({ columns, props }: Row) =>
  columns.length > 1 && (props as RowProps).stackOnPhone !== false;

const rowToMjml = (row: Row, context: BlockContext) => {
  const { phone, showOn, stackOnPhone } = row.props as RowProps;
  const shared = stacksColumns(row);
  const styles = rowStyles(row);
  const classes = classAttribute(
    showOn === "desktop" && HIDDEN_ON_PHONES,
    phone && phoneClass(context, boxPhoneRules(styles, rowStyles(onPhone(row))))
  );
  const columns = row.columns
    .map((column) => columnToMjml(column, context, shared))
    .join("");
  const section = `<mj-section${mjmlAttributes(styles)}${classes}>${stackOnPhone === false ? `<mj-group>${columns}</mj-group>` : columns}</mj-section>`;
  return showOn === "phone" ? phonesOnly("row", section) : section;
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
  const style = settings.style ?? {};
  const context: BlockContext = {
    boxes: [],
    phoneRules: [],
    videoLines: [],
    fontFamily: settings.fontFamily,
    headingFontFamily: style.headingFontFamily ?? settings.fontFamily,
    socialIconsUrl,
    style,
  };
  // Behind every Row, unless a Row sets its own.
  const sectionColor = style.emailBackgroundColor
    ? ` background-color="${escapeAttribute(style.emailBackgroundColor)}"`
    : "";
  const body = rows.map((row) => rowToMjml(row, context)).join("");
  const things = rows.flatMap((row) => [
    row,
    ...row.columns.flatMap(({ blocks }) => blocks),
  ]);
  const shownOn = (device: string) =>
    things.some(
      ({ props }) => (props as { showOn?: string }).showOn === device
    );
  const phoneRules = [
    rows.some(stacksColumns)
      ? `.${SHARED_COLUMN} { max-width:100% !important; }`
      : "",
    shownOn("desktop")
      ? `.${HIDDEN_ON_PHONES} { display:none !important; }`
      : "",
    shownOn("phone")
      ? `.${SHOWN_ON_PHONES} { display:block !important; max-height:none !important; overflow:visible !important; } .${SHOWN_ON_PHONES_BLOCK} { display:table-row !important; }`
      : "",
    ...context.phoneRules,
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
  // MJML loads each only where a font-family in the HTML names it, so a heading
  // font in an email with no Heading isn't loaded. The URL isn't escaped, as
  // MJML writes it as it is into an @import's url() too, where &amp; would stay
  // &amp;. Core checked that it holds nothing to end either, and the name too.
  const fonts = (settings.fonts ?? [])
    .map(({ name, url }) => `<mj-font name="${name}" href="${url}" />`)
    .join("");
  const mjml = `<mjml${language}>
  <mj-head>
    ${preheader}
    ${fonts}
    ${phoneStyles}
    <mj-attributes>
      <mj-all font-family="${escapeAttribute(settings.fontFamily)}" />
      <mj-section padding="0"${sectionColor} />
      <mj-text padding="${EMAIL_LOOK.blockPadding}" />
      <mj-button font-size="${EMAIL_LOOK.fontSize}" line-height="${EMAIL_LOOK.lineHeight}" padding="${EMAIL_LOOK.blockPadding}" />
      <mj-image padding="${EMAIL_LOOK.blockPadding}" />
      <mj-divider padding="${EMAIL_LOOK.blockPadding}" />
      <mj-social padding="${EMAIL_LOOK.blockPadding}" />
      <mj-social-element border-radius="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${escapeAttribute(settings.backgroundColor)}" width="${settings.width}px">
    ${body}
  </mj-body>
</mjml>`;
  // In the order MJML writes the Columns, for `finishHtml`.
  const sharedRowWidths = rows
    .filter(stacksColumns)
    .flatMap((row) => row.columns.map(() => innerWidth(row, settings.width)));
  return {
    boxes: context.boxes,
    mjml,
    sharedRowWidths,
    videoLines: context.videoLines,
  };
};
