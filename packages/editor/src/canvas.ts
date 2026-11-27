import { ROW_LAYOUTS } from "@mailquilt/core";
import type {
  Block,
  BlocksDocument,
  Column,
  EmailStyle,
  Row,
} from "@mailquilt/core";
import {
  blockBoxStyles,
  blockPaddingCss,
  columnStyles,
  isHiddenOn,
  onPhone,
  rowStyles,
} from "@mailquilt/core/internal";
import type { ColumnProps, RowProps, ShowOn } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { renderAddPicker, renderInsertPoint } from "./adding.js";
import {
  hasRichText,
  renderBlockContent,
  textBlockLook,
} from "./block-types.js";
import { place } from "./editor-places.js";
import { renderFormatBar } from "./format-bar.js";
import { ICONS } from "./icons.js";
import { renderMergeTagPicker } from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { blocksIn, columnPlace, placeIn } from "./positions.js";
import { renderThumbnail } from "./selection-bar.js";
import type { StyleMark } from "./style-panel.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { TextValues } from "./text.js";
import type { Device } from "./top-bar.js";

/**
 * The Rows, Columns and Blocks on the canvas, their tags and handles,
 * and the floating toolbar.
 */
export const canvasStyles = css`
  .row-frame {
    position: relative;
  }

  .row {
    display: flex;
  }

  /* In Style, the email is only looked at, so Edit's tools aren't on it. */
  .styling .drag-handle,
  .styling .insert-point,
  .styling .row-tag {
    display: none;
  }

  /* In Style: what the setting being looked at changes, and what keeps its own. */
  [data-style-mark="changes"] {
    outline: 1px dashed var(--mq-color-accent);
    outline-offset: -1px;
  }

  /* A selected Block that's marked says what the setting does, in its place. */
  .styling .block[data-style-tagged]::after {
    display: none;
  }

  [data-style-mark="keeps"] {
    outline: 1px dotted var(--mq-color-text-muted);
    outline-offset: -1px;
  }

  .style-tag {
    border-radius: var(--mq-radius-small);
    bottom: calc(100% + 2px);
    font:
      500 var(--_mq-font-size-tag) / 20px var(--mq-font-family),
      sans-serif;
    inset-inline-start: 0;
    padding: 0 6px;
    pointer-events: none;
    position: absolute;
    white-space: nowrap;
    z-index: var(--_mq-layer-tags);
  }

  .style-tag.changes {
    background: var(--mq-color-text);
    color: var(--mq-color-surface);
  }

  .style-tag.keeps {
    background: var(--mq-color-surface);
    box-shadow: 0 0 0 1px var(--mq-color-border-strong);
    color: var(--mq-color-text-muted);
  }

  .row-frame:hover > .row {
    outline: 1px dashed var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  /*
   * A Row's tag, and a Block's, above its top corner, which say what it is,
   * and in the text's color while it's selected.
   */
  .row-tag,
  .block:hover::after,
  .block[aria-current="true"]::after,
  .column[data-column-selected] > .column-box::after {
    background: var(--mq-color-accent);
    border-radius: var(--mq-radius-small) var(--mq-radius-small) 0 0;
    bottom: 100%;
    color: var(--mq-color-on-accent);
    font:
      600 var(--_mq-font-size-tag) / 20px var(--mq-font-family),
      sans-serif;
    position: absolute;
    z-index: var(--_mq-layer-tags);
  }

  .row-frame[data-row-selected] > .row-tag,
  .block[aria-current="true"]::after,
  .column[data-column-selected] > .column-box::after {
    background: var(--mq-color-text);
    color: var(--mq-color-surface);
  }

  .email[data-dragging] .row-tag,
  .email[data-dragging] .block::after {
    display: none;
  }

  /*
   * At the end, away from its Blocks' tags. A press on it selects the Row.
   */
  .row-tag {
    cursor: pointer;
    inset-inline-end: 0;
    opacity: 0;
    padding: 0 8px;
    pointer-events: none;
    /* It drags the Row, which a touch would otherwise scroll the page for. */
    touch-action: none;
  }

  .row-frame:hover > .row-tag,
  .row-frame[data-row-selected] > .row-tag {
    opacity: 1;
    pointer-events: auto;
  }

  /* With no hover to bring it out, it shows, as a Block's handle does. */
  @media (hover: none) {
    .row-tag {
      opacity: 1;
      pointer-events: auto;
    }
  }

  /*
   * On a phone, a Block moves from More, and a Row is chosen from the chip's
   * menu or the Rows sheet, so only what's selected has its tag, as frames
   * 8-phone and p15 draw it, and the email keeps the whole width.
   */
  .app[data-phone] .drag-handle,
  .app[data-phone] .row-frame:not([data-row-selected]) > .row-tag {
    display: none;
  }

  /* What's opened in the Column, the picker, hangs from it. */
  /*
   * As tall as its Row, so a drop anywhere in it lands there. What the email
   * shows of it, its background, padding and border, is only as tall as its
   * Blocks, at the top, middle or bottom, as MJML draws it.
   */
  .column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
    transition: background-color 120ms;
  }

  /* While a Block is dragged, where it can land, and where it will. */
  .email[data-dragging="block"] .column {
    outline: 1px dashed var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  .email[data-dragging="block"] .column[data-drop-target] {
    background-image: linear-gradient(
      var(--mq-color-accent-soft),
      var(--mq-color-accent-soft)
    );
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  /* An Image Block that files dragged over it would give its image. */
  .email[data-dragging="block"] .block[data-drop-target] {
    background-image: linear-gradient(
      var(--mq-color-accent-soft),
      var(--mq-color-accent-soft)
    );
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .column.empty {
    min-height: 112px;
    padding: var(--mq-space-2);
  }

  .column-box {
    box-sizing: border-box;
    min-width: 0;
    position: relative;
  }

  .column.empty > .column-box {
    display: flex;
    flex: 1;
  }

  /*
   * Quiet until the pointer or focus comes to it, and a drop target while a
   * Block is dragged over it.
   */
  .placeholder {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .placeholder-button {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1.5px dashed var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: flex;
    flex: 1;
    flex-direction: column;
    font: 500 var(--mq-font-size-small) / 1.4 var(--mq-font-family);
    gap: var(--mq-space-2);
    justify-content: center;
    min-width: 0;
    padding: var(--mq-space-3) var(--mq-space-2);
    text-align: center;
    transition:
      background-color 120ms,
      border-color 120ms,
      color 120ms;
  }

  .placeholder-button:hover,
  .email[data-dragging] .column[data-drop-target] .placeholder-button {
    border-color: var(--mq-color-accent);
    color: var(--mq-color-accent-strong);
  }

  .placeholder-icon {
    align-items: center;
    background: var(--mq-color-surface);
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--mq-color-border-strong);
    display: flex;
    height: 28px;
    justify-content: center;
    transition: scale 100ms;
    width: 28px;
  }

  .placeholder-button:active .placeholder-icon {
    scale: 0.97;
  }

  .block {
    position: relative;
  }

  /*
   * Where a focused Block is scrolled to: clear of the top bar and the
   * Selection bar, and its tag, above, and of the floating toolbar below.
   */
  .block,
  .ProseMirror {
    scroll-margin-block: calc(
        var(--_mq-top-bar-height) + var(--_mq-selection-bar-height) + 28px
      )
      72px;
  }

  .block:hover {
    outline: 1px solid var(--mq-color-outline-hover);
    outline-offset: -1px;
  }

  /*
   * What's selected. A white inner ring keeps it visible on a dark email
   * background.
   */
  .row-frame[data-row-selected] > .row,
  .block[aria-current="true"],
  .column[data-column-selected] > .column-box {
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  /* Stands out from a Block that's only selected, or whose text has focus. */
  .block:focus-visible {
    background-color: var(--mq-color-accent-soft);
    outline: 3px solid var(--_mq-block-focus);
    outline-offset: -3px;
  }

  /*
   * The type of Block, at the start. It takes no clicks, so it never covers
   * the Block above.
   */
  .block:hover::after,
  .block[aria-current="true"]::after,
  .column[data-column-selected] > .column-box::after {
    content: attr(data-label);
    inset-inline-start: 0;
    letter-spacing: 0.01em;
    padding: 0 6px;
    pointer-events: none;
    white-space: nowrap;
  }

  /*
   * The copy that follows the pointer is a popover, so that it's in the top
   * layer. This takes away a popover's own look, leaving what it copies.
   */
  :where([data-drag-ghost]) {
    background: none;
    border: none;
    color: inherit;
    overflow: visible;
    padding: 0;
  }

  /* What's dragged stays where it was, unseen, while its copy moves. */
  [data-drag-source] {
    opacity: 0;
  }

  /*
   * The Block or Row that follows the pointer, which also shows what's under
   * it. On the color of the Row it's in, or else the email's, as its text is
   * meant to be read on that. A Row's own color is inside it.
   */
  .block[data-drag-ghost],
  .row-frame[data-drag-ghost] {
    background: var(--_mq-row-background, var(--_mq-email-background));
    box-shadow: var(--mq-shadow);
    opacity: 0.85;
  }

  /*
   * Narrower than a Text Block's padding, so that a press on any text selects it
   * instead of dragging the Block.
   */
  .drag-handle {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: 0 0 var(--mq-radius-small) 0;
    box-shadow: var(--mq-shadow-small);
    color: var(--mq-color-text-muted);
    cursor: grab;
    display: flex;
    height: 24px;
    inset-block-start: 0;
    inset-inline-start: 0;
    justify-content: center;
    opacity: 0;
    position: absolute;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    width: 16px;
    z-index: var(--_mq-layer-handle);
  }

  .drag-handle .icon {
    height: 14px;
    width: 14px;
  }

  .block:hover .drag-handle,
  .block[aria-current="true"] .drag-handle {
    opacity: 1;
    z-index: var(--_mq-layer-shown-handle);
  }

  @media (hover: none) {
    .drag-handle {
      opacity: 1;
    }
  }

  /*
   * Only a thin Spacer's handle reaches past its Block. While it's hidden it
   * leaves that space alone. While it shows, it's on top, to be pressed.
   */
  @media (hover: hover) {
    .block:has(> .padded-block > .spacer):not(:hover, [aria-current="true"])
      .drag-handle {
      pointer-events: none;
    }
  }

  /* In the Phone view, a Row's Columns one under another, as on a phone. */
  .row[data-stacked] {
    flex-direction: column;
  }

  .row[data-stacked] > .column {
    width: 100% !important;
  }

  /*
   * Folded: what isn't on the device being viewed, as a thin strip that says
   * what it is and where it shows, and that can still be selected.
   */
  /* On the email, in stripes of the stand-in color over its background. */
  .away-strip {
    align-items: center;
    background: repeating-linear-gradient(
      -45deg,
      var(--mq-color-stand-in) 0 6px,
      transparent 6px 12px
    );
    border-block: 1px solid var(--mq-color-stand-in);
    color: var(--mq-color-on-stand-in);
    cursor: pointer;
    display: flex;
    font:
      500 var(--mq-font-size-small) / 1 var(--mq-font-family),
      sans-serif;
    gap: var(--mq-space-2);
    justify-content: center;
    min-height: 38px;
  }

  .block > .away-strip {
    border: 0;
    border-radius: var(--mq-radius-small);
    margin: var(--mq-space-2) var(--_mq-block-padding, 16px);
    min-height: 30px;
  }

  /* A selected folded Row, ringed as a selected Row is. */
  .row-frame[data-row-selected] > .away-strip {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .away-strip .icon {
    height: 14px;
    width: 14px;
  }

  /* Faded: full size, with a tag that says where it shows. */
  [data-away="fade"] > :not(.away-tag, .row-tag, .drag-handle) {
    opacity: 0.38;
  }

  .away-tag {
    align-items: center;
    background: var(--mq-color-text);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-surface);
    display: flex;
    font:
      500 var(--_mq-font-size-tag) / 20px var(--mq-font-family),
      sans-serif;
    gap: var(--mq-space-1);
    inset-block-start: var(--mq-space-2);
    inset-inline-start: var(--mq-space-2);
    padding: 0 6px;
    pointer-events: none;
    position: absolute;
    z-index: var(--_mq-layer-tags);
  }

  /* On a Block, above its end corner, clear of its content and its own tag. */
  .block > .away-tag {
    bottom: 100%;
    inset-block-start: auto;
    inset-inline: auto 0;
  }

  .away-tag .icon {
    height: 12px;
    width: 12px;
  }

  /* Beside "Row" on its tag, the devices it shows on alone. */
  .row-tag .icon {
    display: inline-block;
    height: 12px;
    margin-inline-start: 4px;
    vertical-align: -2px;
    width: 12px;
  }

  /*
   * The Preview, at the bottom left of the canvas while it shows, as far from
   * the canvas's left edge as from the window's bottom.
   */
  .floating-toolbar {
    align-self: flex-start;
    bottom: var(--mq-space-4);
    margin-block-start: auto;
    margin-inline-start: calc(var(--mq-space-4) - var(--_mq-gutter));
    position: sticky;
    z-index: var(--_mq-layer-floating-toolbar);
  }

  .floating-toolbar:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 1px;
  }

  /*
   * An email with no Rows: a slot to start one, with the layouts, as an empty
   * Column's placeholder is drawn.
   */
  .start-row {
    align-items: center;
    display: flex;
    justify-content: center;
    min-height: 420px;
    padding: var(--mq-space-5);
  }

  .start-slot {
    border: 1.5px dashed var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    font: var(--mq-font-size) / 1.45 var(--mq-font-family);
    padding: calc(var(--mq-space-5) + var(--mq-space-3)) var(--mq-space-5);
    text-align: center;
    width: min(520px, 100%);
  }

  .start-title {
    color: var(--mq-color-text);
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0 0 var(--mq-space-1);
  }

  .start-text {
    margin: 0;
  }

  .start-layouts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-2);
    justify-content: center;
    margin-block-start: var(--mq-space-4);
  }

  .start-layouts .add-tile {
    min-height: 40px;
    width: 64px;
  }
`;

/**
 * How the Canvas shows a Block or Row that isn't on the device being viewed:
 * as a thin strip, full size and faded, or not at all. The person picks it,
 * and the Shell remembers it.
 */
export type NotOnDevice = "fade" | "fold" | "hide";

/**
 * Where a Block or Row shows, as its marks say it on the Canvas and in the
 * Rows list, and their icon.
 */
export const SHOWN_ONLY_ON = {
  desktop: { icon: ICONS.phoneOff, words: "device.desktopOnly" },
  phone: { icon: ICONS.phone, words: "device.phonesOnly" },
} as const;

/**
 * Whether a Block or Row is on the device being viewed, or else how it shows:
 * as a strip, faded, or not at all.
 */
const awayOf = (
  item: { props: object },
  { device, notOnDevice }: Pick<PanelApi, "device" | "notOnDevice">
) => (isHiddenOn(item, device) ? notOnDevice : undefined);

/** What a Block or Row isn't on the device being viewed says, and its icon. */
const awayWords = (item: { props: object }, api: PanelApi) => {
  const { icon, words } =
    SHOWN_ONLY_ON[(item.props as { showOn: ShowOn }).showOn];
  return { icon, words: api.text(words) };
};

/** A strip in place of what isn't on the device: "Row 5 · Phones only". */
export const renderAwayStrip = (
  item: { props: object },
  name: string,
  api: PanelApi,
  onClick?: () => void
) => {
  const { icon, words } = awayWords(item, api);
  return html`<div
    class="ui away-strip"
    data-testid="away-strip"
    @click=${onClick}
  >
    ${icon}<span>${api.text("canvas.notHere", { name, words })}</span>
  </div>`;
};

/**
 * A Block's name for screen readers, with where it shows when that isn't
 * every device, as its strip or tag isn't read.
 */
const blockName = (
  block: Block,
  where: TextValues,
  type: string,
  api: PanelApi
) => {
  const { showOn } = block.props as { showOn?: ShowOn };
  return showOn === undefined
    ? api.text("canvas.block", { ...where, type })
    : api.text("canvas.blockShownOn", {
        ...where,
        type,
        words: api.text(SHOWN_ONLY_ON[showOn].words),
      });
};

/** The tag on what's faded, as it isn't on the device: "Phones only". */
const renderAwayTag = (item: { props: object }, api: PanelApi) => {
  const { icon, words } = awayWords(item, api);
  return html`<span
    aria-hidden="true"
    class="ui away-tag"
    data-testid="away-tag"
    >${icon}${words}</span
  >`;
};

/**
 * The email as the Canvas draws it on a device: without what's hidden there,
 * and without the Blocks of a folded Row, which only its strip stands for. A
 * folded Block is drawn as its strip, and a faded one in full. The arrow keys
 * go only to what it draws.
 */
export const drawnEmail = (
  email: BlocksDocument,
  device: Device,
  notOnDevice: NotOnDevice
): BlocksDocument => {
  if (notOnDevice === "fade") {
    return email;
  }
  return {
    ...email,
    rows: email.rows.flatMap((row) => {
      if (!isHiddenOn(row, device)) {
        return [
          notOnDevice === "hide"
            ? {
                ...row,
                columns: row.columns.map((column) => ({
                  ...column,
                  blocks: column.blocks.filter(
                    (block) => !isHiddenOn(block, device)
                  ),
                })),
              }
            : row,
        ];
      }
      return notOnDevice === "hide"
        ? []
        : [
            {
              ...row,
              columns: row.columns.map((column) => ({ ...column, blocks: [] })),
            },
          ];
    }),
  };
};

/**
 * What the Canvas shows of its own, besides what the panel API gives it. Its
 * format bar uses only the panel API.
 */
export interface CanvasState {
  /** On each Block's content. With none set, it's unknown, as in the export. */
  emailLang: string;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  failedImages: ReadonlySet<string>;
  /** Whether an image is being uploaded for the Block. */
  isUploading: (blockId: string) => boolean;
  /** Whether a play button is being drawn on a Video's thumbnail and uploaded. */
  isAddingPlay: (blockId: string) => boolean;
  /** The Host app's folder of Social icons, as the export takes it. */
  socialIconsUrl: string | undefined;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => HTMLElement | undefined;
  /** In Style, what the setting being looked at changes, or leaves its own. */
  styleMarks: ReadonlyMap<string, StyleMark>;
}

export interface CanvasEvents {
  onBlockFocus: (blockId: string) => void;
  /**
   * Focus in an empty Column's toolbar, in a Row with no Blocks, which then
   * has no other way in from the keyboard.
   */
  onEmptyRowFocus: (rowId: string) => void;
  onBlockFocusout: () => void;
  onImageError: (src: string) => void;
}

/** Only a pointer drags, so this isn't offered to assistive technology. */
const renderDragHandle = (tooltip: string) => html`
  <div
    aria-hidden="true"
    class="drag-handle"
    data-place=${place("dragHandle")}
    data-testid="drag-handle"
    data-tooltip=${tooltip}
  >
    ${ICONS.grip}
  </div>
`;

/** Over what a setting in Style changes, or keeps its own value: what and how. */
const renderStyleTag = (mark: StyleMark | undefined) =>
  mark?.tag
    ? html`<span
        aria-hidden="true"
        class=${`ui style-tag ${mark.kind}`}
        data-testid="style-tag"
        >${mark.tag}</span
      >`
    : nothing;

/**
 * A Block's Box, as the export draws it: its background, border and corners
 * on the Block, and its padding on what's inside, which a Social Block's
 * icons take their own share of.
 */
const boxLook = (block: Block) => {
  const {
    "padding-top": _top,
    "padding-right": _right,
    "padding-bottom": _bottom,
    "padding-left": _left,
    ...box
  } = blockBoxStyles(block);
  return { ...box, "--_mq-block-padding": blockPaddingCss(block) };
};

/** Where a Column's Blocks sit, as its `verticalAlign` says. */
const COLUMN_ALIGN = {
  bottom: "flex-end",
  middle: "center",
  top: "flex-start",
} as const;

/**
 * A Block that isn't on the device being viewed, folded: a strip in its
 * place, which is selected, reached and moved as the Block is.
 */
const renderFoldedBlock = (
  block: Block,
  where: TextValues,
  isTabStop: boolean,
  api: PanelApi,
  events: CanvasEvents
) => {
  const { text } = api;
  const type = blockTypeName(block.type, text);
  const drawn = api.device === "phone" ? onPhone(block) : block;
  return html`
    <div
      aria-current=${block.id === api.selectedBlock?.block.id ? "true" : nothing}
      aria-describedby="block-keys-no-text"
      aria-label=${blockName(block, where, type, api)}
      class="block"
      data-away="fold"
      data-block-id=${block.id}
      data-label=${type}
      data-place=${place("block")}
      role="group"
      style=${styleProperties({ "--_mq-block-padding": blockPaddingCss(drawn) })}
      tabindex=${isTabStop ? "0" : "-1"}
      @focus=${() => events.onBlockFocus(block.id)}
      @focusout=${events.onBlockFocusout}
    >
      ${renderDragHandle(text("canvas.dragBlock"))}
      ${renderAwayStrip(block, type, api)}
    </div>
  `;
};

const renderBlock = (
  block: Block,
  /** Where the Block is, as `blockPlace` gives it. */
  where: TextValues,
  /** Whether it's the email's one stop for Tab, as `renderRows` says. */
  isTabStop: boolean,
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const { text } = api;
  const style = api.email.settings.style ?? {};
  const mark = state.styleMarks.get(block.id);
  const selected = block.id === api.selectedBlock?.block.id;
  const rich = hasRichText(block);
  const type = blockTypeName(block.type, text);
  // As the device being viewed shows it.
  const drawn = api.device === "phone" ? onPhone(block) : block;
  const away = awayOf(block, api);
  if (away === "fold") {
    return renderFoldedBlock(block, where, isTabStop, api, events);
  }
  return html`
    <div
      aria-current=${selected ? "true" : nothing}
      aria-describedby=${rich ? "block-keys" : "block-keys-no-text"}
      aria-label=${blockName(block, where, type, api)}
      class="block"
      data-away=${away ?? nothing}
      data-block-id=${block.id}
      data-label=${type}
      data-place=${place("block")}
      data-style-mark=${mark?.kind ?? nothing}
      ?data-style-tagged=${mark?.tag !== undefined}
      role="group"
      style=${styleProperties({
        ...(hasRichText(drawn) ? textBlockLook(drawn, style) : {}),
        ...boxLook(drawn),
      })}
      tabindex=${isTabStop ? "0" : "-1"}
      @focus=${() => events.onBlockFocus(block.id)}
      @focusout=${events.onBlockFocusout}
    >
      ${renderDragHandle(text("canvas.dragBlock"))} ${renderStyleTag(mark)}
      ${away === "fade" ? renderAwayTag(block, api) : nothing}
      ${rich ? state.textOf(block.id) : nothing}
      ${renderBlockContent(drawn, {
        failedImages: state.failedImages,
        lang: state.emailLang,
        onImageError: events.onImageError,
        socialIconsUrl: state.socialIconsUrl,
        style,
        text,
        uploading: state.isUploading(block.id),
        addingPlay: state.isAddingPlay(block.id),
      })}
      ${selected && rich && api.editingText ? renderFormatBar(api) : nothing}
      ${selected && rich ? renderMergeTagPicker(api) : nothing}
    </div>
  `;
};

/**
 * A Column, with its Blocks, and after each a + that adds a Block there. An
 * empty one has a button that opens the picker in it, one stop for Tab. In a
 * Row with no Blocks, focus there selects the Row, so Tab goes on to the
 * Selection bar with its settings.
 */
const renderColumn = (
  column: Column,
  /** Where the Column is, as `columnPlace` gives it. */
  where: TextValues,
  /** The Block that's the email's one stop for Tab, if any. */
  tabStop: string | undefined,
  /** Its Row's, when the Row has no Blocks at all. */
  emptyRowId: string | undefined,
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const { blocks, id, width } = column;
  const { verticalAlign = "top" } = column.props as ColumnProps;
  /** A press on the Column itself, not on what's in it, selects it. */
  const onClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      api.selectColumn(id, false);
    }
  };
  return html`
    <div
      class=${blocks.length === 0 ? "column empty" : "column"}
      data-column-id=${id}
      data-place=${place("column")}
      ?data-column-selected=${id === api.selectedColumn?.column.id}
      data-testid="column"
      style=${styleProperties({
        "justify-content": COLUMN_ALIGN[verticalAlign],
        width: `${width}%`,
      })}
      @click=${onClick}
    >
      <div
        class="column-box"
        data-testid="column-box"
        data-label=${api.text("canvas.column", { column: where.column })}
        style=${styleProperties(
          columnStyles(api.device === "phone" ? onPhone(column) : column)
        )}
        @click=${onClick}
      >
        ${repeat(
          blocks,
          (block) => block.id,
          (block, blockIndex) =>
            awayOf(block, api) === "hide"
              ? nothing
              : html`
                  ${renderBlock(
                    block,
                    { ...where, ...placeIn(blockIndex, blocks.length) },
                    block.id === tabStop,
                    api,
                    state,
                    events
                  )}
                  ${renderInsertPoint(
                    {
                      afterBlockId: block.id,
                      columnId: id,
                      index: blockIndex + 1,
                    },
                    api
                  )}
                `
        )}
        ${
          blocks.length === 0
            ? html`
                <div class="ui placeholder" data-testid="placeholder">
                  ${
                    api.adding.picker?.at.columnId === id
                      ? renderAddPicker(api, true)
                      : html`<button
                          aria-haspopup="dialog"
                          aria-label=${api.text("canvas.addToColumn", where)}
                          class="placeholder-button"
                          data-place=${place("addBlocks")}
                          data-testid="add-blocks"
                          type="button"
                          @click=${({ detail }: MouseEvent) =>
                            api.openPicker(
                              { columnId: id, index: 0 },
                              detail === 0
                            )}
                          @focusin=${() => {
                            if (emptyRowId !== undefined) {
                              events.onEmptyRowFocus(emptyRowId);
                            }
                          }}
                        >
                          <span class="placeholder-icon">${ICONS.plus}</span>
                          <span data-testid="placeholder-label"
                            >${api.text("canvas.dropHere")}</span
                          >
                        </button>`
                  }
                </div>
              `
            : nothing
        }
      </div>
    </div>
  `;
};

/**
 * As in the export, where a Row without a color of its own takes the Email
 * style's, and for what's dragged out of it, which has no Row behind it.
 */
export const rowLook = (row: Row, { emailBackgroundColor }: EmailStyle) => {
  const styles = rowStyles(row);
  const background = styles["background-color"] ?? emailBackgroundColor;
  return {
    ...styles,
    "--_mq-row-background": background,
    "background-color": background,
  };
};

/**
 * With no Rows, a slot to start one, which adds a Row with the layout picked.
 * Its layouts are one stop for Tab, with arrow keys between them.
 */
const renderStartRow = (api: PanelApi) => {
  const { text } = api;
  return html`
    <div class="ui start-row" data-testid="start-row">
      <div class="start-slot">
        <p class="start-title">${text("canvas.startTitle")}</p>
        <p class="start-text">${text("canvas.startText")}</p>
        <div
          aria-label=${text("canvas.startTitle")}
          class="start-layouts"
          data-place=${place("startLayouts")}
          role="group"
        >
          ${ROW_LAYOUTS.map(
            (layout, index) => html`
              <button
                aria-label=${text("add.addLayout", { layout })}
                class="add-tile"
                data-tooltip=${text("add.addLayout", { layout })}
                tabindex=${index === 0 ? "0" : "-1"}
                type="button"
                @click=${({ detail }: MouseEvent) =>
                  api.addRow(layout, detail === 0)}
              >
                ${renderThumbnail(layout)}
              </button>
            `
          )}
        </div>
      </div>
    </div>
  `;
};

/**
 * The email's Rows, with their tags, Columns and Blocks.
 *
 * Of the Blocks, one is a stop for Tab: the selected Block, or with nothing
 * selected the first, and the arrow keys go to the others. So Tab from the
 * selected Block selects no other Block on its way to the Selection bar,
 * stopping only at the empty Columns' toolbars after it. With a Row selected
 * no Block is a stop.
 */
export const renderRows = (
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const { rows } = api.email;
  if (rows.length === 0) {
    return renderStartRow(api);
  }
  const drawn = blocksIn(drawnEmail(api.email, api.device, api.notOnDevice));
  const selected = api.selectedBlock?.block.id;
  // The selected Block, unless it isn't drawn, as in a folded Row.
  let tabStop = api.selectedRow ? undefined : drawn[0]?.id;
  if (selected !== undefined && drawn.some(({ id }) => id === selected)) {
    tabStop = selected;
  }
  return repeat(
    rows,
    (row) => row.id,
    (row, rowIndex) => renderRow(row, rowIndex, tabStop, api, state, events)
  );
};

/**
 * A Row, with its tag, its Columns and their Blocks, as the device being
 * viewed shows it, or its strip or nothing where it isn't on that device.
 */
const renderRow = (
  row: Row,
  rowIndex: number,
  tabStop: string | undefined,
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const away = awayOf(row, api);
  if (away === "hide") {
    return nothing;
  }
  const selected = row.id === api.selectedRow?.row.id;
  if (away === "fold") {
    return html`
      <div
        class="row-frame"
        data-away="fold"
        data-place=${place("row")}
        data-row-id=${row.id}
        data-testid="row-frame"
        ?data-row-selected=${selected}
      >
        ${renderAwayStrip(
          row,
          api.text("canvas.row", { row: rowIndex + 1 }),
          api,
          () => api.selectRow(row.id, false)
        )}
      </div>
    `;
  }
  const drawn = api.device === "phone" ? onPhone(row) : row;
  const { showOn, stackOnPhone } = row.props as RowProps;
  return html`
    <div
      class="row-frame"
      data-away=${away ?? nothing}
      data-place=${place("row")}
      data-row-id=${row.id}
      data-testid="row-frame"
      ?data-row-selected=${selected}
    >
      <div
        aria-hidden="true"
        class="ui row-tag"
        data-place=${place("rowTag")}
        data-testid="row-tag"
        @click=${() => api.selectRow(row.id, false)}
      >
        ${api.text("canvas.rowTag")}${
          showOn === undefined
            ? nothing
            : html`<span data-tooltip=${api.text(SHOWN_ONLY_ON[showOn].words)}
                >${SHOWN_ONLY_ON[showOn].icon}</span
              >`
        }
      </div>
      ${renderStyleTag(state.styleMarks.get(row.id))}
      ${away === "fade" ? renderAwayTag(row, api) : nothing}
      <div
        class="row"
        data-style-mark=${state.styleMarks.get(row.id)?.kind ?? nothing}
        ?data-stacked=${
          api.device === "phone" &&
          row.columns.length > 1 &&
          stackOnPhone !== false
        }
        data-testid="row"
        style=${styleProperties(rowLook(drawn, api.email.settings.style ?? {}))}
      >
        ${repeat(
          row.columns,
          (column) => column.id,
          (column, columnIndex) =>
            renderColumn(
              column,
              columnPlace(rowIndex, columnIndex),
              tabStop,
              row.columns.every(({ blocks }) => blocks.length === 0)
                ? row.id
                : undefined,
              api,
              state,
              events
            )
        )}
      </div>
    </div>
  `;
};

/**
 * Away from the Selection bar and the Add panel, so it never covers them.
 * Undo and redo are in the top bar. It also holds focus after a press on the
 * Workspace, so keyboard undo and paste still work.
 */
export const renderFloatingToolbar = ({ openCheck, text }: PanelApi) => html`
  <div
    aria-label=${text("canvas.emailTools")}
    class="ui bar floating-toolbar"
    data-place=${place("emailTools")}
    role="group"
    tabindex="-1"
  >
    <button
      aria-label=${text("canvas.check")}
      class="icon-button"
      data-tooltip=${text("canvas.check")}
      type="button"
      @click=${openCheck}
    >
      ${ICONS.check}
    </button>
  </div>
`;
