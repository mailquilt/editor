import { BLOCK_TYPES } from "@mailquilt/core";
import type { Block, Column, Row } from "@mailquilt/core";
import { blockLabel, blockStyles, rowStyles } from "@mailquilt/core/internal";
import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { hasRichText, renderBlockContent } from "./block-content.js";
import { renderFormatBar } from "./format-bar.js";
import type { FormatBarEvents, FormatBarState } from "./format-bar.js";
import { blockIcon, ICONS } from "./icons.js";
import {
  MOVE_BUTTONS,
  REDO_KEYS,
  REDO_SHORTCUTS,
  ROW_MOVE_BUTTONS,
  UNDO_KEYS,
  UNDO_SHORTCUTS,
} from "./key-map.js";
import type { Direction } from "./key-map.js";
import { columnLabel, positionLabel } from "./places.js";
import { UI_LANG } from "./theme.js";

/** Narrower than this, there's no room to edit, and a notice shows instead. */
export const MIN_EDITOR_WIDTH = 640;

export interface CanvasState {
  editingText: boolean;
  /** On each Block's content. With none set, it's unknown, as in the export. */
  emailLang: string;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  failedImages: ReadonlySet<string>;
  formatBar: FormatBarState;
  selectedBlockId: string | undefined;
  selectedRowId: string | undefined;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => HTMLElement | undefined;
}

export interface CanvasEvents {
  formatBar: FormatBarEvents;
  onAddBlock: (
    blockType: string,
    place: { columnId: string; index: number }
  ) => void;
  onBlockClick: (event: MouseEvent) => void;
  onBlockFocus: (event: FocusEvent, blockId: string) => void;
  onBlockFocusout: () => void;
  onControlMousedown: (event: MouseEvent) => void;
  onDeleteRow: (rowId: string, fromKeyboard: boolean) => void;
  onDeleteSelectedBlock: (fromKeyboard: boolean) => void;
  onHandleMousedown: (event: MouseEvent) => void;
  onImageError: (src: string) => void;
  onMoveRow: (rowId: string, direction: "down" | "up") => void;
  onMoveSelectedBlock: (direction: Direction) => void;
  onOpenPreview: (event: Event) => void;
  onSelectRow: (rowId: string) => void;
  onStepHistory: (step: "redo" | "undo") => void;
}

/** Only a pointer drags, so this isn't offered to assistive technology. */
const renderDragHandle = (
  onMousedown: (event: MouseEvent) => void,
  tooltip = "Drag Block"
) => html`
  <div
    aria-hidden="true"
    class="drag-handle"
    data-tooltip=${tooltip}
    @mousedown=${onMousedown}
  >
    ${ICONS.grip}
  </div>
`;

/**
 * On a phone there's no room for the canvas and the side panel. The editor
 * stays as it is, so nothing is lost, and the email can still be previewed.
 */
export const renderNarrowNotice = (
  onOpenPreview: (event: Event) => void
) => html`
  <div class="ui frame narrow-notice" lang=${UI_LANG} part="frame">
    <span class="notice-icon">${ICONS.monitor}</span>
    <p class="notice-title">Editing needs more room</p>
    <p class="notice-body">
      Make the editor at least ${MIN_EDITOR_WIDTH}px wide, such as by widening
      the window, to change this email. You can still preview it here.
    </p>
    <button class="text-button primary" type="button" @click=${onOpenPreview}>
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
  state: CanvasState,
  events: CanvasEvents
) => html`
  <div
    aria-current=${row.id === state.selectedRowId ? "true" : nothing}
    aria-label=${`Row ${index + 1}`}
    aria-orientation="vertical"
    class="ui row-toolbar"
    role="toolbar"
    @mousedown=${events.onControlMousedown}
  >
    <div class="bar">
      ${renderDragHandle(events.onHandleMousedown, "Drag Row")}
      <button
        aria-label="Select Row"
        class="icon-button"
        ?data-active=${row.id === state.selectedRowId}
        data-action="select-row"
        data-tooltip="Select Row"
        type="button"
        @click=${() => events.onSelectRow(row.id)}
      >
        ${ICONS.select}
      </button>
      ${ROW_MOVE_BUTTONS.map(
        ({ direction, keys, shortcut }) => html`
          <button
            aria-keyshortcuts=${shortcut}
            aria-label=${`Move Row ${direction}`}
            class="icon-button"
            data-tooltip=${`Move Row ${direction} (${keys})`}
            ?disabled=${direction === "up" ? index === 0 : index === count - 1}
            tabindex="-1"
            type="button"
            @click=${() => events.onMoveRow(row.id, direction)}
          >
            ${ICONS[direction]}
          </button>
        `
      )}
      <button
        aria-label="Delete Row"
        class="icon-button danger"
        data-tooltip="Delete Row"
        tabindex="-1"
        type="button"
        @click=${({ detail }: MouseEvent) =>
          events.onDeleteRow(row.id, detail === 0)}
      >
        ${ICONS.delete}
      </button>
    </div>
  </div>
`;

/** The selected Block's tools. One stop for Tab, then arrow keys go along. */
const renderBlockToolbar = (events: CanvasEvents) => html`
  <div
    aria-label="Block tools"
    aria-orientation="vertical"
    class="ui bar block-toolbar"
    role="toolbar"
    @mousedown=${events.onControlMousedown}
  >
    ${renderDragHandle(events.onHandleMousedown)}
    <span class="separator"></span>
    ${MOVE_BUTTONS.map(
      ({ direction, keys, shortcut }, index) => html`
        <button
          aria-keyshortcuts=${shortcut}
          aria-label=${`Move Block ${direction}`}
          class="icon-button"
          data-action=${`move-${direction}`}
          data-tooltip=${`Move Block ${direction} (${keys})`}
          tabindex=${index === 0 ? "0" : "-1"}
          type="button"
          @click=${() => events.onMoveSelectedBlock(direction)}
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
      @click=${({ detail }: MouseEvent) =>
        events.onDeleteSelectedBlock(detail === 0)}
    >
      ${ICONS.delete}
    </button>
  </div>
`;

const renderBlock = (
  block: Block,
  place: string,
  state: CanvasState,
  events: CanvasEvents
) => {
  const selected = block.id === state.selectedBlockId;
  const rich = hasRichText(block);
  return html`
    <div
      aria-current=${selected ? "true" : nothing}
      aria-describedby=${rich ? "block-keys" : "block-keys-no-text"}
      aria-label=${`${blockLabel(block.type)} Block, ${place}`}
      class="block"
      data-block-id=${block.id}
      data-label=${blockLabel(block.type)}
      role="group"
      style=${styleMap(rich ? blockStyles(block) : {})}
      tabindex="0"
      @click=${events.onBlockClick}
      @focus=${(event: FocusEvent) => events.onBlockFocus(event, block.id)}
      @focusout=${events.onBlockFocusout}
    >
      ${selected ? nothing : renderDragHandle(events.onHandleMousedown)}
      ${rich ? state.textOf(block.id) : nothing}
      ${renderBlockContent(
        block,
        state.emailLang,
        state.failedImages,
        events.onImageError
      )}
      ${selected ? renderBlockToolbar(events) : nothing}
      ${
        selected && rich && state.editingText
          ? renderFormatBar(state.formatBar, events.formatBar)
          : nothing
      }
    </div>
  `;
};

const renderColumn = (
  { blocks, id, width }: Column,
  place: string,
  state: CanvasState,
  events: CanvasEvents
) => html`
  <div
    class=${blocks.length === 0 ? "column empty" : "column"}
    data-column-id=${id}
    style=${styleMap({ width: `${width}%` })}
  >
    ${repeat(
      blocks,
      (block) => block.id,
      (block, blockIndex) =>
        renderBlock(
          block,
          `${place}, ${positionLabel(blockIndex, blocks.length)}`,
          state,
          events
        )
    )}
    ${
      blocks.length === 0
        ? html`
            <div class="ui placeholder">
              <div class="placeholder-label">
                <span class="placeholder-icon">${ICONS.plus}</span>
                <p>Drop a Block here</p>
              </div>
              <div class="add-blocks">
                ${BLOCK_TYPES.map(
                  ({ label, type }) => html`
                    <button
                      aria-label=${`Add ${label} Block here, ${place}`}
                      class="icon-button"
                      data-tooltip=${`Add ${label} Block here`}
                      type="button"
                      @click=${() =>
                        events.onAddBlock(type, { columnId: id, index: 0 })}
                    >
                      ${blockIcon(type)}
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
  rows: Row[],
  state: CanvasState,
  events: CanvasEvents
) =>
  repeat(
    rows,
    (row) => row.id,
    (row, rowIndex) => html`
      <div
        class="row-frame"
        data-row-id=${row.id}
        ?data-row-selected=${row.id === state.selectedRowId}
      >
        <div
          aria-hidden="true"
          class="ui row-tag"
          @click=${() => events.onSelectRow(row.id)}
          @mousedown=${events.onHandleMousedown}
        >
          Row
        </div>
        ${renderRowToolbar(row, rowIndex, rows.length, state, events)}
        <div class="row" style=${styleMap(rowLook(row))}>
          ${repeat(
            row.columns,
            (column) => column.id,
            (column, columnIndex) =>
              renderColumn(
                column,
                columnLabel(rowIndex, columnIndex),
                state,
                events
              )
          )}
        </div>
      </div>
    `
  );

/** Away from the side panel, so it never covers the settings. */
export const renderFloatingToolbar = (events: CanvasEvents) => html`
  <div
    aria-label="Email tools"
    class="ui bar floating-toolbar"
    role="group"
    tabindex="-1"
    @mousedown=${events.onControlMousedown}
  >
    <button
      aria-keyshortcuts=${UNDO_SHORTCUTS}
      aria-label="Undo"
      class="icon-button"
      data-tooltip=${`Undo (${UNDO_KEYS})`}
      type="button"
      @click=${() => events.onStepHistory("undo")}
    >
      ${ICONS.undo}
    </button>
    <button
      aria-keyshortcuts=${REDO_SHORTCUTS}
      aria-label="Redo"
      class="icon-button"
      data-tooltip=${`Redo (${REDO_KEYS})`}
      type="button"
      @click=${() => events.onStepHistory("redo")}
    >
      ${ICONS.redo}
    </button>
    <span class="separator"></span>
    <button
      aria-label="Preview"
      class="icon-button"
      data-tooltip="Preview"
      type="button"
      @click=${events.onOpenPreview}
    >
      ${ICONS.preview}
    </button>
  </div>
`;
