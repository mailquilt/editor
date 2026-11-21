import { BLOCK_TYPES } from "@mailquilt/core";
import type { Block, Column, Row } from "@mailquilt/core";
import { blockLabel, blockStyles, rowStyles } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { BLOCK_VIEWS, hasRichText, renderBlockContent } from "./block-types.js";
import { place } from "./editor-places.js";
import { renderFormatBar } from "./format-bar.js";
import { ICONS } from "./icons.js";
import { keyLabel } from "./key-map.js";
import type { PanelApi } from "./panel-api.js";
import { columnLabel, positionLabel } from "./positions.js";
import { styleProperties } from "./style-properties.js";
import { UI_LANG } from "./theme.js";

const MOVE_BUTTONS = (["up", "down", "left", "right"] as const).map(
  (direction) => ({
    direction,
    ...keyLabel("blockToolbar", "moveBlock", { direction }),
  })
);

/** A Row moves only up and down. */
const ROW_MOVE_BUTTONS = (["up", "down"] as const).map((direction) => ({
  direction,
  ...keyLabel("rowToolbar", "moveRow", { direction }),
}));

const UNDO = keyLabel("editor", "undo");
const REDO = keyLabel("editor", "redo");

/**
 * The Rows, Columns and Blocks on the canvas, their tools, the floating
 * toolbar and the narrow notice.
 */
export const canvasStyles = css`
  .row-frame {
    position: relative;
  }

  .row {
    display: flex;
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
  .block[aria-current="true"]::after {
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
  .block[aria-current="true"]::after {
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

  .column {
    min-width: 0;
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
    display: flex;
    min-height: 112px;
    padding: var(--mq-space-2);
  }

  /*
   * Quiet until the pointer or focus comes to it. The label and the buttons
   * share one spot, so whichever shows is centred: the buttons on hover or
   * keyboard focus, and the label otherwise.
   */
  .placeholder {
    background: var(--mq-color-surface);
    border: 1.5px dashed var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    display: grid;
    flex: 1;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    min-width: 0;
    place-items: center;
    padding: var(--mq-space-3) var(--mq-space-2);
    text-align: center;
    transition:
      background-color 120ms,
      border-color 120ms;
  }

  .column.empty:hover .placeholder,
  .placeholder:focus-within,
  .email[data-dragging] .column[data-drop-target] .placeholder {
    border-color: var(--mq-color-accent);
    color: var(--mq-color-accent-strong);
  }

  .placeholder p {
    margin: 0;
  }

  .placeholder-label,
  .placeholder .add-blocks {
    grid-area: 1 / 1;
    transition: opacity 120ms;
  }

  /*
   * Faded out, it still paints over the buttons in its spot, so it never
   * takes the pointer from them.
   */
  .placeholder-label {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-1);
    pointer-events: none;
  }

  .column.empty:hover .placeholder-label,
  .placeholder:focus-within .placeholder-label {
    opacity: 0;
  }

  .email[data-dragging] .placeholder-label {
    opacity: 1;
  }

  .email[data-dragging] .placeholder .add-blocks {
    opacity: 0;
  }

  .placeholder-icon {
    align-items: center;
    background: var(--mq-color-surface-muted);
    border-radius: 50%;
    display: flex;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .placeholder .add-blocks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-1);
    justify-content: center;
    opacity: 0;
  }

  .column.empty:hover .add-blocks,
  .placeholder:focus-within .add-blocks {
    opacity: 1;
  }

  /* With no hover to bring them out, the buttons show instead of the label. */
  @media (hover: none) {
    .placeholder .add-blocks {
      opacity: 1;
    }

    .placeholder-label {
      opacity: 0;
    }
  }

  /* In the placeholder's color, which turns to the accent as a drop target. */
  .placeholder .icon-button {
    border: 1px solid var(--mq-color-border);
    color: inherit;
    height: 26px;
    width: 26px;
  }

  .block {
    position: relative;
  }

  /*
   * Where a focused Block, and its tools, are scrolled to: clear of its tag above
   * and of the floating toolbar below.
   */
  .block,
  .block-toolbar,
  .ProseMirror {
    scroll-margin-block: 48px 72px;
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
  .block[aria-current="true"] {
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  /* Stands out from a Block that's only selected, or whose text has focus. */
  .block:focus-visible {
    background-color: var(--mq-color-accent-soft);
    outline: 3px solid var(--mq-color-accent-strong);
    outline-offset: -3px;
  }

  /*
   * The type of Block, at the start. It takes no clicks, so it never covers
   * the Block above.
   */
  .block:hover::after,
  .block[aria-current="true"]::after {
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
    .block:has(> .spacer):not(:hover, [aria-current="true"]) .drag-handle {
      pointer-events: none;
    }
  }

  /*
   * Down the selected Block's start side, outside it: in the gutter for the
   * first Column, and over the end of the Column before for the others, where
   * no Block keeps its handle.
   */
  .block-toolbar {
    background: var(--mq-color-text);
    border-color: transparent;
    color: var(--mq-color-surface);
    flex-direction: column;
    inset-block-start: 0;
    inset-inline-end: calc(100% + 4px);
    position: absolute;
    /* Over the floating toolbar, which it can be moved onto at the canvas's end. */
    z-index: var(--_mq-layer-block-tools);
  }

  .block-toolbar .icon-button {
    color: color-mix(in srgb, var(--mq-color-surface) 78%, transparent);
  }

  .block-toolbar .icon-button:hover {
    background: color-mix(in srgb, var(--mq-color-surface) 14%, transparent);
    color: var(--mq-color-surface);
  }

  .block-toolbar .icon-button.danger:hover {
    background: var(--mq-color-danger);
    color: var(--mq-color-on-accent);
  }

  .block-toolbar .icon-button:focus-visible {
    outline-color: var(--mq-color-surface);
  }

  .block-toolbar .separator {
    background: color-mix(in srgb, var(--mq-color-surface) 18%, transparent);
    height: 1px;
    margin: 2px 4px;
    width: auto;
  }

  .block-toolbar .drag-handle,
  .row-toolbar .drag-handle {
    background: none;
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: none;
    height: 22px;
    opacity: 1;
    position: static;
    width: 28px;
  }

  .block-toolbar .drag-handle {
    color: color-mix(in srgb, var(--mq-color-surface) 60%, transparent);
  }

  .block-toolbar .drag-handle:hover {
    background: color-mix(in srgb, var(--mq-color-surface) 14%, transparent);
    color: var(--mq-color-surface);
  }

  /*
   * A Row's tools, beside it on the right. The padding bridges the gap, so the
   * pointer can get there without leaving the Row. Hidden, it takes no clicks.
   */
  .row-toolbar {
    inset-block-start: 0;
    inset-inline-start: 100%;
    opacity: 0;
    padding-inline-start: var(--mq-space-2);
    pointer-events: none;
    position: absolute;
    transition: opacity 120ms;
    z-index: var(--_mq-layer-tags);
  }

  /*
   * Not while one of its Blocks is selected, which has tools of its own. Its
   * tag still shows on hover, and selects the Row.
   */
  .row-frame:hover:not(:has(.block[aria-current="true"])) > .row-toolbar,
  .row-frame[data-row-selected] > .row-toolbar,
  .row-toolbar:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  /*
   * While the pointer is on a Row, only its toolbar shows, so a short Row's
   * toolbar never sits over another's buttons.
   */
  .email:has(.row-frame:hover)
    .row-frame:not(:hover)
    > .row-toolbar:not(:has(:focus-visible)) {
    opacity: 0;
    pointer-events: none;
  }

  .row-toolbar > .bar {
    flex-direction: column;
  }

  .row-toolbar .drag-handle:hover {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  /*
   * Undo, Redo and Preview, at the bottom left of the canvas while it shows,
   * as far from the canvas's left edge as from the window's bottom.
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

  /* Standing in for the editor, so it fills any height the host gives too. */
  .narrow-notice {
    align-items: center;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-3);
    justify-content: center;
    min-height: 360px;
    padding: 40px var(--mq-space-5);
    text-align: center;
  }

  .narrow-notice .notice-icon {
    align-items: center;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    display: flex;
    height: 56px;
    justify-content: center;
    margin-block-end: var(--mq-space-2);
    width: 56px;
  }

  .narrow-notice .notice-icon .icon {
    height: 24px;
    width: 24px;
  }

  .narrow-notice .notice-title {
    font-size: var(--_mq-font-size-notice-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .narrow-notice .notice-body {
    color: var(--mq-color-text-muted);
    line-height: 1.5;
    margin: 0;
    max-width: 34ch;
  }

  .narrow-notice .text-button {
    align-items: center;
    display: inline-flex;
    gap: var(--mq-space-2);
    height: 40px;
    margin-block-start: var(--mq-space-2);
    padding: 0 var(--mq-space-4);
  }
`;

/** Narrower than this, there's no room to edit, and a notice shows instead. */
export const MIN_EDITOR_WIDTH = 640;

/**
 * What the Canvas shows of its own, besides what the panel API gives it. Its
 * toolbars and format bar use only the panel API.
 */
export interface CanvasState {
  /** On each Block's content. With none set, it's unknown, as in the export. */
  emailLang: string;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  failedImages: ReadonlySet<string>;
  /** Whether an image is being uploaded for the Block. */
  isUploading: (blockId: string) => boolean;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => HTMLElement | undefined;
}

export interface CanvasEvents {
  onBlockClick: (blockId: string, target: Element) => void;
  onBlockFocus: (blockId: string) => void;
  onBlockFocusout: () => void;
  onImageError: (src: string) => void;
}

/** Only a pointer drags, so this isn't offered to assistive technology. */
const renderDragHandle = (tooltip = "Drag Block") => html`
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

/**
 * On a phone there's no room for the canvas and the side panel. The editor
 * stays as it is, so nothing is lost, and the email can still be previewed.
 */
export const renderNarrowNotice = ({ openPreview }: PanelApi) => html`
  <div
    class="ui frame narrow-notice"
    data-place=${place("notice")}
    lang=${UI_LANG}
    part="frame"
  >
    <span class="notice-icon">${ICONS.monitor}</span>
    <p class="notice-title">Editing needs more room</p>
    <p class="notice-body">
      Make the editor at least ${MIN_EDITOR_WIDTH}px wide, such as by widening
      the window, to change this email. You can still preview it here.
    </p>
    <button
      class="text-button primary"
      data-place=${place("controls")}
      type="button"
      @click=${openPreview}
    >
      ${ICONS.preview}<span>Preview email</span>
    </button>
  </div>
`;

/**
 * Beside the Row, on hover, on focus, and while the Row is selected. One stop
 * for Tab, then arrow keys go along. Alt+↑ and Alt+↓ move the Row from here,
 * as the Move buttons say.
 */
const renderRowToolbar = (
  row: Row,
  index: number,
  count: number,
  api: PanelApi
) => html`
  <div
    aria-current=${row.id === api.selectedRow?.row.id ? "true" : nothing}
    aria-label=${`Row ${index + 1}`}
    aria-orientation="vertical"
    class="ui row-toolbar"
    data-place=${place("rowToolbar")}
    role="toolbar"
  >
    <div class="bar">
      ${renderDragHandle("Drag Row")}
      <button
        aria-label="Select Row"
        class="icon-button"
        ?data-active=${row.id === api.selectedRow?.row.id}
        data-action="select-row"
        data-tooltip="Select Row"
        type="button"
        @click=${({ detail }: MouseEvent) => api.selectRow(row.id, detail === 0)}
      >
        ${ICONS.select}
      </button>
      ${ROW_MOVE_BUTTONS.map(
        ({ direction, keys, shortcuts }) => html`
          <button
            aria-keyshortcuts=${shortcuts}
            aria-label=${`Move Row ${direction}`}
            class="icon-button"
            data-action=${`move-${direction}`}
            data-tooltip=${`Move Row ${direction} (${keys})`}
            ?disabled=${direction === "up" ? index === 0 : index === count - 1}
            tabindex="-1"
            type="button"
            @click=${() => api.moveRow(row.id, direction)}
          >
            ${ICONS[direction]}
          </button>
        `
      )}
      <button
        aria-label="Delete Row"
        class="icon-button danger"
        data-action="delete"
        data-tooltip="Delete Row"
        tabindex="-1"
        type="button"
        @click=${({ detail }: MouseEvent) => api.deleteRow(row.id, detail === 0)}
      >
        ${ICONS.delete}
      </button>
    </div>
  </div>
`;

/** The selected Block's tools. One stop for Tab, then arrow keys go along. */
const renderBlockToolbar = (api: PanelApi) => html`
  <div
    aria-label="Block tools"
    aria-orientation="vertical"
    class="ui bar block-toolbar"
    data-place=${place("blockToolbar")}
    role="toolbar"
  >
    ${renderDragHandle()}
    <span class="separator"></span>
    ${MOVE_BUTTONS.map(
      ({ direction, keys, shortcuts }, index) => html`
        <button
          aria-keyshortcuts=${shortcuts}
          aria-label=${`Move Block ${direction}`}
          class="icon-button"
          data-action=${`move-${direction}`}
          data-tooltip=${`Move Block ${direction} (${keys})`}
          tabindex=${index === 0 ? "0" : "-1"}
          type="button"
          @click=${() => api.moveBlock(direction)}
        >
          ${ICONS[direction]}
        </button>
      `
    )}
    <span class="separator"></span>
    <button
      aria-label="Delete Block"
      class="icon-button danger"
      data-action="delete"
      data-tooltip="Delete Block"
      tabindex="-1"
      type="button"
      @click=${({ detail }: MouseEvent) => api.deleteBlock(detail === 0)}
    >
      ${ICONS.delete}
    </button>
  </div>
`;

const renderBlock = (
  block: Block,
  /** Where the Block is, in words. */
  label: string,
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const selected = block.id === api.selectedBlock?.block.id;
  const rich = hasRichText(block);
  return html`
    <div
      aria-current=${selected ? "true" : nothing}
      aria-describedby=${rich ? "block-keys" : "block-keys-no-text"}
      aria-label=${`${blockLabel(block.type)} Block, ${label}`}
      class="block"
      data-block-id=${block.id}
      data-label=${blockLabel(block.type)}
      data-place=${place("block")}
      role="group"
      style=${styleProperties(rich ? blockStyles(block) : {})}
      tabindex="0"
      @click=${({ target }: MouseEvent) =>
        events.onBlockClick(block.id, target as Element)}
      @focus=${() => events.onBlockFocus(block.id)}
      @focusout=${events.onBlockFocusout}
    >
      ${selected ? nothing : renderDragHandle()}
      ${rich ? state.textOf(block.id) : nothing}
      ${renderBlockContent(block, {
        failedImages: state.failedImages,
        lang: state.emailLang,
        onImageError: events.onImageError,
        uploading: state.isUploading(block.id),
      })}
      ${selected ? renderBlockToolbar(api) : nothing}
      ${selected && rich && api.editingText ? renderFormatBar(api) : nothing}
    </div>
  `;
};

const renderColumn = (
  { blocks, id, width }: Column,
  /** Where the Column is, in words. */
  label: string,
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => html`
  <div
    class=${blocks.length === 0 ? "column empty" : "column"}
    data-column-id=${id}
    data-place=${place("column")}
    data-testid="column"
    style=${styleProperties({ width: `${width}%` })}
  >
    ${repeat(
      blocks,
      (block) => block.id,
      (block, blockIndex) =>
        renderBlock(
          block,
          `${label}, ${positionLabel(blockIndex, blocks.length)}`,
          api,
          state,
          events
        )
    )}
    ${
      blocks.length === 0
        ? html`
            <div class="ui placeholder" data-testid="placeholder">
              <div class="placeholder-label" data-testid="placeholder-label">
                <span class="placeholder-icon">${ICONS.plus}</span>
                <p>Drop a Block here</p>
              </div>
              <div class="add-blocks" data-testid="add-blocks">
                ${BLOCK_TYPES.map(
                  ({ label: typeLabel, type }) => html`
                    <button
                      aria-label=${`Add ${typeLabel} Block here, ${label}`}
                      class="icon-button"
                      data-tooltip=${`Add ${typeLabel} Block here`}
                      type="button"
                      @click=${() =>
                        api.addBlock(type, { columnId: id, index: 0 })}
                    >
                      ${BLOCK_VIEWS[type].icon}
                    </button>
                  `
                )}
              </div>
            </div>
          `
        : nothing
    }
  </div>
`;

/** As in the export, and for what's dragged out of it, which has no Row behind it. */
const rowLook = (row: Row) => {
  const styles = rowStyles(row);
  return { ...styles, "--_mq-row-background": styles["background-color"] };
};

/** The email's Rows, with their tools, Columns and Blocks. */
export const renderRows = (
  api: PanelApi,
  state: CanvasState,
  events: CanvasEvents
) => {
  const { rows } = api.email;
  return repeat(
    rows,
    (row) => row.id,
    (row, rowIndex) => html`
      <div
        class="row-frame"
        data-place=${place("row")}
        data-row-id=${row.id}
        data-testid="row-frame"
        ?data-row-selected=${row.id === api.selectedRow?.row.id}
      >
        <div
          aria-hidden="true"
          class="ui row-tag"
          data-place=${place("rowTag")}
          data-testid="row-tag"
          @click=${() => api.selectRow(row.id, false)}
        >
          Row
        </div>
        ${renderRowToolbar(row, rowIndex, rows.length, api)}
        <div
          class="row"
          data-testid="row"
          style=${styleProperties(rowLook(row))}
        >
          ${repeat(
            row.columns,
            (column) => column.id,
            (column, columnIndex) =>
              renderColumn(
                column,
                columnLabel(rowIndex, columnIndex),
                api,
                state,
                events
              )
          )}
        </div>
      </div>
    `
  );
};

/** Away from the side panel, so it never covers the settings. */
export const renderFloatingToolbar = (api: PanelApi) => html`
  <div
    aria-label="Email tools"
    class="ui bar floating-toolbar"
    data-place=${place("emailTools")}
    role="group"
    tabindex="-1"
  >
    <button
      aria-keyshortcuts=${UNDO.shortcuts}
      aria-label="Undo"
      class="icon-button"
      data-tooltip=${`Undo (${UNDO.keys})`}
      ?disabled=${!api.canUndo}
      type="button"
      @click=${() => api.stepHistory("undo")}
    >
      ${ICONS.undo}
    </button>
    <button
      aria-keyshortcuts=${REDO.shortcuts}
      aria-label="Redo"
      class="icon-button"
      data-tooltip=${`Redo (${REDO.keys})`}
      ?disabled=${!api.canRedo}
      type="button"
      @click=${() => api.stepHistory("redo")}
    >
      ${ICONS.redo}
    </button>
    <span class="separator"></span>
    <button
      aria-label="Preview"
      class="icon-button"
      data-tooltip="Preview"
      type="button"
      @click=${api.openPreview}
    >
      ${ICONS.preview}
    </button>
  </div>
`;
