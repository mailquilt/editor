import { BLOCK_TYPES, ROW_LAYOUTS } from "@mailquilt/core";
import type { BlockType, RowLayout } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import { live } from "lit/directives/live.js";

import { BLOCK_VIEWS } from "./block-types.js";
import { closestPlace, findPlace, findPlaces, place } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import { ICONS } from "./icons.js";
import { keyLabel } from "./key-map.js";
import type { PanelApi } from "./panel-api.js";
import { locate } from "./positions.js";
import type { OfferedSavedRow } from "./saved-rows.js";
import { renderThumbnail } from "./selection-bar.js";
import { renderSheet, renderSheetHead } from "./sheet.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { Text } from "./text.js";

/**
 * Adding a Block where the person is working: the Add panel, opened from the
 * email's bar or with `/`, and the picker that opens at a place on the Canvas,
 * from the + between two Blocks or an empty Column's button.
 */

/** Where in a Column what's picked goes. */
export interface AddPlace {
  columnId: string;
  index: number;
  /**
   * The Block it goes after, which it follows if the Block moves, or else
   * none, in an empty Column.
   */
  afterBlockId?: string;
}

export interface AddingState {
  /** The Add panel while it's open, with what's typed in its search. */
  panel: { query: string } | undefined;
  /** The picker while it's open, where it adds, and what's typed in its search. */
  picker: { at: AddPlace; query: string } | undefined;
}

interface AddingHost {
  focus: Pick<EditorFocus, "current" | "focusWhenRendered">;
  requestUpdate: () => void;
  /**
   * What's selected, which the Add panel gives focus back to: a Block, or a
   * Row, by the Selection bar's chip, as its Blocks aren't stops for Tab.
   */
  selected: () => "block" | "row" | undefined;
}

export const createAdding = ({
  focus,
  requestUpdate,
  selected,
}: AddingHost) => {
  let panel: AddingState["panel"];
  let picker: AddingState["picker"];
  /** Where focus was when the panel or the picker opened, to go back to. */
  let panelOpenedFrom: ReturnType<EditorFocus["current"]>;
  let pickerOpenedFrom: ReturnType<EditorFocus["current"]>;

  const closePicker = (returnFocus: boolean) => {
    if (!picker) {
      return;
    }
    picker = undefined;
    if (returnFocus && pickerOpenedFrom) {
      focus.focusWhenRendered(pickerOpenedFrom);
    }
    requestUpdate();
  };

  return {
    /**
     * Closes the panel. Focus goes to what's selected, which may be what it
     * added, or with nothing selected, back where it was when it opened.
     */
    closePanel(returnFocus: boolean) {
      if (!panel) {
        return;
      }
      panel = undefined;
      const to = {
        block: { on: "block" } as const,
        none: panelOpenedFrom,
        row: { action: "chip", on: "bar" } as const,
      }[selected() ?? "none"];
      if (returnFocus && to) {
        focus.focusWhenRendered(to);
      }
      requestUpdate();
    },

    closePicker,

    /** The picker closes once focus leaves it for anywhere else. */
    onFocusout({ relatedTarget }: FocusEvent) {
      if (
        picker &&
        relatedTarget instanceof Element &&
        !closestPlace(relatedTarget, "addPicker")
      ) {
        closePicker(false);
      }
    },

    /** A press anywhere but the picker closes it. */
    onPointerdown({ target }: PointerEvent) {
      if (
        picker &&
        !(target instanceof Element && closestPlace(target, "addPicker"))
      ) {
        closePicker(false);
      }
    },

    /**
     * Opens the panel, or with it open, goes back to its search. On a phone,
     * a touch leaves the search alone, or the keyboard would cover the sheet.
     */
    openPanel(fromKeyboard: boolean, toSearch = true) {
      if (!panel) {
        const from = focus.current();
        // From the picker, which closes, back where the picker came from.
        panelOpenedFrom =
          from?.on === "adding" && from.in === "addPicker"
            ? pickerOpenedFrom
            : from;
        panel = { query: "" };
      }
      closePicker(false);
      requestUpdate();
      if (toSearch) {
        focus.focusWhenRendered(
          { in: "addPanel", on: "adding" },
          { focusVisible: fromKeyboard }
        );
      }
    },

    /** Opens the picker at a place, with focus in it. */
    openPicker(at: AddPlace, fromKeyboard: boolean) {
      pickerOpenedFrom = focus.current();
      picker = { at, query: "" };
      focus.focusWhenRendered(
        { in: "addPicker", on: "adding" },
        { focusVisible: fromKeyboard }
      );
    },

    /** What's typed in the open panel's or picker's search. */
    search(where: "panel" | "picker", query: string) {
      if (where === "panel" && panel) {
        panel = { query };
      } else if (where === "picker" && picker) {
        picker = { ...picker, query };
      }
      requestUpdate();
    },

    get state(): AddingState {
      return { panel, picker };
    },

    /**
     * Before an update, with each Column's Blocks by ID: the picker follows
     * the Block it adds after, and closes once its place is gone, as an undo
     * or a new email can take it away. A place after a Block needs that Block
     * still in the Column, and an empty Column's needs the Column still empty.
     */
    beforeUpdate(blocksByColumn: ReadonlyMap<string, readonly string[]>) {
      if (!picker) {
        return;
      }
      const { afterBlockId, columnId } = picker.at;
      const blockIds = blocksByColumn.get(columnId);
      if (blockIds === undefined) {
        picker = undefined;
      } else if (afterBlockId === undefined) {
        if (blockIds.length > 0) {
          picker = undefined;
        }
      } else {
        const after = blockIds.indexOf(afterBlockId);
        picker =
          after === -1
            ? undefined
            : { ...picker, at: { ...picker.at, index: after + 1 } };
      }
    },
  };
};

export const addingStyles = css`
  /*
   * The Add panel, at the Canvas's start. It docks beside the email where
   * both fit, and otherwise floats over the Canvas's edge.
   */
  .add-dock {
    background: var(--mq-color-surface);
    border-inline-end: 1px solid var(--mq-color-border);
    flex: 0 0 var(--_mq-add-width);
    min-width: 0;
  }

  .add-dock.floating {
    box-shadow: var(--mq-shadow);
    inset-block: 0;
    inset-inline-start: 0;
    position: absolute;
    width: var(--_mq-add-width);
    z-index: var(--_mq-layer-selection-bar);
  }

  .add-panel {
    background: var(--mq-color-surface);
    display: flex;
    flex-direction: column;
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  .add-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: var(--mq-space-3) var(--mq-space-2) var(--mq-space-2)
      var(--mq-space-4);
  }

  .add-title {
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .add-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--mq-space-4) var(--mq-space-4);
  }

  /* A field with its icon inside, and in the panel, the key that opens it. */
  .add-search {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    display: flex;
    gap: var(--mq-space-2);
    height: 36px;
    padding: 0 var(--mq-space-2) 0 var(--mq-space-3);
  }

  .add-search:focus-within {
    border-color: var(--mq-color-accent);
    box-shadow: 0 0 0 1px var(--mq-color-accent);
  }

  .add-search input {
    background: none;
    border: 0;
    color: var(--mq-color-text);
    flex: 1;
    font: inherit;
    min-width: 0;
    outline: none;
    padding: 0;
  }

  .add-search input::placeholder {
    color: var(--mq-color-text-muted);
  }

  .ui .add-search input:focus-visible {
    outline: none;
  }

  .add-search kbd {
    border-radius: var(--mq-radius-small);
    box-shadow: inset 0 0 0 1px var(--mq-color-border-strong);
    font: 500 var(--mq-font-size-small) / 1 var(--mq-font-family);
    padding: 3px 7px;
  }

  .add-section-title {
    font-size: var(--mq-font-size-small);
    font-weight: 600;
    margin: var(--mq-space-4) 0 var(--mq-space-2);
  }

  /* The tiles: a Block's icon and name, or a layout's picture. */
  .add-tiles {
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .add-tiles.layouts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .add-picker .add-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* In a Column, as many as fit, each its icon and name alone. */
  .add-picker.in-column .add-tiles {
    gap: 2px;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  }

  .add-picker.in-column .add-tile {
    box-shadow: none;
    gap: var(--mq-space-1);
    min-height: 48px;
  }

  .add-tile {
    align-items: center;
    background: var(--mq-color-surface);
    border: 0;
    border-radius: var(--mq-radius);
    box-shadow: inset 0 0 0 1px var(--mq-color-border);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: 500 var(--mq-font-size-small) / 1.2 var(--mq-font-family);
    gap: var(--mq-space-2);
    justify-content: center;
    min-height: 58px;
    min-width: 0;
    outline: 1px solid transparent;
    outline-offset: -1px;
    padding: var(--mq-space-2) var(--mq-space-1);
    transition:
      background-color 120ms,
      box-shadow 120ms,
      scale 100ms;
    -webkit-user-select: none;
    user-select: none;
  }

  .add-tile .icon {
    color: var(--mq-color-text);
    height: 18px;
    width: 18px;
  }

  .add-tile:hover {
    background: var(--mq-color-surface-hover);
    box-shadow: inset 0 0 0 1px var(--mq-color-border-strong);
    color: var(--mq-color-text);
  }

  /* In the panel, a press may be a drag, which keeps the tile still. */
  .add-picker .add-tile:active {
    scale: 0.97;
  }

  /* What a drag picks up, in the panel. */
  .add-panel .add-tile {
    cursor: grab;
    /*
     * A touch that goes up or down scrolls the panel, and one that goes
     * sideways, towards the email, drags the tile.
     */
    touch-action: pan-y;
  }

  .add-panel .add-tile:active {
    cursor: grabbing;
  }

  .add-tiles.layouts .add-tile {
    min-height: 44px;
    padding: var(--mq-space-2);
  }

  .add-tile .thumbnail {
    height: 20px;
    width: 100%;
  }

  /* A layout is told apart by its Columns' edges alone, so they're at 3:1. */
  .add-tile .thumbnail > span {
    border-color: var(--mq-color-border-strong);
  }

  .add-tile:hover .thumbnail > span {
    background: var(--mq-color-accent-soft);
    border-color: var(--mq-color-accent);
  }

  /* "Saved Rows" and how many, at the end. */
  .saved-rows-title {
    display: flex;
    justify-content: space-between;
  }

  .saved-rows-count {
    color: var(--mq-color-text-muted);
    font-weight: 500;
  }

  /* A Saved Row: the top of its picture, and its name under it. */
  .add-tiles.saved-rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .add-tiles.saved-rows .add-tile {
    align-items: stretch;
    color: var(--mq-color-text);
    gap: 0;
    justify-content: start;
    padding: var(--mq-space-1);
    text-align: start;
  }

  .saved-row-picture {
    aspect-ratio: 16 / 9;
    border-radius: var(--mq-radius-small);
    display: block;
    overflow: hidden;
    position: relative;
  }

  .saved-row-picture .rows-picture {
    inset: 0 auto auto 0;
    position: absolute;
  }

  /* A long word, such as a German name, wraps rather than leaving the card. */
  .saved-row-name {
    font-weight: 400;
    overflow-wrap: anywhere;
    padding: var(--mq-space-2) var(--mq-space-1) var(--mq-space-1);
  }

  .add-none {
    margin: var(--mq-space-5) 0 var(--mq-space-4);
    text-align: center;
  }

  .add-none p {
    margin: 0;
  }

  .add-none p + p {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin-block-start: 2px;
  }

  /*
   * The picker, under the place it adds to: centred on the + between two
   * Blocks, or over an empty Column's button.
   */
  .add-picker {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-text);
    display: flex;
    flex-direction: column;
    font: var(--mq-font-size) / 1.4 var(--mq-font-family);
    gap: var(--mq-space-2);
    inset-inline-start: 50%;
    padding: var(--mq-space-2);
    position: absolute;
    top: 18px;
    /* Moved back inside the Canvas by tool-fitting.ts, where it would reach past it. */
    translate: calc(-50% + var(--_mq-picker-shift, 0px))
      var(--_mq-picker-lift, 0px);
    width: 336px;
    z-index: var(--_mq-layer-block-tools);
  }

  /*
   * In an empty Column, in place of its button, so the Column grows to hold
   * it, as frame e05 draws it. The button comes back as it closes.
   */
  .add-picker.in-column {
    flex: 1;
    position: static;
    translate: none;
    width: auto;
  }

  .add-picker-foot {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: 0;
    padding: 2px var(--mq-space-1) 0;
  }

  /*
   * After each Block, a line across the Column with a + in its middle, which
   * opens the picker. It shows once the pointer has rested at the edge
   * between two Blocks, and until then takes no presses, so the text, a
   * thin Spacer and a handle at that edge keep theirs.
   */
  .insert-point {
    display: block;
    height: 0;
    position: relative;
  }

  .insert-zone {
    align-items: center;
    display: flex;
    height: 24px;
    inset-inline: 0;
    justify-content: center;
    pointer-events: none;
    position: absolute;
    top: -12px;
  }

  .insert-zone::before {
    background: var(--mq-color-accent);
    content: "";
    height: 2px;
    inset-inline: 0;
    position: absolute;
    top: 11px;
  }

  .insert-zone::before,
  .insert-button {
    opacity: 0;
    transition: opacity 120ms;
    visibility: hidden;
  }

  .insert-point[data-shown] .insert-zone::before,
  .insert-point[data-shown] .insert-button,
  .insert-point[data-open] .insert-zone::before,
  .insert-point[data-open] .insert-button {
    opacity: 1;
    visibility: visible;
  }

  /* Over the Blocks around it once it shows. */
  .insert-button {
    pointer-events: auto;
    z-index: var(--_mq-layer-handle);
  }

  /* The picker, once open, is over the tools of the Blocks below it. */
  .insert-point > .add-picker {
    z-index: var(--_mq-layer-block-tools);
  }

  .insert-button {
    align-items: center;
    background: var(--mq-color-accent);
    border-radius: 50%;
    color: var(--mq-color-on-accent);
    cursor: pointer;
    display: flex;
    height: 24px;
    justify-content: center;
    position: relative;
    transition:
      opacity 120ms,
      scale 100ms;
    width: 24px;
  }

  .insert-button:active {
    scale: 0.97;
  }

  .insert-button .icon {
    height: 14px;
    width: 14px;
  }

  /* While anything is dragged, the drop line shows where it goes instead. */
  .email[data-dragging] .insert-point {
    display: none;
  }

  /*
   * Forced colors drop the line's background and the button's, which are all
   * they're drawn with.
   */
  @media (forced-colors: active) {
    .insert-zone::before,
    .insert-button {
      background: CanvasText;
      color: Canvas;
      forced-color-adjust: none;
    }
  }
`;

/** Whether `name` has what's typed in it, ignoring case and the ends' spaces. */
const isMatch = (name: string, query: string) =>
  name.toLowerCase().includes(query.trim().toLowerCase());

const blocksMatching = (query: string, text: Text) =>
  BLOCK_TYPES.filter(({ type }) => isMatch(blockTypeName(type, text), query));

/** Every Saved Row for "Saved Rows" or a word of it, or one's own name. */
const savedRowsMatching = (
  saved: readonly OfferedSavedRow[],
  query: string,
  text: Text
) =>
  isMatch(text("add.savedRows"), query)
    ? saved
    : saved.filter(({ name }) => isMatch(name, query));

/** Every layout for "Empty Rows" or a word of it, or a layout's own name. */
const layoutsMatching = (query: string, text: Text) =>
  isMatch(text("add.emptyRows"), query)
    ? ROW_LAYOUTS
    : ROW_LAYOUTS.filter((layout) => isMatch(layout, query));

/** The search at the top of the panel or the picker. */
const renderSearch = (
  where: "panel" | "picker",
  query: string,
  api: PanelApi
) => {
  const { text } = api;
  const label = text(where === "panel" ? "add.searchAll" : "add.searchBlocks");
  const keys = keyLabel("block", "openAddPanel");
  return html`
    <label class="add-search">
      ${ICONS.search}
      <input
        aria-label=${label}
        autocomplete="off"
        data-place=${place("addSearch")}
        placeholder=${label}
        spellcheck="false"
        type="text"
        .value=${live(query)}
        @input=${({ target }: InputEvent) =>
          api.searchAdd(where, (target as HTMLInputElement).value)}
      />
      ${
        where === "panel"
          ? html`<kbd aria-hidden="true">${keys.keys}</kbd>`
          : nothing
      }
    </label>
  `;
};

/**
 * Buttons for Block types, one stop for Tab with arrow keys between them. In
 * the panel, each is also what a drag picks up.
 */
const renderBlockTiles = (
  types: readonly { type: BlockType }[],
  draggable: boolean,
  onPick: (type: BlockType, fromKeyboard: boolean) => void,
  text: Text
) => html`
  <div
    aria-label=${text("add.blocks")}
    class="add-tiles"
    data-place=${place("addTiles")}
    role="group"
  >
    ${types.map(
      ({ type }, index) => html`
        <button
          aria-label=${text("add.addBlock", {
            type: blockTypeName(type, text),
          })}
          class="add-tile"
          data-block-type=${type}
          data-place=${draggable ? place("paletteItem") : nothing}
          tabindex=${index === 0 ? "0" : "-1"}
          type="button"
          @click=${({ detail }: MouseEvent) => onPick(type, detail === 0)}
        >
          ${BLOCK_VIEWS[type].icon}<span>${blockTypeName(type, text)}</span>
        </button>
      `
    )}
  </div>
`;

/**
 * The Host app's Saved Rows, under their title and how many: one stop for Tab,
 * with arrow keys between them, each a picture of its top and its name, which
 * is all it's named by, as the picture's words are on screen too. In the
 * Add panel, each is also what a drag picks up, by its place in `api.savedRows`.
 */
export const renderSavedRows = (
  api: PanelApi,
  shown: readonly OfferedSavedRow[],
  inPanel: boolean
) => {
  const { text } = api;
  const { backgroundColor, width } = api.email.settings;
  const positions = new Map(
    api.savedRows.map((saved, index) => [saved, index])
  );
  return html`
    <h3 class="add-section-title saved-rows-title">
      <span>${text("add.savedRows")}</span>
      <span aria-hidden="true" class="saved-rows-count">${shown.length}</span>
    </h3>
    <div
      aria-label=${text("add.savedRows")}
      class="add-tiles saved-rows"
      data-place=${inPanel ? place("addTiles") : nothing}
      role="group"
    >
      ${shown.map(
        (saved, index) => html`
          <button
            class="add-tile"
            data-place=${inPanel ? place("paletteItem") : nothing}
            data-saved-row=${positions.get(saved)}
            data-testid="saved-row"
            tabindex=${index === 0 ? "0" : "-1"}
            type="button"
            @click=${({ detail }: MouseEvent) =>
              api.addSavedRow(saved, detail === 0)}
          >
            <span
              aria-hidden="true"
              class="saved-row-picture"
              data-email-width=${width}
              data-place=${place("emailPicture")}
              style=${styleProperties({ "background-color": backgroundColor })}
            >
              ${api.savedRowPicture(saved)}
            </span>
            <span class="saved-row-name">${saved.name}</span>
          </button>
        `
      )}
    </div>
  `;
};

/** What a screen reader hears when nothing matches the search. */
const noMatchWords = (
  query: string,
  id: "add.noBlock" | "add.nothing",
  text: Text
) => `${text(id, { query: query.trim() })} ${text("add.try")}`;

/**
 * A live region there from the panel's or picker's first render, apart from
 * the editor's one status for its changes, so a screen
 * reader hears the words put in it later, as it may not hear a status that
 * arrives with its words.
 */
const renderSaid = (words: string) =>
  html`<p aria-live="polite" class="visually-hidden">${words}</p>`;

const renderNoMatch = (
  query: string,
  id: "add.noBlock" | "add.nothing",
  text: Text
) => html`
  <div class="add-none">
    <p>${text(id, { query: query.trim() })}</p>
    <p>${text("add.try")}</p>
  </div>
`;

/**
 * The Add panel: every Block type and every empty Row's layout, to add after
 * what's selected with a click or Enter, or to drag onto the email.
 */
export const renderAddPanel = (api: PanelApi, docked: boolean) => {
  const { text } = api;
  const query = api.adding.panel?.query ?? "";
  const blocks = blocksMatching(query, text);
  const layouts = layoutsMatching(query, text);
  const saved = savedRowsMatching(api.savedRows, query, text);
  const nothingMatches =
    blocks.length === 0 && layouts.length === 0 && saved.length === 0;
  const body = html`
    ${renderSearch("panel", query, api)}
    ${
      blocks.length > 0
        ? html`
            <h3 class="add-section-title">${text("add.blocks")}</h3>
            ${renderBlockTiles(
              blocks,
              true,
              (type) => api.addBlock(type),
              text
            )}
          `
        : nothing
    }
    ${
      layouts.length > 0
        ? html`
            <h3 class="add-section-title">${text("add.emptyRows")}</h3>
            <div
              aria-label=${text("add.emptyRows")}
              class="add-tiles layouts"
              data-place=${place("addTiles")}
              role="group"
            >
              ${layouts.map(
                (layout: RowLayout, index) => html`
                  <button
                    aria-label=${text("add.addLayout", { layout })}
                    class="add-tile"
                    data-place=${place("paletteItem")}
                    data-row-layout=${layout}
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
          `
        : nothing
    }
    ${saved.length > 0 ? renderSavedRows(api, saved, true) : nothing}
    ${nothingMatches ? renderNoMatch(query, "add.nothing", text) : nothing}
    ${renderSaid(nothingMatches ? noMatchWords(query, "add.nothing", text) : "")}
  `;
  if (api.phone) {
    return renderSheet({
      body,
      className: "add-sheet",
      head: renderSheetHead(
        {
          done: () => api.closeAddPanel(true),
          title: text("add.panel"),
          titleId: "add-title",
        },
        text
      ),
      labelledBy: "add-title",
      onClose: () => api.closeAddPanel(true),
      sheetPlace: "addPanel",
      testId: "add-panel",
    });
  }
  return html`
    <div class=${docked ? "add-dock" : "add-dock floating"}>
      <section
        aria-label=${text("add.panel")}
        class="ui add-panel"
        data-place=${place("addPanel")}
        data-testid="add-panel"
      >
        <div class="add-head">
          <h2 class="add-title">${text("add.panel")}</h2>
          <button
            aria-label=${text("bar.close")}
            class="icon-button"
            data-tooltip=${text("bar.close")}
            type="button"
            @click=${() => api.closeAddPanel(true)}
          >
            ${ICONS.close}
          </button>
        </div>
        <div class="add-body thin-scrollbar">${body}</div>
      </section>
    </div>
  `;
};

/** The Block a place is just after, in its Column. */
const findBlockBefore = (api: PanelApi, { columnId, index }: AddPlace) =>
  api.email.rows
    .flatMap(({ columns }) => columns)
    .find(({ id }) => id === columnId)?.blocks[index - 1]?.id;

/**
 * The picker at a place on the Canvas. Between two Blocks it has a search,
 * and says where it adds; in an empty Column, where that's plain, only the
 * Block types.
 */
export const renderAddPicker = (api: PanelApi, inColumn: boolean) => {
  const { text } = api;
  const { picker } = api.adding;
  if (!picker) {
    return nothing;
  }
  const { at, query } = picker;
  const blocks = blocksMatching(query, text);
  const above = locate(api.email, findBlockBefore(api, at) ?? "");
  return html`
    <div
      aria-label=${text("add.here")}
      class=${inColumn ? "ui add-picker in-column" : "ui add-picker"}
      data-place=${place("addPicker")}
      data-testid="add-picker"
      role="dialog"
    >
      ${inColumn ? nothing : renderSearch("picker", query, api)}
      ${
        blocks.length > 0
          ? renderBlockTiles(
              blocks,
              false,
              (type) => api.addBlockAt(type, at),
              text
            )
          : renderNoMatch(query, "add.noBlock", text)
      }
      ${renderSaid(
        blocks.length === 0 ? noMatchWords(query, "add.noBlock", text) : ""
      )}
      ${
        above && !inColumn && blocks.length > 0
          ? html`<p class="add-picker-foot">
              ${text("add.below", {
                row: above.rowIndex + 1,
                type: blockTypeName(above.block.type, text),
              })}
            </p>`
          : nothing
      }
    </div>
  `;
};

/**
 * After a Block, the + that opens the picker there, for the pointer, as a
 * drag handle is: the keyboard adds with `/`. The picker opens in it.
 */
export const renderInsertPoint = (at: AddPlace, api: PanelApi) => {
  const open =
    api.adding.picker?.at.columnId === at.columnId &&
    api.adding.picker.at.index === at.index;
  return html`
    <div
      class="ui insert-point"
      data-place=${place("insertPoint")}
      data-testid="insert-point"
      ?data-open=${open}
    >
      <div aria-hidden="true" class="insert-zone" data-testid="insert-zone">
        <div
          class="insert-button"
          data-testid="insert-button"
          data-tooltip=${api.text("add.here")}
          @click=${() => api.openPicker(at, false)}
        >
          ${ICONS.plus}
        </div>
      </div>
      ${open ? renderAddPicker(api, false) : nothing}
    </div>
  `;
};

/** How near a Block's edge the pointer shows the + there. */
const EDGE_PX = 6;

/** How long the pointer rests at an edge before the + shows. */
const REST_MS = 200;

/**
 * The insert point that the pointer is at the edge of: after the Block whose
 * bottom it's near, or before the one whose top it's near, in the Column it's
 * over.
 */
const insertPointAt = (target: Element, y: number) => {
  const column = closestPlace(target, "column");
  if (!column) {
    return;
  }
  const blocks = findPlaces(column, "block");
  const points = findPlaces(column, "insertPoint");
  for (const [index, block] of blocks.entries()) {
    const { bottom, top } = block.getBoundingClientRect();
    if (Math.abs(y - bottom) <= EDGE_PX) {
      return points[index];
    }
    if (index > 0 && Math.abs(y - top) <= EDGE_PX) {
      return points[index - 1];
    }
  }
};

/**
 * Shows the + at the edge between two Blocks where a mouse rests, and hides
 * it once the mouse leaves. The + itself keeps it showing. A touch has no
 * hover, so it never shows for one.
 */
export const createInsertHover = (root: ShadowRoot) => {
  let shown: HTMLElement | undefined;
  let waiting: { point: HTMLElement; timer: number } | undefined;

  const show = (point: HTMLElement | undefined) => {
    if (point === shown) {
      return;
    }
    if (shown) {
      delete shown.dataset.shown;
    }
    shown = point;
    if (shown) {
      shown.dataset.shown = "";
    }
  };

  const wait = (point: HTMLElement | undefined) => {
    if (point === waiting?.point) {
      return;
    }
    if (waiting) {
      clearTimeout(waiting.timer);
    }
    waiting = point && {
      point,
      timer: window.setTimeout(() => {
        waiting = undefined;
        show(point);
      }, REST_MS),
    };
  };

  const onPointermove = (event: Event) => {
    const { clientY, pointerType, target } = event as PointerEvent;
    if (pointerType === "touch" || !(target instanceof Element)) {
      return;
    }
    // On the + that shows, it stays.
    const on = closestPlace(target, "insertPoint");
    if (on && on === shown) {
      wait(undefined);
      return;
    }
    const point = insertPointAt(target, clientY);
    if (point !== shown) {
      show(undefined);
    }
    wait(point === shown ? undefined : point);
  };

  const onPointerleave = () => {
    wait(undefined);
    show(undefined);
  };

  const listeners = new AbortController();
  root.addEventListener("pointermove", onPointermove, {
    signal: listeners.signal,
  });
  root.host.addEventListener("pointerleave", onPointerleave, {
    signal: listeners.signal,
  });
  return {
    destroy: () => {
      listeners.abort();
      onPointerleave();
    },
  };
};

/** Focus on the first tile of the panel or picker that `from` is in. */
export const focusFirstTile = (from: Element) => {
  const container = closestPlace(from, "addPanel", "addPicker");
  const tiles = container && findPlace(container, "addTiles");
  tiles?.querySelector<HTMLElement>("button")?.focus();
};

/** Picks the first tile of the panel or picker that `from` is in, as Enter on it. */
export const pickFirstTile = (from: Element) => {
  const container = closestPlace(from, "addPanel", "addPicker");
  const tiles = container && findPlace(container, "addTiles");
  tiles
    ?.querySelector<HTMLElement>("button")
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
};
