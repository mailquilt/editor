import { loadDocument } from "@mailquilt/core";
import type { Block, RichTextParagraph } from "@mailquilt/core";
import { menuLinks, SOCIAL_NETWORKS } from "@mailquilt/core/internal";

import { ADDRESS_IN_TEXT } from "./text-patterns.js";

// An email as plain text, for email apps that show only text: its words, each
// link's URL, and each Merge Tag as written, so a sending service still fills
// it in.

type Inline = NonNullable<RichTextParagraph["content"]>[number];

const hrefOf = ({ marks }: Inline) =>
  marks?.find((mark) => mark.type === "link")?.attrs.href;

/** Writes a Heading's words in capitals, in the email's language. */
type Capitals = (text: string) => string;

/**
 * Capitals in `language`, or in no language in particular when it isn't a
 * code a browser knows, such as a Merge Tag. Each URL, email address and Merge
 * Tag written in the text stays as written, as one could stop working.
 */
const capitalsIn = (language: string | undefined): Capitals => {
  let locale: string | undefined;
  try {
    locale = language && Intl.getCanonicalLocales(language)[0];
  } catch {
    locale = undefined;
  }
  return (text) => {
    let capitals = "";
    let from = 0;
    for (const { 0: kept, index } of text.matchAll(ADDRESS_IN_TEXT)) {
      capitals += text.slice(from, index).toLocaleUpperCase(locale) + kept;
      from = index + kept.length;
    }
    return capitals + text.slice(from).toLocaleUpperCase(locale);
  };
};

/**
 * A run of text as written, in capitals for a Heading, then its link's URL,
 * unless the text already is the URL.
 */
const runToText = (
  run: string,
  href: string | undefined,
  capitals: Capitals | undefined
) => {
  const isUrl = href === run.trim() || href === `mailto:${run.trim()}`;
  const written = capitals && !isUrl ? capitals(run) : run;
  return href === undefined || isUrl ? written : `${written} (${href})`;
};

/**
 * A line of text, with a Heading's words in capitals. A link's URL follows its
 * text, read across any change of formatting or line break, so a partly bold
 * link is one.
 */
const lineToText = (inline: Inline[] = [], capitals?: Capitals) => {
  let line = "";
  // Text with the same link, or none.
  let run = "";
  let href: string | undefined;
  for (const node of inline) {
    if (node.type === "hardBreak") {
      run += "\n";
      continue;
    }
    const nodeHref = hrefOf(node);
    if (nodeHref !== href) {
      line += runToText(run, href, capitals);
      run = "";
      href = nodeHref;
    }
    run += node.type === "mergeTag" ? `{{${node.attrs.name}}}` : node.text;
  }
  return line + runToText(run, href, capitals);
};

/** A Block as text, or nothing for one with no words. */
const blockToText = (block: Block, capitals: Capitals) => {
  switch (block.type) {
    case "heading": {
      return block.props.content.content
        .map((paragraph) => lineToText(paragraph.content, capitals))
        .join("\n");
    }
    case "text": {
      return block.props.content.content
        .map((node) =>
          node.type === "paragraph"
            ? lineToText(node.content)
            : node.content
                .map(
                  ({ content: [item] }, index) =>
                    `${node.type === "bulletList" ? "-" : `${index + 1}.`} ${lineToText(item.content)}`
                )
                .join("\n")
        )
        .join("\n");
    }
    case "button": {
      const { href, label } = block.props;
      return href === undefined ? label : `${label}: ${href}`;
    }
    case "image": {
      const { alt = "", href, src } = block.props;
      // Until it has a URL, there's no image, as in the HTML.
      if (src === undefined) {
        return "";
      }
      if (alt.trim() === "") {
        return "";
      }
      return href === undefined ? `[${alt}]` : `[${alt}] (${href})`;
    }
    case "social": {
      return block.props.links
        .flatMap(({ network, url }) =>
          url === undefined ? [] : [`${SOCIAL_NETWORKS[network]}: ${url}`]
        )
        .join("\n");
    }
    case "menu": {
      return menuLinks(block.props)
        .shown.map(({ label, url }) => `${label}: ${url}`)
        .join("\n");
    }
    case "divider":
    case "spacer": {
      return "";
    }
    // Never reached, as core checked each Block's type. A type this doesn't
    // handle fails to compile here.
    default: {
      const unknown: never = block;
      throw new Error(`Can't write unknown Block ${JSON.stringify(unknown)}`);
    }
  }
};

/**
 * Writes a saved email as plain text, to send beside its HTML. `document` is
 * checked as `renderEmail` checks it, and this throws with the reason if it
 * isn't an email Mail Quilt accepts. It needs no MJML, so it returns at once.
 */
export const renderText = (document: unknown) => {
  const loaded = loadDocument(document);
  if (!loaded.ok) {
    throw new Error(loaded.reason);
  }
  const { rows, settings } = loaded.document;
  const capitals = capitalsIn(settings.language);
  return rows
    .flatMap((row) => row.columns)
    .flatMap((column) => column.blocks)
    .map((block) => blockToText(block, capitals))
    .filter((block) => block.trim() !== "")
    .join("\n\n");
};
