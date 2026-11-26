import type {
  ApplyResult,
  Block,
  BlocksDocument,
  Command,
  EmailSettings,
} from "@mailquilt/core";
import {
  blockSettingsFields,
  EMAIL_SETTINGS_FIELDS,
  hexColor,
} from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { live } from "lit/directives/live.js";

import { closestPlace, findPlace, place } from "./editor-places.js";
import {
  builtInOf,
  hexOfHsv,
  hsvOf,
  ownValuesOf,
  reachOf,
} from "./email-style.js";
import type { Hsv, OwnValue, StyleKey } from "./email-style.js";
import type { EditorFocus } from "./focus.js";
import { ICONS } from "./icons.js";
import type { Direction } from "./positions.js";
import type { StringId } from "./strings.js";
import { styleProperties } from "./style-properties.js";
import type { Text } from "./text.js";

// The Style Mode's panel: the email's Email style, its page color and body
// font, and the values a selected Block keeps as its own. Hovering or focusing
// a setting marks on the Canvas what it changes, through `marks`.

/** How a setting is picked. */
type Kind = "color" | "corners" | "font" | "size";

interface Setting {
  key: StyleKey;
  kind: Kind;
  label: StringId;
  /** What it shows unset, where it falls back to another setting. */
  unset?: StringId;
}

const COLORS: readonly Setting[] = [
  { key: "backgroundColor", kind: "color", label: "style.page" },
  {
    key: "emailBackgroundColor",
    kind: "color",
    label: "style.email",
    unset: "style.sameAsPage",
  },
  { key: "textColor", kind: "color", label: "style.text" },
  { key: "buttonBackgroundColor", kind: "color", label: "style.buttons" },
  {
    key: "linkColor",
    kind: "color",
    label: "style.links",
    unset: "style.sameAsText",
  },
];

const FONTS: readonly Setting[] = [
  {
    key: "headingFontFamily",
    kind: "font",
    label: "style.headings",
    unset: "style.sameAsBody",
  },
  { key: "fontFamily", kind: "font", label: "style.body" },
];

const SIZES: readonly (Setting & { heading: boolean })[] = [
  {
    heading: true,
    key: "heading1FontSize",
    kind: "size",
    label: "style.heading1",
  },
  {
    heading: true,
    key: "heading2FontSize",
    kind: "size",
    label: "style.heading2",
  },
  {
    heading: true,
    key: "heading3FontSize",
    kind: "size",
    label: "style.heading3",
  },
  {
    heading: false,
    key: "textFontSize",
    kind: "size",
    label: "style.bodyText",
  },
];

const CORNERS_SETTING: Setting = {
  key: "buttonBorderRadius",
  kind: "corners",
  label: "style.corners",
};

const SETTINGS: readonly Setting[] = [
  ...COLORS,
  ...FONTS,
  ...SIZES,
  CORNERS_SETTING,
];

/** Button corners, as `s12` draws them: a pill is rounder than any Button is tall. */
const CORNERS = [
  { drawn: 0, label: "style.square", radius: 0 },
  { drawn: 4, label: "style.rounded", radius: 8 },
  { drawn: 8, label: "style.pill", radius: 100 },
] as const satisfies readonly {
  /** On its tile's 16px bar, so the three look apart. */
  drawn: number;
  label: StringId;
  radius: number;
}[];

const settingOf = (key: StyleKey) =>
  SETTINGS.find((setting) => setting.key === key);

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** Where a press in the shade is: saturation across, brightness up. */
const shadeAt = (element: HTMLElement, { clientX, clientY }: PointerEvent) => {
  const box = element.getBoundingClientRect();
  return {
    s: clamp((clientX - box.left) / box.width),
    v: 1 - clamp((clientY - box.top) / box.height),
  };
};

/** A size typed in its field: empty clears it, and what isn't a number is refused. */
const typedSize = ({ validity, value }: HTMLInputElement) => {
  if (validity.badInput) {
    return Number.NaN;
  }
  return value.trim() === "" ? null : Number(value);
};

const fontOptionId = (index: number) => `style-font-${index}`;

/** Where a popover is, from its panel, and how tall it can be. */
interface Placed {
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/** About how tall each popover is with all it holds. */
const POPOVER_HEIGHTS: Record<Kind, number> = {
  color: 360,
  corners: 0,
  font: 420,
  size: 150,
};

/**
 * The room a popover has: the editor, which clips it, below its top bar, which
 * stays in sight as the page scrolls, and in the window.
 */
const roomFor = (anchor: Element) => {
  const editor = closestPlace(anchor, "editor")?.getBoundingClientRect();
  // Such as "52px".
  const topBar = Number(
    getComputedStyle(anchor)
      .getPropertyValue("--_mq-top-bar-height")
      .trim()
      .slice(0, -2)
  );
  return {
    bottom: Math.min(editor?.bottom ?? innerHeight, innerHeight),
    top: Math.max(editor?.top ?? 0, 0) + (topBar || 0),
  };
};

/**
 * A color's popover is beside the panel, level with its setting, and moves up
 * as far as it needs to fit. The others open under their setting, or above
 * it where there's less room below than they need and more above. Each
 * scrolls in what room it has.
 */
const placeBy = (kind: Kind, anchor: HTMLElement): Placed => {
  const panel = closestPlace(anchor, "stylePanel")?.getBoundingClientRect();
  const panelTop = panel?.top ?? 0;
  const panelBottom = panel?.bottom ?? 0;
  const box = anchor.getBoundingClientRect();
  const room = roomFor(anchor);
  const gap = 8;
  const needs = POPOVER_HEIGHTS[kind];
  if (kind === "color") {
    const maxHeight = Math.min(needs, room.bottom - room.top - 2 * gap);
    const top = Math.max(
      room.top + gap,
      Math.min(box.top, room.bottom - gap - maxHeight)
    );
    return { maxHeight, top: top - panelTop };
  }
  const below = room.bottom - box.bottom - 4 - gap;
  const above = box.top - 4 - room.top - gap;
  if (below >= needs || below >= above) {
    return { maxHeight: below, top: box.bottom + 4 - panelTop };
  }
  return { bottom: panelBottom - box.top + 4, maxHeight: above };
};

/** The email's own settings, which always have a value, rather than Email style's. */
const isEmailSetting = (
  key: StyleKey
): key is "backgroundColor" | "fontFamily" =>
  key === "backgroundColor" || key === "fontFamily";

const valueOf = (key: StyleKey, settings: EmailSettings) =>
  isEmailSetting(key) ? settings[key] : settings.style?.[key];

/** Sets a value, or with `null`, clears it back to the built-in look. */
const setCommand = (key: StyleKey, value: number | string | null): Command =>
  isEmailSetting(key)
    ? { settings: { [key]: value }, type: "updateEmailSettings" }
    : { style: { [key]: value }, type: "updateEmailStyle" };

/** The system fonts, as the email's font has always offered them. */
const SYSTEM_FONTS =
  EMAIL_SETTINGS_FIELDS.find(({ key }) => key === "fontFamily")?.type ===
  "select"
    ? (
        EMAIL_SETTINGS_FIELDS.find(({ key }) => key === "fontFamily") as {
          options: readonly { labelId: string; value: number | string }[];
        }
      ).options.map(({ labelId, value }) => ({
        label: labelId as StringId,
        value: String(value),
      }))
    : [];

/** The limits of a font size, as core checks them for a Text Block's. */
const FONT_SIZE_LIMITS = (() => {
  const field = blockSettingsFields({
    props: { content: { content: [{ type: "paragraph" }], type: "doc" } },
    type: "text",
  }).find(({ key }) => key === "fontSize");
  return field?.type === "number"
    ? { max: field.max, min: field.min }
    : { max: undefined, min: 1 };
})();

/** A font's name, as its list names it, or else its first family. */
const fontName = (value: string, text: Text) => {
  const known = SYSTEM_FONTS.find((font) => font.value === value);
  return known
    ? text(known.label)
    : (value.split(",")[0] ?? value).trim().replaceAll(/^["']|["']$/gu, "");
};

/** A value as the panel writes it. */
const shown = (kind: Kind, value: number | string, text: Text) => {
  switch (kind) {
    case "color": {
      return (hexColor(String(value)) ?? String(value)).toUpperCase();
    }
    case "size": {
      return text("style.pixels", { value: String(value) });
    }
    case "corners": {
      const corner = CORNERS.find(({ radius }) => radius === value);
      return corner
        ? text(corner.label)
        : text("style.pixels", { value: String(value) });
    }
    default: {
      return fontName(String(value), text);
    }
  }
};

/** What a setting shows: its value, or "Default" and what it is until set. */
const shownSetting = (
  setting: Setting,
  settings: EmailSettings,
  text: Text
) => {
  const value = valueOf(setting.key, settings);
  if (value !== undefined) {
    return { isDefault: false, words: shown(setting.kind, value, text) };
  }
  const builtIn = builtInOf(setting.key);
  return {
    isDefault: true,
    words: setting.unset
      ? text(setting.unset)
      : shown(setting.kind, builtIn ?? "", text),
  };
};

/** The color a swatch shows: the value, or what the email shows without one. */
const swatchOf = (key: StyleKey, settings: EmailSettings): string => {
  const value = valueOf(key, settings);
  if (value !== undefined) {
    return String(value);
  }
  if (key === "emailBackgroundColor") {
    return settings.backgroundColor;
  }
  if (key === "linkColor") {
    return swatchOf("textColor", settings);
  }
  return String(builtInOf(key) ?? "");
};

/** Each color the email uses, once, for the color popover's swatches. */
const colorsIn = (email: BlocksDocument) => {
  const found = new Set<string>();
  const add = (color: unknown) => {
    const hex = typeof color === "string" ? hexColor(color) : undefined;
    if (hex) {
      found.add(hex);
    }
  };
  add(email.settings.backgroundColor);
  for (const value of Object.values(email.settings.style ?? {})) {
    add(value);
  }
  for (const row of email.rows) {
    add((row.props as { backgroundColor?: unknown }).backgroundColor);
    for (const column of row.columns) {
      for (const block of column.blocks) {
        const props = block.props as Record<string, unknown>;
        add(props.color);
        add(props.backgroundColor);
      }
    }
  }
  return [...found];
};

/** The copy of a callout for a Block's own value, by the Block's type and prop. */
const calloutCopy = (
  block: Block,
  { own, prop, shared }: OwnValue,
  text: Text
): { title: string; why: string; share: string } => {
  const kind = prop === "fontSize" ? "size" : "color";
  const values = {
    level: "level" in block.props ? String(block.props.level) : "",
    own: shown(kind, own, text),
    shared: shown(kind, shared, text),
  };
  if (block.type === "button") {
    return {
      share: text("style.own.buttonShare", values),
      title: text("style.own.button", values),
      why: text("style.own.buttonWhy", values),
    };
  }
  if (prop === "fontSize") {
    return block.type === "heading"
      ? {
          share: text("style.own.headingSizeShare", values),
          title: text("style.own.headingSize", values),
          why: text("style.own.headingSizeWhy", values),
        }
      : {
          share: text("style.own.textSizeShare", values),
          title: text("style.own.textSize", values),
          why: text("style.own.textSizeWhy", values),
        };
  }
  return {
    share: text("style.own.colorShare", values),
    title: text(
      block.type === "heading"
        ? "style.own.headingColor"
        : "style.own.textColor",
      values
    ),
    why: text("style.own.colorWhy", values),
  };
};

export const stylePanelStyles = css`
  /* Docked, a column as tall as the editor, as More's is. */
  .style-dock {
    background: var(--mq-color-surface);
    border-inline-start: 1px solid var(--mq-color-border);
    flex: 0 0 var(--_mq-panel-width);
    min-width: 0;
  }

  /*
   * Where the email and the panel don't fit side by side, the panel floats
   * over the Canvas's edge, as More does, and stays in sight as the page
   * scrolls.
   */
  .style-float {
    inset-block: 0;
    inset-inline-end: 0;
    pointer-events: none;
    position: absolute;
    width: calc(var(--_mq-panel-width) + var(--mq-space-3));
    z-index: var(--_mq-layer-selection-bar);
  }

  .style-panel {
    background: var(--mq-color-surface);
    display: flex;
    flex-direction: column;
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    pointer-events: auto;
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  .style-panel.floating {
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    margin-block-start: var(--mq-space-3);
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) -
        var(--_mq-top-bar-height) - var(--mq-space-5)
    );
    top: calc(var(--_mq-top-bar-height) + var(--mq-space-3));
    width: var(--_mq-panel-width);
  }

  .style-head {
    border-block-end: 1px solid var(--mq-color-border);
    padding: var(--mq-space-4) var(--mq-space-4) var(--mq-space-3);
  }

  .style-head h2 {
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .style-head p {
    color: var(--mq-color-text-muted);
    margin: 2px 0 0;
  }

  .style-body {
    overflow-y: auto;
  }

  .style-section {
    border-block-end: 1px solid var(--mq-color-border);
    padding: var(--mq-space-3) var(--mq-space-4) var(--mq-space-3);
  }

  .style-section:last-child {
    border-block-end: 0;
  }

  .style-section h3 {
    align-items: center;
    display: flex;
    font-size: var(--mq-font-size);
    font-weight: 600;
    justify-content: space-between;
    margin: 0 0 var(--mq-space-2);
    min-height: 24px;
  }

  /* A setting: its name, then its value, which opens what picks it. */
  .style-setting {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: minmax(0, 1fr) auto;
    margin-inline: calc(-1 * var(--mq-space-2));
    min-height: 32px;
    padding: 2px var(--mq-space-2);
    text-align: start;
    transition: background-color 120ms;
    width: calc(100% + 2 * var(--mq-space-2));
  }

  .style-setting:hover,
  .style-setting[aria-expanded="true"],
  .style-setting[data-marked] {
    background: var(--mq-color-accent-soft);
  }

  .style-value {
    align-items: center;
    color: var(--mq-color-text-muted);
    display: flex;
    font-variant-numeric: tabular-nums;
    gap: var(--mq-space-2);
    min-width: 0;
  }

  .style-value .words {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .style-default {
    background: var(--mq-color-surface-muted);
    border-radius: 4px;
    color: var(--mq-color-text-muted);
    font-size: var(--_mq-font-size-tag);
    padding: 1px 6px;
  }

  .style-swatch {
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
    flex: none;
    height: 18px;
    width: 18px;
  }

  /* A font's value is a field that opens its list. */
  .style-font {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text);
    height: 30px;
    max-width: 170px;
    padding: 0 6px 0 10px;
  }

  /* A size reads as what it sizes, in the email's own font. */
  .style-sample {
    color: var(--mq-color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .style-setting.size {
    min-height: 40px;
  }

  .style-corners {
    border: 0;
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(3, 1fr);
    margin: 0;
    padding: 0;
  }

  .style-corner {
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-1);
    justify-items: center;
    position: relative;
  }

  .style-corner input {
    inset: 0;
    margin: 0;
    opacity: 0;
    position: absolute;
  }

  .style-corner .tile {
    align-items: center;
    background: var(--mq-color-surface-muted);
    border-radius: var(--mq-radius);
    box-shadow: inset 0 0 0 1px var(--mq-color-border-strong);
    display: flex;
    height: 48px;
    justify-content: center;
    transition: box-shadow 120ms;
    width: 100%;
  }

  .style-corner .tile i {
    background: var(--mq-color-text);
    height: 16px;
    width: 52px;
  }

  .style-corner input:checked + .tile {
    box-shadow: inset 0 0 0 2px var(--mq-color-accent);
  }

  .style-corner input:focus-visible + .tile {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 2px;
  }

  .style-corner .name {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
  }

  .style-corner input:checked ~ .name {
    color: var(--mq-color-text);
    font-weight: 600;
  }

  .style-link {
    background: none;
    border: 0;
    border-radius: 4px;
    color: var(--mq-color-accent-strong);
    cursor: pointer;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    padding: 2px 4px;
  }

  .style-link:hover {
    text-decoration: underline;
  }

  .style-muted {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    font-weight: 400;
  }

  /* What a selected Block keeps as its own, each with a way to match or share it. */
  .style-callouts {
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-2);
    padding: var(--mq-space-3) var(--mq-space-4) 0;
  }

  .style-callout {
    background: var(--mq-color-accent-soft);
    border-radius: var(--mq-radius);
    padding: var(--mq-space-3);
  }

  .style-callout p {
    margin: 0;
  }

  .style-callout .title {
    font-weight: 600;
  }

  .style-callout .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: var(--mq-space-2);
  }

  /* Where they don't fit side by side, each fills its line, so they line up. */
  .style-callout .actions button {
    flex: 1 1 auto;
  }

  /* A popover from a setting: beside the panel for a color, under it otherwise. */
  .style-popover {
    background: var(--mq-color-surface);
    overflow-y: auto;
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    inset-inline-end: var(--mq-space-3);
    padding: var(--mq-space-3);
    position: absolute;
    width: 264px;
    z-index: 1;
  }

  /* Short of room, it scrolls, rather than squeeze what's in it. */
  .style-popover > * {
    flex-shrink: 0;
  }

  .style-popover.color {
    inset-inline-end: calc(100% + var(--mq-space-2));
  }

  .style-popover.font {
    display: flex;
    flex-direction: column;
    max-height: 420px;
    padding: 6px;
    width: 300px;
  }

  .style-popover .popover-title {
    font-weight: 600;
    margin: 0 0 var(--mq-space-2);
  }

  .style-popover .size-row {
    align-items: center;
    display: flex;
    gap: var(--mq-space-2);
  }

  .style-popover .size-row .unit-field {
    flex: 0 0 96px;
  }

  .style-popover .use-default {
    align-items: center;
    background: none;
    border: 0;
    border-block-start: 1px solid var(--mq-color-border);
    cursor: pointer;
    display: flex;
    gap: var(--mq-space-2);
    margin-block-start: var(--mq-space-3);
    padding: var(--mq-space-2) 0 0;
    width: 100%;
  }

  .style-popover .use-default:hover {
    color: var(--mq-color-accent-strong);
  }

  .style-popover .error {
    color: var(--mq-color-danger);
    font-size: var(--mq-font-size-small);
    margin: var(--mq-space-1) 0 0;
  }

  /* The shade: white to the hue across, and black down. */
  .shade {
    background:
      linear-gradient(to top, #000000, transparent),
      linear-gradient(to right, #ffffff, hsl(var(--_mq-hue) 100% 50%));
    border-radius: var(--mq-radius-small);
    cursor: crosshair;
    height: 150px;
    position: relative;
    touch-action: none;
  }

  .shade:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 2px;
  }

  .shade-thumb {
    border-radius: 50%;
    box-shadow:
      0 0 0 2px #ffffff,
      0 0 0 3px rgb(0 0 0 / 30%);
    height: 14px;
    margin: -7px;
    pointer-events: none;
    position: absolute;
    width: 14px;
  }

  /* Over the settings' own field styles, which an input in a popover takes. */
  .settings .hue {
    appearance: none;
    border: 0;
    box-shadow: none;
    padding: 0;
    background: linear-gradient(
      to right,
      #ff0000,
      #ffff00,
      #00ff00,
      #00ffff,
      #0000ff,
      #ff00ff,
      #ff0000
    );
    border-radius: 6px;
    display: block;
    height: 12px;
    margin: var(--mq-space-3) 0;
    width: 100%;
  }

  .settings .hue:focus {
    box-shadow: none;
    outline-offset: 2px;
  }

  .hue::-webkit-slider-thumb {
    appearance: none;
    background: #ffffff;
    border-radius: 50%;
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 25%),
      0 1px 3px rgb(0 0 0 / 25%);
    height: 16px;
    width: 16px;
  }

  .hue::-moz-range-thumb {
    background: #ffffff;
    border: 0;
    border-radius: 50%;
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 25%),
      0 1px 3px rgb(0 0 0 / 25%);
    height: 16px;
    width: 16px;
  }

  .hex-field {
    position: relative;
  }

  .hex-field .hex-label {
    color: var(--mq-color-text-muted);
    inset-block: 0;
    inset-inline-start: 10px;
    line-height: 32px;
    pointer-events: none;
    position: absolute;
  }

  .settings .hex-field input {
    font-variant-numeric: tabular-nums;
    padding-inline-start: 44px;
  }

  .swatch-label {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: var(--mq-space-3) 0 6px;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .swatches button {
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
    cursor: pointer;
    height: 24px;
    padding: 0;
    width: 24px;
  }

  .font-search {
    position: relative;
  }

  .font-search .icon {
    color: var(--mq-color-text-muted);
    inset-block: 0;
    inset-inline-start: 10px;
    margin-block: auto;
    pointer-events: none;
    position: absolute;
  }

  .settings .font-search input {
    padding-inline-start: 32px;
  }

  /* Positioned, as the options' offsets that keep one in sight are from it. */
  .style-popover > .font-list {
    flex-shrink: 1;
    position: relative;
    margin-block-start: var(--mq-space-1);
    overflow-y: auto;
  }

  .font-group {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    padding: var(--mq-space-2) 10px var(--mq-space-1);
  }

  .font-option {
    align-items: center;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 40px;
    padding: var(--mq-space-1) 10px;
  }

  .font-option:hover {
    background: var(--mq-color-surface-hover);
  }

  .font-option[aria-selected="true"] {
    background: var(--mq-color-accent-soft);
    color: var(--mq-color-accent-strong);
  }

  .font-option[data-active] {
    box-shadow: inset 0 0 0 2px var(--mq-color-accent);
  }

  .font-option .name {
    color: var(--mq-color-text);
    font-size: 15px;
  }

  .font-option small {
    color: var(--mq-color-text-muted);
    display: block;
    font-family: var(--mq-font-family);
    font-size: var(--mq-font-size-small);
  }

  .font-none {
    color: var(--mq-color-text-muted);
    margin: 0;
    padding: var(--mq-space-3) 10px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .style-popover {
      animation: style-pop-in 140ms cubic-bezier(0.2, 0, 0, 1);
    }
  }

  @keyframes style-pop-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }
`;

/** A popover that's open, and what's in it that isn't the email's yet. */
interface Open {
  key: StyleKey;
  kind: Kind;
  /** Where it is from the panel's top or bottom, and how tall it can be. */
  placed: Placed;
  /** The color being picked, which keeps its hue where a gray has none. */
  hsv?: Hsv;
  /** What's typed that isn't applied, and how many times it was refused. */
  typed?: string;
  refusals: number;
  /** The font search, and the font the arrow keys are on. */
  query: string;
  active: number;
}

/** A mark on the Canvas: what a hovered setting changes, or what keeps its own. */
export interface StyleMark {
  kind: "changes" | "keeps";
  tag?: string;
}

interface StylePanelHost {
  /** Applies a change; with the same `mergeKey`, it's one step with the last. */
  apply: (command: Command, mergeKey?: string) => ApplyResult | undefined;
  focus: Pick<EditorFocus, "focusWhenRendered">;
  requestUpdate: () => void;
  text: Text;
}

/** What the panel shows, besides its own state. */
export interface StylePanelView {
  email: BlocksDocument;
  /** The Block selected on the Canvas, whose own values the panel says. */
  selected: Block | undefined;
  floating: boolean;
}

export type StylePanel = ReturnType<typeof createStylePanel>;

export const createStylePanel = ({
  apply,
  focus,
  requestUpdate,
  text,
}: StylePanelHost) => {
  let open: Open | undefined;
  /** The setting the pointer or focus is on, which the Canvas marks. */
  let hovered: StyleKey | undefined;
  let focused: StyleKey | undefined;
  /** What the pointer is on, or else what focus is on, which the Canvas marks. */
  const marked = () => hovered ?? focused;
  /** Changes in one go, such as a drag of the shade, are one undo step. */
  let session = 0;
  /** The last email shown, for what keys do with no update between. */
  let email: BlocksDocument | undefined;
  /** The settings the selected Block sets its own value over, which are tinted. */
  let overridden = new Set<StyleKey>();

  const close = (returnFocus: boolean) => {
    if (!open) {
      return;
    }
    const { key } = open;
    open = undefined;
    session += 1;
    if (returnFocus) {
      focus.focusWhenRendered({ action: `style-${key}`, on: "style" });
    }
    requestUpdate();
  };

  const set = (key: StyleKey, value: number | string | null, merging = false) =>
    apply(
      setCommand(key, value),
      merging ? `style:${key}:${session}` : undefined
    );

  const toggle = (setting: Setting, anchor: HTMLElement) => {
    // What's typed in the open popover is set first, as focus leaving it
    // would set it, since a press on a setting keeps focus where it is.
    const typing = (anchor.getRootNode() as ShadowRoot).activeElement;
    if (
      typing instanceof HTMLInputElement &&
      closestPlace(typing, "stylePopover")
    ) {
      typing.blur();
    }
    if (open?.key === setting.key) {
      close(true);
      return;
    }
    session += 1;
    open = {
      active: -1,
      key: setting.key,
      kind: setting.kind,
      query: "",
      refusals: 0,
      placed: placeBy(setting.kind, anchor),
    };
    focus.focusWhenRendered({ on: "style" });
    requestUpdate();
  };

  // ---------- Colors ----------

  /** The color in the popover, from the email unless it's being picked. */
  const hsvNow = (key: StyleKey, settings: EmailSettings): Hsv => {
    const color = swatchOf(key, settings);
    const from = hsvOf(color) ?? { h: 0, s: 0, v: 1 };
    if (open?.hsv && hexOfHsv(open.hsv) === hexColor(color)) {
      return open.hsv;
    }
    // A gray has no hue of its own, so the one being picked stays.
    return from.s === 0 && open?.hsv ? { ...from, h: open.hsv.h } : from;
  };

  const pickColor = (hsv: Hsv) => {
    if (!(open && email)) {
      return;
    }
    open.hsv = hsv;
    open.typed = undefined;
    open.refusals = 0;
    set(open.key, hexOfHsv(hsv), true);
  };

  const renderColor = (
    current: Open,
    shownEmail: BlocksDocument,
    label: string
  ) => {
    const { settings } = shownEmail;
    const { key } = current;
    const hsv = hsvNow(key, settings);
    const builtIn = builtInOf(key);
    const errorId = "style-hex-error";
    const solid = key === "buttonBackgroundColor";
    return html`
      <div
        class="shade"
        data-place=${place("colorArea")}
        aria-label=${text("style.shade", { label })}
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow=${Math.round(hsv.s * 100)}
        aria-valuetext=${text("style.shadeValue", {
          brightness: String(Math.round(hsv.v * 100)),
          saturation: String(Math.round(hsv.s * 100)),
        })}
        role="slider"
        style=${styleProperties({ "--_mq-hue": String(hsv.h) })}
        tabindex="0"
        @blur=${() => {
          session += 1;
        }}
        @pointerdown=${(event: PointerEvent) => {
          // A drag is a step of its own, apart from keys pressed before it.
          session += 1;
          const element = event.currentTarget as HTMLElement;
          element.setPointerCapture(event.pointerId);
          element.focus({ focusVisible: false });
          pickColor({ ...hsv, ...shadeAt(element, event) });
        }}
        @pointermove=${(event: PointerEvent) => {
          const element = event.currentTarget as HTMLElement;
          if (element.hasPointerCapture(event.pointerId)) {
            pickColor({ ...(open?.hsv ?? hsv), ...shadeAt(element, event) });
          }
        }}
        @pointercancel=${() => {
          session += 1;
        }}
        @pointerup=${() => {
          session += 1;
        }}
      >
        <span
          class="shade-thumb"
          style=${styleProperties({
            "background-color": hexOfHsv(hsv),
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
          })}
        ></span>
      </div>
      <input
        aria-label=${text("style.hue")}
        class="hue"
        max="359"
        min="0"
        step="1"
        type="range"
        .value=${live(String(Math.round(hsv.h)))}
        @change=${() => {
          session += 1;
        }}
        @input=${({ currentTarget }: Event) =>
          pickColor({
            ...hsv,
            h: Number((currentTarget as HTMLInputElement).value),
          })}
      />
      <div class="hex-field">
        <span aria-hidden="true" class="hex-label">${text("style.hex")}</span>
        <input
          aria-describedby=${current.refusals > 0 ? errorId : nothing}
          aria-invalid=${current.refusals > 0 ? "true" : "false"}
          aria-label=${text("style.hex")}
          autocomplete="off"
          data-start
          spellcheck="false"
          .value=${live(current.typed ?? hexOfHsv(hsv).toUpperCase())}
          @change=${({ currentTarget }: Event) => {
            const typed = (currentTarget as HTMLInputElement).value.trim();
            if (!typed) {
              current.typed = undefined;
              requestUpdate();
              return;
            }
            session += 1;
            const result = set(key, typed);
            if (result?.ok || result?.code === "unchanged") {
              current.typed = undefined;
              current.refusals = 0;
              current.hsv = undefined;
            } else {
              current.typed = typed;
              current.refusals += 1;
            }
            requestUpdate();
          }}
          @input=${({ currentTarget }: Event) => {
            current.typed = (currentTarget as HTMLInputElement).value;
          }}
        />
      </div>
      ${
        current.refusals > 0
          ? html`<p class="error" id=${errorId} role="alert">
              ${text(solid ? "invalid.solidColor" : "invalid.color")}
            </p>`
          : nothing
      }
      <p class="swatch-label" id="style-swatches">
        ${text("style.inThisEmail")}
      </p>
      <div aria-labelledby="style-swatches" class="swatches" role="group">
        ${colorsIn(shownEmail).map(
          (color) => html`
            <button
              aria-label=${color.toUpperCase()}
              style=${styleProperties({ "background-color": color })}
              type="button"
              @click=${() => {
                session += 1;
                const result = set(key, color);
                // What was typed in Hex, and refused, gives way to the swatch.
                if (result?.ok || result?.code === "unchanged") {
                  current.hsv = undefined;
                  current.typed = undefined;
                  current.refusals = 0;
                  requestUpdate();
                }
              }}
            ></button>
          `
        )}
      </div>
      ${
        isEmailSetting(key) || valueOf(key, settings) === undefined
          ? nothing
          : html`
              <button
                class="use-default"
                type="button"
                @click=${() => {
                  set(key, null);
                  close(true);
                }}
              >
                ${ICONS.close}${text("style.useDefault", {
                  value:
                    builtIn === undefined
                      ? text(settingOf(key)?.unset ?? "style.default")
                      : shown("color", builtIn, text),
                })}
              </button>
            `
      }
    `;
  };

  // ---------- Sizes ----------

  const renderSize = (
    current: Open,
    { settings }: BlocksDocument,
    label: string
  ) => {
    const { key } = current;
    const builtIn = shown("size", builtInOf(key) ?? "", text);
    const value = valueOf(key, settings);
    const titleId = "style-size-title";
    const errorId = "style-size-error";
    return html`
      <p class="popover-title" id=${titleId}>${label}</p>
      <div class="size-row">
        <div class="unit-field">
          <input
            aria-describedby=${current.refusals > 0 ? errorId : nothing}
            aria-invalid=${current.refusals > 0 ? "true" : "false"}
            aria-label=${text("style.sizeField", { size: label, unit: text("unit.px") })}
            data-start
            max=${FONT_SIZE_LIMITS.max ?? nothing}
            min=${FONT_SIZE_LIMITS.min}
            placeholder=${String(builtInOf(key) ?? "")}
            step="1"
            type="number"
            .value=${live(current.typed ?? (value === undefined ? "" : String(value)))}
            @change=${({ currentTarget }: Event) => {
              const input = currentTarget as HTMLInputElement;
              const typed = input.value.trim();
              const result = set(key, typedSize(input));
              if (result?.ok || result?.code === "unchanged") {
                current.typed = undefined;
                current.refusals = 0;
              } else {
                current.typed = typed;
                current.refusals += 1;
              }
              requestUpdate();
            }}
          />
          <span aria-hidden="true" class="unit">${text("unit.px")}</span>
        </div>
        <span class="style-muted"
          >${text("style.defaultIs", { value: builtIn })}</span
        >
      </div>
      ${
        current.refusals > 0
          ? html`<p class="error" id=${errorId} role="alert">
              ${text("invalid.pixelsBetween", {
                max: String(FONT_SIZE_LIMITS.max),
                min: String(FONT_SIZE_LIMITS.min),
              })}
            </p>`
          : nothing
      }
      ${
        value === undefined
          ? nothing
          : html`
              <button
                class="use-default"
                type="button"
                @click=${() => {
                  set(key, null);
                  close(true);
                }}
              >
                ${ICONS.close}${text("style.useDefault", { value: builtIn })}
              </button>
            `
      }
    `;
  };

  // ---------- Fonts ----------

  /** The fonts the open list offers, matching what's typed in its search. */
  const fontsFor = (key: StyleKey, settings: EmailSettings) => {
    const current = valueOf(key, settings);
    const fonts = SYSTEM_FONTS.map(({ label, value }) => ({
      label: text(label),
      value: value as string | null,
    }));
    // A saved email can have a font the list doesn't.
    if (
      typeof current === "string" &&
      !fonts.some(({ value }) => value === current)
    ) {
      fonts.push({ label: fontName(current, text), value: current });
    }
    const query = open?.query.trim().toLowerCase() ?? "";
    const matches = (label: string) => label.toLowerCase().includes(query);
    const same =
      key === "headingFontFamily" && matches(text("style.sameAsBody"))
        ? [{ label: text("style.sameAsBody"), value: null }]
        : [];
    return [...same, ...fonts.filter(({ label }) => matches(label))];
  };

  const pickFont = (value: string | null) => {
    if (!open) {
      return;
    }
    set(open.key, value);
    close(true);
  };

  const renderFont = (
    current: Open,
    { settings }: BlocksDocument,
    label: string
  ) => {
    const { key } = current;
    const fonts = fontsFor(key, settings);
    const value = valueOf(key, settings) ?? null;
    const active =
      current.active >= 0
        ? current.active
        : Math.max(
            0,
            fonts.findIndex((font) => font.value === value)
          );
    const listId = "style-font-list";
    const option = (font: (typeof fonts)[number], index: number) => html`
      <div
        aria-selected=${font.value === value ? "true" : "false"}
        class="font-option"
        ?data-active=${index === active}
        id=${fontOptionId(index)}
        role="option"
        @click=${() => pickFont(font.value)}
        @pointerdown=${(event: PointerEvent) => event.preventDefault()}
      >
        <span>
          <span
            class="name"
            style=${styleProperties({
              "font-family": font.value ?? settings.fontFamily,
            })}
            >${font.label}</span
          >${
            font.value === null
              ? html`<small>
                  ${text("style.bodyFont", {
                    font: fontName(settings.fontFamily, text),
                  })}
                </small>`
              : nothing
          }
        </span>
        ${font.value === value ? ICONS.check : nothing}
      </div>
    `;
    const firstSystem = fonts.findIndex(({ value: font }) => font !== null);
    return html`
      <div class="font-search">
        ${ICONS.search}
        <input
          aria-activedescendant=${fonts.length > 0 ? fontOptionId(active) : nothing}
          aria-autocomplete="list"
          aria-controls=${listId}
          aria-expanded="true"
          aria-label=${text("style.searchFonts")}
          autocomplete="off"
          data-place=${place("fontSearch")}
          data-start
          placeholder=${text("style.searchFonts")}
          role="combobox"
          spellcheck="false"
          .value=${live(current.query)}
          @input=${({ currentTarget }: Event) => {
            current.query = (currentTarget as HTMLInputElement).value;
            current.active = 0;
            requestUpdate();
          }}
        />
      </div>
      <div
        aria-label=${label}
        class="font-list thin-scrollbar"
        id=${listId}
        role="listbox"
      >
        ${fonts.map((font, index) =>
          index === firstSystem
            ? html`<div aria-hidden="true" class="font-group">
                  ${text("style.systemFonts")}
                </div>
                ${option(font, index)}`
            : option(font, index)
        )}
      </div>
      ${
        fonts.length === 0
          ? html`<p class="font-none" role="status">
              ${text("style.noFont", { query: current.query.trim() })}
            </p>`
          : nothing
      }
    `;
  };

  // ---------- The panel ----------

  /**
   * The pointer and focus each mark their setting, and a mark goes only once
   * neither is on it.
   */
  const markEvents = (key: StyleKey) => {
    const leaving = (current: StyleKey | undefined) =>
      current === key ? undefined : current;
    const by = (input: "focus" | "pointer", on: boolean) => () => {
      const before = marked();
      if (input === "pointer") {
        hovered = on ? key : leaving(hovered);
      } else {
        focused = on ? key : leaving(focused);
      }
      if (marked() !== before) {
        requestUpdate();
      }
    };
    return {
      blur: by("focus", false),
      enter: by("pointer", true),
      focus: by("focus", true),
      leave: by("pointer", false),
    };
  };

  const renderSetting = (
    setting: Setting,
    settings: EmailSettings,
    /** Its name and value, with "Default" before the value while it's unset. */
    body: (
      words: TemplateResult,
      unset: TemplateResult | typeof nothing
    ) => TemplateResult
  ) => {
    const { isDefault, words } = shownSetting(setting, settings, text);
    const events = markEvents(setting.key);
    return html`
      <button
        aria-expanded=${open?.key === setting.key ? "true" : "false"}
        aria-haspopup="dialog"
        class=${`style-setting ${setting.kind}`}
        data-action=${`style-${setting.key}`}
        ?data-marked=${marked() === setting.key || overridden.has(setting.key)}
        type="button"
        @blur=${events.blur}
        @click=${({ currentTarget }: MouseEvent) =>
          toggle(setting, currentTarget as HTMLElement)}
        @focus=${events.focus}
        @mousedown=${(event: MouseEvent) => {
          // Focus stays in an open popover, so the press toggles it.
          if (open) {
            event.preventDefault();
          }
        }}
        @pointerenter=${events.enter}
        @pointerleave=${events.leave}
      >
        ${body(
          html`<span class="words">${words}</span>`,
          isDefault
            ? html`<span class="style-default">${text("style.default")}</span>`
            : nothing
        )}
      </button>
    `;
  };

  const renderColorSetting = (setting: Setting, settings: EmailSettings) =>
    renderSetting(
      setting,
      settings,
      (words, unset) => html`
        <span>${text(setting.label)}</span>
        <span class="style-value">
          ${unset}${words}
          <span
            class="style-swatch"
            style=${styleProperties({
              "background-color": swatchOf(setting.key, settings),
            })}
          ></span>
        </span>
      `
    );

  const renderFontSetting = (setting: Setting, settings: EmailSettings) =>
    renderSetting(
      setting,
      settings,
      (words, unset) => html`
        <span>${text(setting.label)}</span>
        <span class="style-value">
          ${unset}<span class="style-value style-font"
            >${words}${ICONS.chevronDown}</span
          >
        </span>
      `
    );

  const renderSizeSetting = (
    setting: Setting & { heading: boolean },
    settings: EmailSettings
  ) => {
    const value = valueOf(setting.key, settings) ?? builtInOf(setting.key);
    const font = setting.heading
      ? (settings.style?.headingFontFamily ?? settings.fontFamily)
      : settings.fontFamily;
    return renderSetting(
      setting,
      settings,
      (words, unset) => html`
        <span
          class="style-sample"
          style=${styleProperties({
            "font-family": font,
            // The email's sizes, drawn smaller, as the panel is narrow.
            "font-size": `${Math.min(26, Math.max(14, Number(value) * 0.75))}px`,
            "font-weight": setting.heading ? "700" : "400",
          })}
          >${text(setting.label)}</span
        >
        <span class="style-value">${unset}${words}</span>
      `
    );
  };

  const renderCorners = (settings: EmailSettings) => {
    const value = settings.style?.buttonBorderRadius;
    const key: StyleKey = "buttonBorderRadius";
    const events = markEvents(key);
    const builtIn = shown("size", builtInOf(key) ?? "", text);
    return html`
      <section class="style-section">
        <h3>
          <span id="style-corners">${text("style.corners")}</span>
          ${
            value === undefined
              ? html`<span class="style-muted">
                  <span class="style-default">${text("style.default")}</span>
                  ${builtIn}
                </span>`
              : html`<button
                  class="style-link"
                  data-action="style-corners-default"
                  type="button"
                  @click=${() => {
                    set(key, null);
                    focus.focusWhenRendered({
                      action: `style-corner-${CORNERS[0].radius}`,
                      on: "style",
                    });
                  }}
                >
                  ${text("style.useDefault", { value: builtIn })}
                </button>`
          }
        </h3>
        <div
          aria-labelledby="style-corners"
          class="style-corners"
          role="radiogroup"
          @focusin=${events.focus}
          @focusout=${events.blur}
          @pointerenter=${events.enter}
          @pointerleave=${events.leave}
        >
          ${CORNERS.map(
            ({ drawn, label, radius }) => html`
              <label class="style-corner">
                <input
                  data-action=${`style-corner-${radius}`}
                  name="style-corners"
                  type="radio"
                  .checked=${live(value === radius)}
                  @change=${() => set(key, radius)}
                />
                <span aria-hidden="true" class="tile">
                  <i
                    style=${styleProperties({ "border-radius": `${drawn}px` })}
                  ></i>
                </span>
                <span class="name">${text(label)}</span>
              </label>
            `
          )}
        </div>
      </section>
    `;
  };

  const renderCallouts = (
    block: Block | undefined,
    settings: EmailSettings
  ) => {
    const own = block ? ownValuesOf(block, settings.style ?? {}) : [];
    if (!(block && own.length > 0)) {
      return nothing;
    }
    return html`
      <div class="style-callouts">
        ${own.map((value) => {
          const copy = calloutCopy(block, value, text);
          const clearOwn = (): Command => ({
            blockId: block.id,
            props: { [value.prop]: null },
            type: "updateBlockProps",
          });
          const done = () =>
            focus.focusWhenRendered({
              action: `style-${value.key}`,
              on: "style",
            });
          return html`
            <div class="style-callout">
              <p class="title">${copy.title}</p>
              <p>${copy.why}</p>
              <div class="actions">
                <button
                  class="text-button"
                  type="button"
                  @click=${() => {
                    apply(clearOwn());
                    done();
                  }}
                >
                  ${text("style.own.makeIt", {
                    shared: shown(
                      value.prop === "fontSize" ? "size" : "color",
                      value.shared,
                      text
                    ),
                  })}
                </button>
                <button
                  class="text-button"
                  type="button"
                  @click=${() => {
                    // One undo step: the shared value, and the Block's own gone.
                    session += 1;
                    const mergeKey = `style:share:${session}`;
                    if (apply(setCommand(value.key, value.own), mergeKey)?.ok) {
                      apply(clearOwn(), mergeKey);
                    }
                    session += 1;
                    done();
                  }}
                >
                  ${copy.share}
                </button>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  };

  const renderPopover = (shownEmail: BlocksDocument) => {
    if (!open) {
      return nothing;
    }
    const setting = settingOf(open.key);
    if (!setting) {
      return nothing;
    }
    const label =
      open.kind === "size"
        ? text("style.size", { label: text(setting.label) })
        : text(setting.label);
    const renderers = {
      color: renderColor,
      font: renderFont,
      size: renderSize,
    };
    return html`
      <div
        aria-label=${label}
        class=${`ui settings style-popover ${open.kind}`}
        data-place=${place("stylePopover")}
        role="dialog"
        style=${styleProperties({
          bottom:
            open.placed.bottom === undefined
              ? undefined
              : `${open.placed.bottom}px`,
          "max-height": `${open.placed.maxHeight}px`,
          top:
            open.placed.top === undefined ? undefined : `${open.placed.top}px`,
        })}
        tabindex="-1"
        @focusout=${({ currentTarget }: FocusEvent) => {
          // Once focus has landed, as it leaves a field the popover takes
          // away, such as when another setting's popover takes its place.
          const wasOpen = open;
          const popover = currentTarget as Element;
          setTimeout(() => {
            const landed = (popover.getRootNode() as ShadowRoot).activeElement;
            if (open === wasOpen && !(landed && popover.contains(landed))) {
              close(false);
            }
          }, 0);
        }}
      >
        ${open.kind === "corners" ? nothing : renderers[open.kind](open, shownEmail, label)}
      </div>
    `;
  };

  return {
    closePopover: close,

    /** Forgets what's open, as when the email is replaced or Style is left. */
    forget() {
      open = undefined;
      hovered = undefined;
      focused = undefined;
    },

    /**
     * What the setting the pointer or focus is on, or whose popover is open,
     * marks on the Canvas, by Row or Block ID.
     */
    marks(shownEmail: BlocksDocument): ReadonlyMap<string, StyleMark> {
      const key = open?.key ?? marked();
      const setting = key && settingOf(key);
      const marks = new Map<string, StyleMark>();
      if (!(key && setting)) {
        return marks;
      }
      const reach = reachOf(key, shownEmail);
      const label = text(setting.label);
      const value = shownSetting(setting, shownEmail.settings, text).words;
      for (const [index, id] of reach.changes.entries()) {
        marks.set(id, {
          kind: "changes",
          tag:
            index === 0 ? text("style.reaches", { label, value }) : undefined,
        });
      }
      for (const { id, value: own } of reach.keeps) {
        marks.set(id, {
          kind: "keeps",
          tag: text("style.keepsOwn", {
            value: shown(setting.kind, own, text),
          }),
        });
      }
      return marks;
    },

    /** From the key map, in the open font list. */
    moveFont(step: -1 | 1) {
      if (!(open?.kind === "font" && email)) {
        return;
      }
      const count = fontsFor(open.key, email.settings).length;
      if (count === 0) {
        return;
      }
      const value = valueOf(open.key, email.settings) ?? null;
      const from =
        open.active >= 0
          ? open.active
          : Math.max(
              0,
              fontsFor(open.key, email.settings).findIndex(
                (font) => font.value === value
              )
            );
      open.active = Math.min(count - 1, Math.max(0, from + step));
      requestUpdate();
    },

    /** From the key map, in the shade: across for saturation, up and down for brightness. */
    nudgeColor(direction: Direction, far: boolean) {
      if (!(open?.kind === "color" && email)) {
        return;
      }
      const hsv = hsvNow(open.key, email.settings);
      const step = far ? 0.1 : 0.01;
      const change = {
        down: { v: clamp(hsv.v - step) },
        left: { s: clamp(hsv.s - step) },
        right: { s: clamp(hsv.s + step) },
        up: { v: clamp(hsv.v + step) },
      }[direction];
      pickColor({ ...hsv, ...change });
    },

    /**
     * From the key map: Tab from a popover's last control, or Shift+Tab from
     * its first, closes it, and focus goes on to the setting after its own,
     * or back to its own. Anywhere else in it, Tab is the browser's.
     */
    tabOut(event: KeyboardEvent) {
      const from = event.target as Element;
      const popover = closestPlace(from, "stylePopover");
      const panel = closestPlace(from, "stylePanel");
      if (!(open && popover && panel)) {
        return;
      }
      const stops = [
        ...popover.querySelectorAll<HTMLElement>(
          "input, button, [tabindex='0']"
        ),
      ].filter((stop) => stop.getClientRects().length > 0);
      const edge = event.shiftKey ? stops[0] : stops.at(-1);
      if (from !== edge) {
        return;
      }
      event.preventDefault();
      const own = `style-${open.key}`;
      const controls = [...panel.querySelectorAll<HTMLElement>("[data-action]")]
        .filter((control) => !popover.contains(control))
        .map((control) =>
          // The corners are one stop, at the one that's chosen.
          control instanceof HTMLInputElement &&
          control.type === "radio" &&
          !control.checked &&
          panel.querySelector("input[type='radio']:checked")
            ? (panel.querySelector<HTMLElement>(
                "input[type='radio']:checked"
              ) ?? control)
            : control
        );
      const after =
        controls[
          controls.findIndex(({ dataset }) => dataset.action === own) + 1
        ];
      const action = event.shiftKey ? own : (after?.dataset.action ?? own);
      open = undefined;
      session += 1;
      focus.focusWhenRendered({ action, on: "style" });
      requestUpdate();
    },

    /** From the key map: picks the font the arrow keys are on. */
    pickFont() {
      if (!(open?.kind === "font" && email)) {
        return;
      }
      const fonts = fontsFor(open.key, email.settings);
      const value = valueOf(open.key, email.settings) ?? null;
      const index =
        open.active >= 0
          ? open.active
          : fonts.findIndex((font) => font.value === value);
      const font = fonts[index];
      if (font) {
        pickFont(font.value);
      }
    },

    render({ email: shownEmail, floating, selected }: StylePanelView) {
      email = shownEmail;
      const { settings } = shownEmail;
      overridden = new Set(
        selected
          ? ownValuesOf(selected, settings.style ?? {}).map(({ key }) => key)
          : []
      );
      return html`
        <section
          aria-labelledby="style-title"
          class=${floating ? "ui style-panel floating" : "ui style-panel"}
          data-place=${place("stylePanel")}
          data-testid="style-panel"
        >
          <div class="style-head">
            <h2 id="style-title">${text("style.title")}</h2>
            <p>${text("style.lead")}</p>
          </div>
          <div class="style-body thin-scrollbar" @scroll=${() => close(false)}>
            ${renderCallouts(selected, settings)}
            <section class="style-section">
              <h3>${text("style.colors")}</h3>
              ${COLORS.map((setting) => renderColorSetting(setting, settings))}
            </section>
            <section class="style-section">
              <h3>${text("style.type")}</h3>
              ${FONTS.map((setting) => renderFontSetting(setting, settings))}
              ${SIZES.map((setting) => renderSizeSetting(setting, settings))}
            </section>
            ${renderCorners(settings)}
          </div>
          ${renderPopover(shownEmail)}
        </section>
      `;
    },

    /** After an update: the font the arrow keys are on stays in sight. */
    sync(root: ParentNode) {
      const option = findPlace(
        root,
        "stylePopover"
      )?.querySelector<HTMLElement>("[data-active]");
      const list = option?.parentElement;
      // Only the list scrolls, never the page around the editor.
      if (!(option && list)) {
        return;
      }
      if (option.offsetTop < list.scrollTop) {
        list.scrollTop = option.offsetTop;
      } else if (
        option.offsetTop + option.offsetHeight >
        list.scrollTop + list.clientHeight
      ) {
        list.scrollTop =
          option.offsetTop + option.offsetHeight - list.clientHeight;
      }
    },
  };
};
