import { ROW_LAYOUTS } from "@mailquilt/core";
import type { Block, EmailStyle, Row } from "@mailquilt/core";
import { EMAIL_LOOK } from "@mailquilt/core/internal";
import type { RowProps } from "@mailquilt/core/internal";
import { css, html, nothing, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { DOMSerializer } from "prosemirror-model";

import {
  BLOCK_VIEWS,
  hasRichText,
  renderBlockContent,
  textBlockLook,
} from "./block-types.js";
import { rowLook } from "./canvas.js";
import { closestPlace, findPlaces, place } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import { ICONS } from "./icons.js";
import { keyLabel, keysInWords } from "./key-map.js";
import type { PanelApi } from "./panel-api.js";
import { renderThumbnail } from "./selection-bar.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";

/**
 * The Rows list, beside the Canvas in Edit: each Row as a small picture, to
 * select, drag or move with Alt+↑ and Alt+↓, and a + that adds an empty Row.
 * Collapsed, each Row is its number.
 */

/** The expanded list's width, and the collapsed one's. */
export const ROWS_LIST_WIDTH_PX = 232;
export const ROWS_LIST_COLLAPSED_WIDTH_PX = 52;

/**
 * A picture's width: the list's, less its sides and the Row's number. The
 * Row is drawn at the email's width and scaled down to it.
 */
const PICTURE_WIDTH_PX = 184;

export interface RowsListState {
  /**
   * Whether the person expanded the list, or collapsed it, once they have.
   * Until then, it's expanded where it fits, as the element decides.
   */
  expanded: boolean | undefined;
  /** Whether the + has its layouts open. */
  addOpen: boolean;
}

interface RowsListHost {
  focus: Pick<EditorFocus, "focusWhenRendered">;
  requestUpdate: () => void;
}

export type RowsList = ReturnType<typeof createRowsList>;

export const createRowsList = ({ focus, requestUpdate }: RowsListHost) => {
  let expanded: boolean | undefined;
  let addOpen = false;
  /**
   * Each text Block's picture, drawn again only once its text changes, and
   * kept in its place in the list, rather than drawn on every update.
   */
  // By its text as JSON, as each update's email is a new copy.
  const texts = new Map<string, { content: string; element: HTMLElement }>();

  const closeAdd = (returnFocus: boolean) => {
    if (!addOpen) {
      return;
    }
    addOpen = false;
    if (returnFocus) {
      focus.focusWhenRendered({ action: "add-row", on: "rowsList" });
    }
    requestUpdate();
  };

  return {
    closeAdd,

    /** A new email: its Blocks are another email's. */
    forget() {
      texts.clear();
      addOpen = false;
    },

    textPicture(block: Extract<Block, { type: "heading" | "text" }>) {
      const made = texts.get(block.id);
      const content = JSON.stringify(block.props.content);
      if (made?.content === content) {
        return made.element;
      }
      const element = drawText(block);
      texts.set(block.id, { content, element });
      return element;
    },

    /** The layouts close once focus leaves them and their +. */
    onFocusout({ relatedTarget }: FocusEvent) {
      if (
        addOpen &&
        relatedTarget instanceof Element &&
        !closestPlace(relatedTarget, "rowsAdd") &&
        (relatedTarget as HTMLElement).dataset.action !== "add-row"
      ) {
        closeAdd(false);
      }
    },

    /** A press anywhere but the layouts and their + closes them. */
    onPointerdown({ target }: PointerEvent) {
      if (
        addOpen &&
        target instanceof Element &&
        !closestPlace(target, "rowsAdd") &&
        target.closest<HTMLElement>("[data-action]")?.dataset.action !==
          "add-row"
      ) {
        closeAdd(false);
      }
    },

    /** Opens the layouts, with focus on the first, or closes them. */
    toggleAdd(fromKeyboard: boolean) {
      if (addOpen) {
        closeAdd(true);
        return;
      }
      addOpen = true;
      focus.focusWhenRendered(
        { action: "layout", on: "rowsList" },
        { focusVisible: fromKeyboard }
      );
    },

    /** Expands the list, or collapses it, and it stays so while the element lives. */
    toggleExpanded(isExpanded: boolean, fromKeyboard: boolean) {
      expanded = !isExpanded;
      addOpen = false;
      focus.focusWhenRendered(
        { action: "toggle-rows", on: "rowsList" },
        { focusVisible: fromKeyboard }
      );
    },

    get state(): RowsListState {
      return { addOpen, expanded };
    },
  };
};

/**
 * Sizes each picture's card to its Row as it's drawn, scaled down, and keeps
 * the current Row in view in the list. A ResizeObserver reports before the
 * page is painted, so a card is never drawn at a guessed height, and again as
 * the Row's images load.
 */
export const createRowPictures = (root: ShadowRoot) => {
  const observed = new Set<Element>();
  let shownRowId: string | undefined;
  // From the picture's own height and scale, as its box on screen also has
  // the scale of a Host app page that scales the editor.
  const sizes = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const card = target.parentElement;
      const scale = Number(getComputedStyle(target).scale);
      if (card && target instanceof HTMLElement) {
        card.style.height = `${target.offsetHeight * (Number.isFinite(scale) ? scale : 1)}px`;
      }
    }
  });
  return {
    destroy: () => sizes.disconnect(),

    /** After an update: new pictures, and the current Row if it changed. */
    sync() {
      // Not those gone with their Row, or a list collapsed, kept no longer.
      for (const picture of observed) {
        if (!picture.isConnected) {
          observed.delete(picture);
          sizes.unobserve(picture);
        }
      }
      for (const picture of findPlaces(root, "rowPicture")) {
        if (!observed.has(picture)) {
          observed.add(picture);
          sizes.observe(picture);
        }
      }
      const [items] = findPlaces(root, "rowsItems");
      const current = items?.querySelector<HTMLElement>(
        '[aria-current="true"]'
      );
      const rowId = current?.dataset.rowId;
      if (!(items && current) || rowId === shownRowId) {
        shownRowId = rowId;
        return;
      }
      shownRowId = rowId;
      // The list's own scroll, as scrolling the item into view would scroll
      // the page and the Shell too.
      const scroller = items.parentElement;
      if (scroller) {
        const view = scroller.getBoundingClientRect();
        const box = current.getBoundingClientRect();
        if (box.top < view.top) {
          scroller.scrollTop -= view.top - box.top;
        } else if (box.bottom > view.bottom) {
          scroller.scrollTop += box.bottom - view.bottom;
        }
      }
    },
  };
};

export const rowsListStyles = css`
  /* Beside the Canvas, its start. It stays in view as the page scrolls. */
  .rows-dock {
    background: var(--mq-color-surface);
    border-inline-end: 1px solid var(--mq-color-border);
    flex: 0 0 var(--_mq-rows-width);
    min-width: 0;
    position: relative;
  }

  .rows-list {
    background: var(--mq-color-surface);
    display: flex;
    flex-direction: column;
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  /* Expanded where it doesn't fit beside the email, over the Canvas's start. */
  .rows-dock.floating .rows-list {
    border-inline-end: 1px solid var(--mq-color-border);
    box-shadow: var(--mq-shadow);
    inset-inline-start: 0;
    position: absolute;
    top: 0;
    width: ${ROWS_LIST_WIDTH_PX}px;
  }

  /*
   * Over the Selection bar, which it reaches past: expanded over the Canvas,
   * and while the +'s layouts are open beside it. A sticky list holds its
   * layouts, so it's the list that goes over.
   */
  .rows-dock.floating .rows-list,
  .rows-list[data-adding] {
    z-index: var(--_mq-layer-top-bar);
  }

  .rows-dock.floating {
    flex-basis: ${ROWS_LIST_COLLAPSED_WIDTH_PX}px;
  }

  .rows-dock.floating .rows-list {
    max-height: none;
    min-height: 100%;
  }

  .rows-head {
    align-items: center;
    display: flex;
    gap: var(--mq-space-1);
    padding: var(--mq-space-3) var(--mq-space-2) var(--mq-space-2)
      var(--mq-space-2);
  }

  /* Open or not, it's a plain button, as the accent marks the current Row. */
  .rows-toggle[aria-expanded="true"]:not(:hover) {
    background: none;
    box-shadow: none;
    color: var(--mq-color-text-muted);
  }

  .rows-title {
    flex: 1;
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .rows-count {
    color: var(--mq-color-text-muted);
    font-weight: 500;
    margin-inline-start: var(--mq-space-1);
  }

  .rows-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .rows-items {
    display: grid;
    gap: var(--mq-space-2);
    padding: var(--mq-space-1) var(--mq-space-3) var(--mq-space-4);
    position: relative;
  }

  /* A Row: its number, and its picture. */
  .rows-item {
    align-items: start;
    background: none;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: grab;
    display: grid;
    font: 500 var(--_mq-font-size-tag) / 1 var(--mq-font-family);
    gap: var(--mq-space-2);
    grid-template-columns: 16px minmax(0, 1fr);
    padding: 0;
    position: relative;
    text-align: end;
    /* A touch that goes up or down scrolls the list, and one sideways drags. */
    touch-action: pan-y;
    -webkit-user-select: none;
    user-select: none;
  }

  .rows-item:active {
    cursor: grabbing;
  }

  .rows-number {
    font-variant-numeric: tabular-nums;
    padding-block-start: var(--mq-space-1);
  }

  /* The number's cell, which the grip covers without changing its height. */
  .rows-item > .rows-number,
  .rows-item > .rows-grip {
    grid-column: 1;
    grid-row: 1;
  }

  .rows-item[aria-current="true"] .rows-number {
    color: var(--mq-color-text);
    font-weight: 600;
  }

  /* Under the pointer, the grip that drags it takes the number's place. */
  .rows-grip {
    align-items: center;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    display: none;
    height: 24px;
    justify-content: center;
    position: absolute;
    width: 16px;
  }

  .rows-grip .icon {
    height: 14px;
    width: 14px;
  }

  @media (hover: hover) {
    .rows-item:hover .rows-number {
      visibility: hidden;
    }

    .rows-item:hover .rows-grip {
      display: flex;
    }
  }

  .rows-card {
    background: var(--_mq-email-background);
    border-radius: var(--mq-radius-small);
    box-shadow: 0 0 0 1px var(--mq-color-border);
    display: block;
    min-height: 18px;
    overflow: hidden;
    position: relative;
    transition: box-shadow 120ms;
  }

  .rows-item:hover .rows-card {
    box-shadow: 0 0 0 1px var(--mq-color-border-strong);
  }

  .rows-item[aria-current="true"] .rows-card {
    box-shadow:
      0 0 0 2px var(--mq-color-surface),
      0 0 0 4px var(--mq-color-accent);
  }

  /* The ring is the card's, so it's on the picture, not around the number. */
  .ui .rows-item:focus-visible {
    outline: none;
  }

  /*
   * Keyboard focus is a ring further out than the current Row's, so a Row
   * with focus and the current Row are told apart, and one that's both has
   * both.
   */
  .rows-item:focus-visible .rows-card {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 5px;
  }

  /* The Row as it's drawn, at the email's width, scaled to the card. */
  .rows-picture {
    color: #000000;
    display: block;
    font-family: var(--_mq-email-font);
    font-size: ${unsafeCSS(EMAIL_LOOK.fontSize)};
    line-height: ${unsafeCSS(EMAIL_LOOK.lineHeight)};
    pointer-events: none;
    scale: var(--_mq-picture-scale);
    text-align: start;
    transform-origin: 0 0;
    width: var(--_mq-email-width);
  }

  .rows-picture .picture-row {
    display: flex;
  }

  .rows-picture .picture-column {
    min-width: 0;
  }

  /* An empty Column, as its placeholder is drawn on the email. */
  .rows-picture .picture-column.empty {
    min-height: 112px;
    padding: var(--mq-space-2);
  }

  .rows-picture .picture-column.empty::before {
    border: 1.5px dashed var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    content: "";
    display: block;
    height: 96px;
  }

  /* What's dragged stays in its place, faded, while its picture moves. */
  .rows-item[data-drag-source] {
    opacity: 0.3;
  }

  .rows-card[data-drag-ghost] {
    box-shadow: var(--mq-shadow);
  }

  /* That it shows on one device only, on its picture, or beside its number. */
  .rows-badge {
    align-items: center;
    background: var(--mq-color-text);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-surface);
    display: flex;
    height: 20px;
    inset-block-start: var(--mq-space-1);
    inset-inline-end: var(--mq-space-1);
    justify-content: center;
    position: absolute;
    width: 20px;
  }

  .rows-badge .icon {
    height: 12px;
    width: 12px;
  }

  /* Where a dragged Row would land. */
  .rows-drop {
    background: var(--mq-color-accent);
    border-radius: 2px;
    height: 2px;
    inset-inline: calc(var(--mq-space-3) + 24px) var(--mq-space-3);
    margin-block-start: -1px;
    pointer-events: none;
    position: absolute;
  }

  .rows-drop::before {
    background: var(--mq-color-accent);
    border-radius: 50%;
    content: "";
    height: 8px;
    inset-inline-start: -4px;
    position: absolute;
    top: -3px;
    width: 8px;
  }

  @media (forced-colors: active) {
    .rows-drop,
    .rows-drop::before {
      background: CanvasText;
      forced-color-adjust: none;
    }
  }

  .rows-none {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: 0;
    padding: var(--mq-space-5) var(--mq-space-4);
    text-align: center;
  }

  .rows-none strong {
    color: var(--mq-color-text);
    display: block;
    font-size: var(--mq-font-size);
    font-weight: 500;
    margin-block-end: var(--mq-space-1);
  }

  /* Collapsed: each Row is its number. */
  .rows-list.collapsed {
    align-items: center;
    padding-block: var(--mq-space-3);
  }

  .rows-list.collapsed .rows-items {
    gap: var(--mq-space-1);
    justify-items: center;
    padding: 0;
  }

  .rows-list.collapsed .rows-scroll {
    align-self: stretch;
  }

  .rows-rule {
    background: var(--mq-color-border);
    height: 1px;
    margin: var(--mq-space-1) 0;
    width: 18px;
  }

  .rows-number-button {
    align-items: center;
    background: none;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: flex;
    font: 500 var(--mq-font-size-small) / 1 var(--mq-font-family);
    font-variant-numeric: tabular-nums;
    height: 30px;
    justify-content: center;
    position: relative;
    width: 30px;
  }

  .rows-number-button:hover {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  .rows-number-button[aria-current="true"] {
    background: var(--mq-color-accent-soft);
    color: var(--mq-color-accent-strong);
    font-weight: 600;
  }

  .rows-number-badge {
    inset-block-start: -1px;
    inset-inline-end: -1px;
    line-height: 0;
    position: absolute;
  }

  .rows-number-button .icon {
    color: var(--mq-color-text-muted);
    height: 11px;
    width: 11px;
  }

  .rows-list.collapsed .rows-add-button {
    margin-block-start: var(--mq-space-1);
  }

  /* The +'s layouts, beside it. */
  .rows-add {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-text);
    inset-block-start: var(--mq-space-2);
    inset-inline-start: calc(100% + var(--mq-space-1));
    padding: var(--mq-space-3);
    position: absolute;
    width: 300px;
    z-index: var(--_mq-layer-selection-bar);
  }

  .rows-add-anchor {
    position: relative;
  }

  /* Collapsed, the + is at the list's end, so its layouts open upwards. */
  .rows-list.collapsed .rows-add {
    inset-block: auto 0;
  }

  .rows-add h3 {
    font-size: var(--mq-font-size-small);
    font-weight: 600;
    margin: 0 0 var(--mq-space-2);
  }

  .rows-add-foot {
    border-block-start: 1px solid var(--mq-color-border);
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: var(--mq-space-3) 0 0;
    padding-block-start: var(--mq-space-2);
    text-align: center;
  }
`;

/** What a Row's picture is drawn with, besides the Row. */
interface PictureContext {
  api: PanelApi;
  /** A text Block's picture, as `RowsList.textPicture` makes it. */
  textPicture: (
    block: Extract<Block, { type: "heading" | "text" }>
  ) => HTMLElement;
  emailLang: string;
  failedImages: ReadonlySet<string>;
  socialIconsUrl: string | undefined;
}

/**
 * A text as its schema draws it, without its editor: no cursor, nothing to
 * type in, and no focus.
 */
const drawText = (block: Extract<Block, { type: "heading" | "text" }>) => {
  const { schema } = BLOCK_VIEWS[block.type].text;
  const element = document.createElement("div");
  element.className = "ProseMirror";
  element.append(
    DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(block.props.content).content
    )
  );
  return element;
};

const renderPictureBlock = (
  block: Block,
  context: PictureContext,
  style: EmailStyle
) =>
  hasRichText(block)
    ? html`<div style=${styleProperties(textBlockLook(block, style))}>
        ${context.textPicture(block)}
      </div>`
    : html`<div>
        ${renderBlockContent(block, {
          failedImages: context.failedImages,
          lang: context.emailLang,
          onImageError: () => {
            // The Canvas hears an image that fails, as it shows the same one.
          },
          socialIconsUrl: context.socialIconsUrl,
          style,
          text: context.api.text,
          uploading: false,
        })}
      </div>`;

/** A Row as the Canvas draws it, but nothing in it to press or reach. */
const renderPicture = (row: Row, context: PictureContext) => {
  const style = context.api.email.settings.style ?? {};
  return html`
    <span class="rows-card">
      <span
        aria-hidden="true"
        class="rows-picture"
        data-place=${place("rowPicture")}
        inert
      >
        <span class="picture-row" style=${styleProperties(rowLook(row, style))}>
          ${row.columns.map(
            ({ blocks, width }) => html`
              <span
                class=${blocks.length === 0 ? "picture-column empty" : "picture-column"}
                style=${styleProperties({ width: `${width}%` })}
              >
                ${blocks.map((block) => renderPictureBlock(block, context, style))}
              </span>
            `
          )}
        </span>
      </span>
      ${renderShownOnBadge(row, "rows-badge", context.api)}
    </span>
  `;
};

/** Where a Row shows, where it isn't every device, and the badge's icon. */
const SHOWN_ON = {
  desktop: { icon: ICONS.phoneOff, words: "device.desktopOnly" },
  phone: { icon: ICONS.phone, words: "device.phonesOnly" },
} as const;

/** A badge for a Row that shows on one device: "Desktop only" or "Phones only". */
const renderShownOnBadge = (row: Row, className: string, api: PanelApi) => {
  const { showOn } = row.props as RowProps;
  return showOn === undefined
    ? nothing
    : html`<span
        aria-hidden="true"
        class=${className}
        data-testid="rows-badge"
        data-tooltip=${api.text(SHOWN_ON[showOn].words)}
        >${SHOWN_ON[showOn].icon}</span
      >`;
};

/** "Row 3 of 6: Heading, Text, Button", and where it shows if not everywhere. */
const rowName = (row: Row, index: number, count: number, api: PanelApi) => {
  const { text } = api;
  const types = row.columns.flatMap(({ blocks }) =>
    blocks.map(({ type }) => blockTypeName(type, text))
  );
  const blocks =
    types.length === 0
      ? text("rows.noBlocks")
      : new Intl.ListFormat(text("language"), {
          style: "short",
          type: "unit",
        }).format(types);
  const values = { blocks, count, position: index + 1 };
  const { showOn } = row.props as RowProps;
  return showOn === undefined
    ? text("rows.item", values)
    : text("rows.itemShownOn", {
        ...values,
        words: text(SHOWN_ON[showOn].words),
      });
};

/** "Row 3 of 6 (Alt+↑ or Alt+↓ to move)", for keyboard focus. */
const moveTooltip = (index: number, count: number, api: PanelApi) => {
  const { text } = api;
  const keys = (direction: "down" | "up") =>
    keysInWords(keyLabel("rowsItems", "moveRow", { direction }).keys, text);
  return text("rows.moveKeys", {
    count,
    down: keys("down"),
    position: index + 1,
    up: keys("up"),
  });
};

/** The Row that what's selected is in, if anything is. */
const currentRowId = (api: PanelApi) =>
  api.selectedRow?.row.id ??
  api.selectedColumn?.row.id ??
  (api.selectedBlock && api.email.rows[api.selectedBlock.rowIndex]?.id);

/** The + and its layouts, which add an empty Row after the current one. */
const renderAdd = (api: PanelApi, open: boolean) => {
  const { text } = api;
  const current = api.selectedRow ?? api.selectedColumn ?? api.selectedBlock;
  return html`
    <span class="rows-add-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${text("rows.add")}
        class="icon-button rows-add-button"
        data-action="add-row"
        data-tooltip=${text("rows.add")}
        type="button"
        @click=${({ detail }: MouseEvent) => api.toggleRowsAdd(detail === 0)}
      >
        ${ICONS.plus}
      </button>
      ${
        open
          ? html`
              <div
                aria-label=${text("rows.add")}
                class="ui rows-add"
                data-place=${place("rowsAdd")}
                data-testid="rows-add"
                role="dialog"
              >
                <h3>${text("rows.emptyRow")}</h3>
                <div
                  aria-label=${text("rows.emptyRow")}
                  class="add-tiles layouts"
                  role="group"
                >
                  ${ROW_LAYOUTS.map(
                    (layout, index) => html`
                      <button
                        aria-label=${text("add.addLayout", { layout })}
                        class="add-tile"
                        data-action=${index === 0 ? "layout" : nothing}
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
                <p class="rows-add-foot">
                  ${
                    current
                      ? text("rows.addsBelow", { row: current.rowIndex + 1 })
                      : text("rows.addsAtEnd")
                  }
                </p>
              </div>
            `
          : nothing
      }
    </span>
  `;
};

const renderToggle = (api: PanelApi, expanded: boolean) => {
  const label = api.text(expanded ? "rows.collapse" : "rows.expand");
  return html`
    <button
      aria-expanded=${expanded ? "true" : "false"}
      aria-label=${label}
      class="icon-button rows-toggle"
      data-action="toggle-rows"
      data-tooltip=${label}
      type="button"
      @click=${({ detail }: MouseEvent) =>
        api.toggleRowsList(expanded, detail === 0)}
    >
      ${ICONS.rows}
    </button>
  `;
};

/**
 * Each Row, one stop for Tab, with arrow keys between them: the current Row,
 * or else the first. Each is also what a drag picks up, expanded.
 */
const renderItems = (
  api: PanelApi,
  expanded: boolean,
  context: PictureContext
) => {
  const { rows } = api.email;
  const current = currentRowId(api);
  const stop = rows.some(({ id }) => id === current) ? current : rows[0]?.id;
  return html`
    <div
      aria-label=${api.text("rows.list")}
      class="rows-items"
      data-place=${place("rowsItems")}
      data-testid="rows-items"
      role="group"
    >
      ${repeat(
        rows,
        (row) => row.id,
        (row, index) => {
          const name = rowName(row, index, rows.length, api);
          const shared = {
            current: row.id === current ? "true" : nothing,
            tabindex: row.id === stop ? "0" : "-1",
            tooltip: moveTooltip(index, rows.length, api),
          };
          return expanded
            ? html`
                <button
                  aria-current=${shared.current}
                  class="rows-item"
                  data-row-id=${row.id}
                  data-testid="rows-item"
                  data-tooltip=${shared.tooltip}
                  data-tooltip-on="focus"
                  data-tooltip-side="end"
                  tabindex=${shared.tabindex}
                  type="button"
                  @click=${({ detail }: MouseEvent) =>
                    api.selectRowInList(row.id, detail === 0)}
                >
                  <span class="visually-hidden">${name}</span>
                  <span aria-hidden="true" class="rows-number"
                    >${index + 1}</span
                  >
                  <span aria-hidden="true" class="rows-grip"
                    >${ICONS.grip}</span
                  >
                  ${renderPicture(row, context)}
                </button>
              `
            : html`
                <button
                  aria-current=${shared.current}
                  class="rows-number-button"
                  data-row-id=${row.id}
                  data-testid="rows-item"
                  data-tooltip=${shared.tooltip}
                  data-tooltip-on="focus"
                  data-tooltip-side="end"
                  tabindex=${shared.tabindex}
                  type="button"
                  @click=${({ detail }: MouseEvent) =>
                    api.selectRowInList(row.id, detail === 0)}
                >
                  <span class="visually-hidden">${name}</span>
                  <span aria-hidden="true">${index + 1}</span
                  >${renderShownOnBadge(row, "rows-number-badge", api)}
                </button>
              `;
        }
      )}
      <div
        class="rows-drop"
        data-place=${place("rowsDropIndicator")}
        data-testid="rows-drop"
        hidden
      ></div>
    </div>
  `;
};

/**
 * The Rows list, expanded or collapsed. Expanded where it doesn't fit beside
 * the email, it's over the Canvas's start, and the collapsed list's room is
 * kept for it, so the email doesn't move.
 */
export const renderRowsList = (
  api: PanelApi,
  shape: {
    expanded: boolean;
    floating: boolean;
    /** The email's width on the Canvas, its background and its font. */
    email: { background: string; font: string; width: number };
  },
  context: Omit<PictureContext, "api">
) => {
  const { text } = api;
  const { email, expanded, floating } = shape;
  const { rows } = api.email;
  const open = api.rowsList.addOpen;
  const pictures = { ...context, api };
  return html`
    <div
      class=${floating ? "rows-dock floating" : "rows-dock"}
      style=${styleProperties({
        "--_mq-email-background": email.background,
        "--_mq-email-font": email.font,
        "--_mq-picture-scale": String(PICTURE_WIDTH_PX / email.width),
        "--_mq-rows-width": `${
          expanded ? ROWS_LIST_WIDTH_PX : ROWS_LIST_COLLAPSED_WIDTH_PX
        }px`,
      })}
    >
      <section
        aria-label=${text("rows.list")}
        class=${expanded ? "ui rows-list" : "ui rows-list collapsed"}
        data-place=${place("rowsList")}
        data-testid="rows-list"
        ?data-adding=${open}
      >
        ${
          expanded
            ? html`
                <div class="rows-head">
                  ${renderToggle(api, true)}
                  <h2 class="rows-title">
                    ${text("rows.list")}<span
                      aria-hidden="true"
                      class="rows-count"
                      >${rows.length}</span
                    >
                  </h2>
                  ${renderAdd(api, open)}
                </div>
                <div class="rows-scroll thin-scrollbar">
                  ${
                    rows.length === 0
                      ? html`<p class="rows-none">
                          <strong>${text("rows.none")}</strong>
                          ${text("rows.noneHint")}
                        </p>`
                      : renderItems(api, true, pictures)
                  }
                </div>
              `
            : html`
                ${renderToggle(api, false)}
                <span aria-hidden="true" class="rows-rule"></span>
                <div class="rows-scroll thin-scrollbar">
                  ${renderItems(api, false, pictures)}
                </div>
                ${renderAdd(api, open)}
              `
        }
      </section>
    </div>
  `;
};
