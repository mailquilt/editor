import type { Block, Column, Row } from "@mailquilt/core";
import { blockStyles, rowStyles } from "@mailquilt/core/internal";
import type { RowProps } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { renderAddPicker, renderInsertPoint } from "./adding.js";
import { hasRichText, renderBlockContent } from "./block-types.js";
import { place } from "./editor-places.js";
import { renderFormatBar } from "./format-bar.js";
import { ICONS } from "./icons.js";
import { renderMergeTagPicker } from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { blocksIn, columnPlace, placeIn } from "./positions.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { TextValues } from "./text.js";

/**
 * The Rows, Columns and Blocks on the canvas, their tags and handles, the
 * floating toolbar and the narrow notice.
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

  /* What's opened in the Column, the picker, hangs from it. */
  .column {
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
    display: flex;
    min-height: 112px;
    padding: var(--mq-space-2);
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
  .block[aria-current="true"] {
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

  /* Beside "Row" on its tag, that it's hidden on phones. */
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

  /* Standing in for the Modes, so it fills any height the host gives too. */
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
 * format bar uses only the panel API.
 */
export interface CanvasState {
  /** On each Block's content. With none set, it's unknown, as in the export. */
  emailLang: string;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  failedImages: ReadonlySet<string>;
  /** Whether an image is being uploaded for the Block. */
  isUploading: (blockId: string) => boolean;
  /** The Host app's folder of Social icons, as the export takes it. */
  socialIconsUrl: string | undefined;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => HTMLElement | undefined;
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

/**
 * On a phone there's no room for the canvas and its panels. The editor
 * stays as it is, below the top bar, so nothing is lost, and the email can
 * still be previewed.
 */
export const renderNarrowNotice = ({ openPreview, text }: PanelApi) => html`
  <div
    class="ui narrow-notice"
    data-place=${place("notice")}
    lang=${text("language")}
  >
    <span class="notice-icon">${ICONS.monitor}</span>
    <p class="notice-title">${text("canvas.narrowTitle")}</p>
    <p class="notice-body">
      ${text("canvas.narrowText", { width: MIN_EDITOR_WIDTH })}
    </p>
    <button
      class="text-button primary"
      data-place=${place("controls")}
      type="button"
      @click=${openPreview}
    >
      ${ICONS.preview}<span>${text("canvas.narrowPreview")}</span>
    </button>
  </div>
`;

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
  const selected = block.id === api.selectedBlock?.block.id;
  const rich = hasRichText(block);
  const type = blockTypeName(block.type, text);
  return html`
    <div
      aria-current=${selected ? "true" : nothing}
      aria-describedby=${rich ? "block-keys" : "block-keys-no-text"}
      aria-label=${text("canvas.block", { ...where, type })}
      class="block"
      data-block-id=${block.id}
      data-label=${type}
      data-place=${place("block")}
      role="group"
      style=${styleProperties(rich ? blockStyles(block) : {})}
      tabindex=${isTabStop ? "0" : "-1"}
      @focus=${() => events.onBlockFocus(block.id)}
      @focusout=${events.onBlockFocusout}
    >
      ${renderDragHandle(text("canvas.dragBlock"))}
      ${rich ? state.textOf(block.id) : nothing}
      ${renderBlockContent(block, {
        failedImages: state.failedImages,
        lang: state.emailLang,
        onImageError: events.onImageError,
        socialIconsUrl: state.socialIconsUrl,
        text,
        uploading: state.isUploading(block.id),
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
  { blocks, id, width }: Column,
  /** Where the Column is, as `columnPlace` gives it. */
  where: TextValues,
  /** The Block that's the email's one stop for Tab, if any. */
  tabStop: string | undefined,
  /** Its Row's, when the Row has no Blocks at all. */
  emptyRowId: string | undefined,
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
      (block, blockIndex) => html`
        ${renderBlock(
          block,
          { ...where, ...placeIn(blockIndex, blocks.length) },
          block.id === tabStop,
          api,
          state,
          events
        )}
        ${renderInsertPoint({ columnId: id, index: blockIndex + 1 }, api)}
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
`;

/** As in the export, and for what's dragged out of it, which has no Row behind it. */
const rowLook = (row: Row) => {
  const styles = rowStyles(row);
  return { ...styles, "--_mq-row-background": styles["background-color"] };
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
  const tabStop =
    api.selectedBlock?.block.id ??
    (api.selectedRow ? undefined : blocksIn(api.email)[0]?.id);
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
          ${api.text("canvas.rowTag")}${
            (row.props as RowProps).hideOnPhone === true
              ? html`<span data-tooltip=${api.text("canvas.hiddenOnPhones")}
                  >${ICONS.phoneOff}</span
                >`
              : nothing
          }
        </div>
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
    `
  );
};

/**
 * Away from the Selection bar and the Add panel, so it never covers them.
 * Undo and redo are in the top bar; the Preview stays here until Check takes
 * its place.
 */
export const renderFloatingToolbar = ({ openPreview, text }: PanelApi) => html`
  <div
    aria-label=${text("canvas.emailTools")}
    class="ui bar floating-toolbar"
    data-place=${place("emailTools")}
    role="group"
    tabindex="-1"
  >
    <button
      aria-label=${text("canvas.preview")}
      class="icon-button"
      data-tooltip=${text("canvas.preview")}
      type="button"
      @click=${openPreview}
    >
      ${ICONS.preview}
    </button>
  </div>
`;
