import type { Block, BlocksDocument, EmailStyle } from "@mailquilt/core";
import { blockStyles, hexColor, videoLook } from "@mailquilt/core/internal";

import { blocksIn } from "./positions.js";

// What the Style Mode needs that has no page: the colors its picker shows, and
// what each Email style setting reaches in an email.

/** A color as the picker shows it: hue in degrees, saturation and brightness from 0 to 1. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** A color core takes, as the picker shows it, or nothing for one it doesn't. */
export const hsvOf = (color: string): Hsv | undefined => {
  const hex = hexColor(color);
  if (hex === undefined) {
    return;
  }
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(
    (start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255
  );
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  let h = 0;
  if (range > 0) {
    if (max === r) {
      h = ((g - b) / range) % 6;
    } else if (max === g) {
      h = (b - r) / range + 2;
    } else {
      h = (r - g) / range + 4;
    }
  }
  return {
    h: (h * 60 + 360) % 360,
    s: max === 0 ? 0 : range / max,
    v: max,
  };
};

/** The picker's color, as #rrggbb. */
export const hexOfHsv = ({ h, s, v }: Hsv) => {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
};

/** What a person sets in Style: the email's page color and body font, and its Email style. */
export type StyleKey = keyof EmailStyle | "backgroundColor" | "fontFamily";

/** What a setting changes, by Row or Block ID, and what keeps a value of its own. */
export interface Reach {
  changes: string[];
  keeps: { id: string; value: number | string }[];
}

/** Whether a Block's text, or any part of it, is a link. */
const hasLink = (node: unknown): boolean => {
  const { content, marks } = node as {
    content?: unknown[];
    marks?: { type: string }[];
  };
  return (
    (marks?.some(({ type }) => type === "link") ?? false) ||
    (content?.some(hasLink) ?? false)
  );
};

/** Reached, and the prop of a Block's own that wins, if it can have one. */
type Reached = { own?: string } | undefined;

const isText = ({ type }: Block) => type === "text" || type === "heading";

/** A Video whose line under its picture shows. */
const hasVideoLine = (block: Block) =>
  block.type === "video" && videoLook(block.props).line;

const headingSize =
  (level: 1 | 2 | 3) =>
  (block: Block): Reached =>
    block.type === "heading" && block.props.level === level
      ? { own: "fontSize" }
      : undefined;

/**
 * For each setting but the page's and the email's colors: whether it
 * reaches a Block, and the prop of the Block's own that wins over it.
 */
const REACHES: Record<
  Exclude<StyleKey, "backgroundColor" | "emailBackgroundColor">,
  (block: Block, style: EmailStyle) => Reached
> = {
  buttonBackgroundColor: ({ type }) =>
    type === "button" ? { own: "backgroundColor" } : undefined,
  buttonBorderRadius: ({ type }) => (type === "button" ? {} : undefined),
  fontFamily: (block, style) =>
    block.type === "text" ||
    block.type === "button" ||
    block.type === "menu" ||
    hasVideoLine(block) ||
    (block.type === "heading" && style.headingFontFamily === undefined)
      ? {}
      : undefined,
  heading1FontSize: headingSize(1),
  heading2FontSize: headingSize(2),
  heading3FontSize: headingSize(3),
  headingFontFamily: ({ type }) => (type === "heading" ? {} : undefined),
  linkColor: (block) =>
    hasVideoLine(block) ||
    (isText(block) && hasLink((block.props as { content: unknown }).content))
      ? { own: "color" }
      : undefined,
  // Text that's all links shows the links' color while Email style sets one.
  // A Menu's links are in the text's color, not the links'.
  // A Video's line is a link, in the text's color while there's no links' color.
  textColor: (block, style) =>
    block.type === "menu" ||
    (hasVideoLine(block) && style.linkColor === undefined) ||
    (isText(block) &&
      !(
        style.linkColor !== undefined &&
        (block.props as { color?: string }).color === undefined &&
        isAllLinks((block.props as { content: unknown }).content)
      ))
      ? { own: "color" }
      : undefined,
  textFontSize: (block) => {
    if (block.type === "button" || hasVideoLine(block)) {
      return {};
    }
    return block.type === "text" || block.type === "menu"
      ? { own: "fontSize" }
      : undefined;
  },
};

/**
 * The Rows or Blocks a setting changes, in the email's order, and those that
 * keep a value of their own, which wins over it.
 */
export const reachOf = (key: StyleKey, email: BlocksDocument): Reach => {
  const reach: Reach = { changes: [], keeps: [] };
  const add = (id: string, own: unknown) => {
    if (own === undefined) {
      reach.changes.push(id);
    } else {
      reach.keeps.push({ id, value: own as number | string });
    }
  };
  // The page is around the email, which the Canvas doesn't draw.
  if (key === "backgroundColor") {
    return reach;
  }
  if (key === "emailBackgroundColor") {
    for (const { id, props } of email.rows) {
      add(id, (props as { backgroundColor?: string }).backgroundColor);
    }
    return reach;
  }
  const style = email.settings.style ?? {};
  for (const block of blocksIn(email)) {
    const found = REACHES[key](block, style);
    if (found) {
      add(
        block.id,
        found.own === undefined
          ? undefined
          : (block.props as Record<string, unknown>)[found.own]
      );
    }
  }
  return reach;
};

/** MJML's corners for a Button, which the export keeps until Email style sets its own. */
const MJML_BUTTON_CORNERS = 3;

/**
 * Whether every piece of a Block's text is a link, and it has some, outside a
 * List, whose markers take the text's color.
 */
const isAllLinks = (node: unknown): boolean => {
  const texts: { marks?: { type: string }[] }[] = [];
  let hasList = false;
  const collect = (part: unknown) => {
    const { content, type } = part as { content?: unknown[]; type?: string };
    if (type === "bulletList" || type === "orderedList") {
      hasList = true;
    }
    if (type === "text" || type === "mergeTag") {
      texts.push(part as { marks?: { type: string }[] });
    }
    for (const child of content ?? []) {
      collect(child);
    }
  };
  collect(node);
  return (
    !hasList &&
    texts.length > 0 &&
    texts.every(({ marks }) => marks?.some(({ type }) => type === "link"))
  );
};

const HEADING_LEVELS = {
  heading1FontSize: 1,
  heading2FontSize: 2,
  heading3FontSize: 3,
} as const;

const emptyText = () => ({
  content: [{ type: "paragraph" as const }],
  type: "doc" as const,
});

/** A size core writes in pixels, such as "32px", as a number. */
const pixels = (css: string | undefined) => Number((css ?? "").slice(0, -2));

const styleOf = (block: Pick<Block, "props" | "type">) =>
  blockStyles(block, {});

/**
 * What a setting is until it's set: the built-in look, read from core's own
 * styles, or nothing where it falls back to another setting, as the email's
 * color does to the page, links to text, and Headings to the body font.
 */
export const builtInOf = (key: StyleKey): number | string | undefined => {
  switch (key) {
    case "textColor": {
      return styleOf({ props: { content: emptyText() }, type: "text" }).color;
    }
    case "textFontSize": {
      return pixels(
        styleOf({ props: { content: emptyText() }, type: "text" })["font-size"]
      );
    }
    case "heading1FontSize":
    case "heading2FontSize":
    case "heading3FontSize": {
      return pixels(
        styleOf({
          props: { content: emptyText(), level: HEADING_LEVELS[key] },
          type: "heading",
        })["font-size"]
      );
    }
    case "buttonBackgroundColor": {
      return styleOf({ props: { label: "Button" }, type: "button" })[
        "background-color"
      ];
    }
    case "buttonBorderRadius": {
      return MJML_BUTTON_CORNERS;
    }
    default: {
      return undefined;
    }
  }
};

/** A value a Block sets over Email style, and what Email style gives every other. */
export interface OwnValue {
  key: StyleKey;
  prop: string;
  own: number | string;
  shared: number | string;
}

/** Each kind of Block's own props that win over Email style, size before color. */
const OWN_KEYS = {
  button: [["buttonBackgroundColor", "backgroundColor"]],
  heading: [
    ["heading", "fontSize"],
    ["textColor", "color"],
  ],
  menu: [
    ["textFontSize", "fontSize"],
    ["textColor", "color"],
  ],
  text: [
    ["textFontSize", "fontSize"],
    ["textColor", "color"],
  ],
} as const;

const sameValue = (a: number | string, b: number | string) =>
  typeof a === "string" && typeof b === "string"
    ? (hexColor(a) ?? a) === (hexColor(b) ?? b)
    : a === b;

/**
 * The values `block` sets of its own that differ from what Email style, or
 * else the built-in look, gives every Block like it.
 */
export const ownValuesOf = (block: Block, style: EmailStyle): OwnValue[] => {
  if (!(block.type in OWN_KEYS)) {
    return [];
  }
  const props = block.props as Record<string, unknown>;
  return OWN_KEYS[block.type as keyof typeof OWN_KEYS].flatMap(
    ([which, prop]) => {
      const key: StyleKey =
        which === "heading"
          ? (`heading${props.level as 1 | 2 | 3}FontSize` as const)
          : which;
      const own = props[prop] as number | string | undefined;
      const shared = style[key as keyof EmailStyle] ?? builtInOf(key);
      return own === undefined || shared === undefined || sameValue(own, shared)
        ? []
        : [{ key, own, prop, shared }];
    }
  );
};
