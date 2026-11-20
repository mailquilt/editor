import { BLOCK_TYPES } from "@mailquilt/core";
import type { Block, Column, Row } from "@mailquilt/core";
import { blockLabel, blockStyles, rowStyles } from "@mailquilt/core/internal";
import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { BLOCK_VIEWS, hasRichText, renderBlockContent } from "./block-types.js";
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
    data-place="dragHandle"
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
    data-place="notice"
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
      data-place="controls"
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
    data-place="rowToolbar"
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
        @click=${() => api.selectRow(row.id)}
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
    data-place="blockToolbar"
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
      data-place="block"
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
      ${renderBlockContent(
        block,
        state.emailLang,
        state.failedImages,
        events.onImageError
      )}
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
    data-place="column"
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
        data-place="row"
        data-row-id=${row.id}
        data-testid="row-frame"
        ?data-row-selected=${row.id === api.selectedRow?.row.id}
      >
        <div
          aria-hidden="true"
          class="ui row-tag"
          data-place="rowTag"
          data-testid="row-tag"
          @click=${() => api.selectRow(row.id)}
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
    data-place="emailTools"
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
