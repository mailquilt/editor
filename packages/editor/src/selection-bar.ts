import { ROW_LAYOUTS } from "@mailquilt/core";
import type { BlockType, RowLayout } from "@mailquilt/core";
import {
  blockSettingsFields,
  EMAIL_SETTINGS_FIELDS,
  rowLayoutOf,
  rowSettingsFields,
} from "@mailquilt/core/internal";
import type { RowProps, SettingsField } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";

import { BLOCK_VIEWS } from "./block-types.js";
import { findPlace, place } from "./editor-places.js";
import type { Place } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import { ICONS } from "./icons.js";
import { UPLOADABLE_TYPES } from "./image-uploads.js";
import { keyLabel, withKeys } from "./key-map.js";
import type { Action, KeyScope } from "./key-map.js";
import { fieldTags, NO_FIELD_TAGS } from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { columnPlace } from "./positions.js";
import type { BlockPosition, Direction, RowPosition } from "./positions.js";
import {
  draftKey,
  fieldText,
  fieldWords,
  renderSettingsPanel,
  typedIn,
} from "./settings-panel.js";
import type { SettingsSection } from "./settings-panel.js";
import type { StringId } from "./strings.js";
import { styleProperties } from "./style-properties.js";
import { blockTypeName } from "./text.js";
import type { Text } from "./text.js";

/**
 * The Selection bar above the Canvas: the selected Block's or Row's main
 * settings and its actions, or the email's settings with nothing selected.
 * What doesn't fit is one press away under More, in a panel docked beside the
 * email where it fits, and floating under the bar where it doesn't. A bar
 * setting with more than one field, such as a Row's padding, opens in a
 * popover from its button.
 */

export const selectionBarStyles = css`
  /*
   * Across the top of the Canvas, under the top bar, and in sight while the
   * email scrolls. Its controls are in the middle, as the email is.
   */
  .bar-dock {
    margin: 0 calc(-1 * var(--_mq-gutter)) var(--mq-space-3);
    order: -1;
    position: sticky;
    top: var(--_mq-top-bar-height);
    z-index: var(--_mq-layer-selection-bar);
  }

  .selection-bar {
    align-items: center;
    background: var(--mq-color-surface);
    border-block-end: 1px solid var(--mq-color-border);
    display: flex;
    gap: var(--mq-space-1);
    justify-content: center;
    min-height: var(--_mq-selection-bar-height);
    padding: 0 var(--mq-space-3);
    white-space: nowrap;
  }

  /* Groups are set apart by space, as the picked frames have them. */
  .selection-bar .bar-separator {
    flex: none;
    width: var(--mq-space-3);
  }

  /* As wide as what's in it, which fitSelectionBar compares with the bar's. */
  .bar-content {
    align-items: center;
    display: flex;
    flex: none;
    gap: var(--mq-space-1);
    max-width: 100%;
  }

  .selection-bar :is(button, input):focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 2px;
  }

  .selection-bar button:active:not(:disabled, [aria-disabled="true"]) {
    transform: scale(0.97);
  }

  .selection-bar button {
    transition:
      background-color 120ms,
      color 120ms,
      transform 100ms;
  }

  /* What's selected and where: "Row 3 / Button". */
  .bar-chip {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    font-weight: 600;
    gap: var(--mq-space-2);
    height: 32px;
    padding: 0 var(--mq-space-2) 0 var(--mq-space-1);
  }

  .bar-chip:hover,
  .bar-chip[aria-expanded="true"] {
    background: var(--mq-color-surface-hover);
  }

  /* The email's has no menu, as there's nothing around it to select. */
  span.bar-chip {
    cursor: default;
  }

  span.bar-chip:hover {
    background: transparent;
  }

  .bar-chip .chip-icon {
    align-items: center;
    color: var(--mq-color-text-muted);
    display: flex;
    height: 20px;
    justify-content: center;
    width: 20px;
  }

  .bar-chip .chip-icon .icon {
    height: 13px;
    width: 13px;
  }

  .bar-chip .chip-path {
    color: var(--mq-color-text-muted);
    font-weight: 400;
  }

  .bar-chip > .icon,
  .bar-button > .chevron {
    color: var(--mq-color-text-muted);
    height: 14px;
    width: 14px;
  }

  /* Where a popover or a menu hangs from its button. */
  .bar-anchor {
    display: inline-flex;
    flex: none;
    position: relative;
  }

  /*
   * A field typed in. Its edge is at 3:1, as every field's is, so an empty one
   * still reads as a field.
   */
  .bar-field {
    align-items: center;
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    display: inline-flex;
    flex: 0 1 auto;
    gap: var(--mq-space-2);
    height: 32px;
    min-width: 96px;
    width: var(--_mq-field-width, 160px);
    padding: 0 var(--mq-space-2);
    position: relative;
    transition:
      border-color 120ms,
      box-shadow 120ms;
  }

  .bar-field:hover:not(:focus-within) {
    border-color: var(--mq-color-text-muted);
  }

  .bar-field:focus-within {
    border-color: transparent;
    box-shadow: 0 0 0 4px var(--mq-color-accent-soft);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -1px;
  }

  .bar-field[data-invalid] {
    border-color: var(--mq-color-danger);
  }

  .bar-field > .icon {
    color: var(--mq-color-text-muted);
    height: 14px;
    width: 14px;
  }

  .bar-field .bar-label {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    font-weight: 400;
  }

  /*
   * As wide as the field leaves it, rather than the 20 characters a browser
   * gives a field, so the field can shrink to its least where the bar is short
   * of room.
   */
  .bar-field input {
    background: transparent;
    border: 0;
    color: var(--mq-color-text);
    flex: 1;
    height: 30px;
    min-width: 0;
    padding: 0;
    text-overflow: ellipsis;
    width: 0;
  }

  /* The field draws the focus ring. */
  .selection-bar .bar-field input:focus-visible {
    outline: none;
  }

  .bar-field input::placeholder {
    color: var(--mq-color-text-muted);
    opacity: 1;
  }

  /* While the bar measures what it needs, a field is at its least. */
  .bar-content[data-measuring] .bar-field:not(.number) {
    width: 96px;
  }

  .bar-field.number {
    flex: none;
    min-width: 0;
    width: auto;
    padding-inline-end: var(--mq-space-2);
  }

  .bar-field.number input {
    -moz-appearance: textfield;
    flex: none;
    text-align: end;
    width: 4ch;
  }

  .bar-field.number input::-webkit-inner-spin-button,
  .bar-field.number input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .bar-field .unit {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
  }

  /* A setting's name before its control, where the control doesn't say. */
  .bar-name {
    color: var(--mq-color-text-muted);
    flex: none;
    font-size: var(--mq-font-size-small);
    font-weight: 400;
    margin-inline: var(--mq-space-1);
  }

  /*
   * Under a field, what's wrong with what was typed, or the Merge Tags it
   * takes. Over the email, as the bar's popovers are.
   */
  .bar-field .bar-error,
  .bar-anchor > .bar-error,
  .bar-field .field-merge-tag-picker {
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-start: -1px;
    position: absolute;
    z-index: 1;
  }

  .bar-field .field-merge-tag-picker {
    min-width: 220px;
  }

  .bar-error {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-danger);
    font-size: var(--mq-font-size-small);
    line-height: 1.4;
    margin: 0;
    padding: var(--mq-space-2) var(--mq-space-3);
    white-space: normal;
    width: max(100%, 260px);
  }

  /* A button with words, such as Padding or Upload, quiet until it's pressed. */
  .bar-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text-muted);
    cursor: pointer;
    display: inline-flex;
    flex: none;
    font-weight: 500;
    gap: var(--mq-space-2);
    height: 32px;
    padding: 0 var(--mq-space-2);
  }

  .bar-button:hover {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text);
  }

  .bar-button[aria-expanded="true"] {
    background: var(--mq-color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--mq-color-accent-strong);
    color: var(--mq-color-accent-strong);
  }

  /* The key a button's action has, as frame a04 draws it after "Add". */
  .bar-button kbd {
    color: var(--mq-color-text-muted);
    font: inherit;
    margin-inline-start: calc(var(--mq-space-1) - var(--mq-space-2));
  }

  .bar-button .count {
    color: var(--mq-color-text-muted);
  }

  /* A color, on a swatch with an edge, so white shows on the white bar. */
  .swatch {
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
    flex: none;
    height: 18px;
    width: 18px;
  }

  /* A choice of a few, such as an alignment, as a track of buttons. */
  .selection-bar .segments {
    border-radius: var(--mq-radius);
    flex: none;
    gap: 0;
    padding: calc(var(--mq-space-1) / 2);
  }

  .selection-bar .segment {
    flex: none;
    height: 28px;
    min-width: 28px;
    padding: 0 var(--mq-space-2);
  }

  .selection-bar .segment:has(> .icon:only-child) {
    padding: 0;
  }

  /* A layout as its Column widths, in the bar and the Rows tab. */
  .thumbnail {
    display: flex;
    gap: 3px;
    height: 22px;
    width: 100%;
  }

  .thumbnail > span {
    background: var(--mq-color-surface-muted);
    border: 1px solid
      color-mix(
        in srgb,
        var(--mq-color-border-strong) 55%,
        var(--mq-color-surface)
      );
    border-radius: 3px;
    flex-basis: 0;
    transition:
      background-color 120ms,
      border-color 120ms;
  }

  .layout-option:is(:hover, [aria-pressed="true"]) .thumbnail > span {
    background: var(--mq-color-accent-soft);
    border-color: var(--mq-color-accent);
  }

  .selection-bar .layout-option {
    padding: 0 var(--mq-space-1);
    width: 34px;
  }

  .selection-bar .layout-option .thumbnail {
    height: 14px;
  }

  .selection-bar .layout-option .thumbnail > span {
    border-radius: calc(var(--mq-radius-small) / 2);
  }

  .bar-actions {
    align-items: center;
    display: flex;
    gap: var(--mq-space-1);
  }

  /* Forced colors drop the backgrounds that show a pressed or open button. */
  @media (forced-colors: active) {
    .bar-button[aria-expanded="true"],
    .bar-chip[aria-expanded="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  /* A popover or a menu from the bar, over the email. */
  .bar-popover,
  .bar-menu {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-start: 0;
    position: absolute;
    transform-origin: top left;
    white-space: normal;
    z-index: 1;
  }

  .bar-popover {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) -
        var(--_mq-top-bar-height) - var(--_mq-selection-bar-height) -
        var(--mq-space-5)
    );
    overflow-y: auto;
    width: 320px;
  }

  /*
   * One setting's popover is named by its field, so its title is only for
   * screen readers, which hear it as the group's name.
   */
  .bar-popover:not(.grid) legend {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  /* Short number fields, such as the four sides of a padding, two by two. */
  .bar-popover.grid fieldset {
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: 1fr 1fr;
  }

  .bar-popover.grid legend,
  .bar-popover.grid .same-sides,
  .bar-popover.grid .same-sides + .field:last-child {
    grid-column: 1 / -1;
  }

  /* The switch's name and the switch on one line. */
  .bar-popover.grid .field.inline.same-sides {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }

  .bar-popover.grid .field.inline {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .bar-menu {
    display: flex;
    flex-direction: column;
    min-width: 180px;
    padding: var(--mq-space-1);
  }

  .bar-menu > button,
  .more-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text);
    cursor: pointer;
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: 16px 1fr auto;
    height: 32px;
    padding: 0 var(--mq-space-2);
    text-align: start;
  }

  .bar-menu > button:hover,
  .more-action:hover:not([aria-disabled="true"]) {
    background: var(--mq-color-surface-hover);
  }

  .more-action[aria-disabled="true"] {
    color: var(--mq-color-text-muted);
    cursor: default;
    opacity: 0.45;
  }

  .more-action kbd {
    color: var(--mq-color-text-muted);
    font: inherit;
    font-size: var(--mq-font-size-small);
  }

  .more-action.danger:hover {
    color: var(--mq-color-danger);
  }

  /*
   * More: under the bar's end, over the email, or docked beside it where it
   * fits, as tall as the editor, as the Add panel is.
   */
  .more-panel {
    background: var(--mq-color-surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    white-space: normal;
  }

  .more-panel.floating {
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow);
    inset-block-start: calc(100% + var(--mq-space-2));
    inset-inline-end: var(--mq-space-3);
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) -
        var(--_mq-top-bar-height) - var(--_mq-selection-bar-height) -
        var(--mq-space-5)
    );
    position: absolute;
    transform-origin: top right;
    width: var(--_mq-panel-width);
  }

  /* Docked, it's a column as tall as the editor, its panel in sight. */
  .more-dock {
    background: var(--mq-color-surface);
    border-inline-start: 1px solid var(--mq-color-border);
    flex: 0 0 var(--_mq-panel-width);
    min-width: 0;
  }

  .more-panel.docked {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  .more-head {
    align-items: flex-start;
    display: flex;
    gap: var(--mq-space-2);
    justify-content: space-between;
    padding: var(--mq-space-3) var(--mq-space-2) var(--mq-space-2)
      var(--mq-space-4);
  }

  .more-title {
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .more-subtitle {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    margin: 0;
  }

  .more-body {
    overflow-y: auto;
  }

  .more-body > * {
    border-block-start: 1px solid var(--mq-color-border);
  }

  .more-actions {
    display: flex;
    flex-direction: column;
    padding: var(--mq-space-2) var(--mq-space-2) var(--mq-space-3);
  }

  .more-actions h3 {
    font-size: var(--mq-font-size);
    font-weight: 600;
    margin: 0 var(--mq-space-2) var(--mq-space-2);
  }

  /*
   * Where the bar is short of room, its own actions are in More instead, and
   * only there, and then a button with words shows its icon, its words kept
   * for screen readers. fitSelectionBar says which.
   */
  .more-action.narrow-only {
    display: none;
  }

  .selection-bar[data-compact] .bar-actions {
    display: none;
  }

  .more-panel[data-compact] .more-action.narrow-only {
    display: grid;
  }

  .selection-bar[data-compact="words"] .bar-button[aria-haspopup] > .words {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar-popover,
    .bar-menu,
    .more-panel.floating {
      animation: bar-pop-in 140ms cubic-bezier(0.2, 0, 0, 1);
    }
  }

  @keyframes bar-pop-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }
`;

/** The popover, menu or panel the Selection bar has open. */
export interface BarPanelsState {
  /** The bar's popover that's open, by its button's `data-action`. */
  popover: string | undefined;
  /** Whether the chip's menu is open. */
  menuOpen: boolean;
  /** Whether More is open. It stays open as the selection changes. */
  moreOpen: boolean;
  /**
   * The Rows whose padding shows each side, as the person turned "Same on
   * every side" off, though every side is the same.
   */
  paddingBySide: ReadonlySet<string>;
}

interface BarPanelsHost {
  focus: Pick<EditorFocus, "focusWhenRendered">;
  requestUpdate: () => void;
}

export type BarPanels = ReturnType<typeof createBarPanels>;

/** Whether `element` is in what's open from the bar, or its button. */
const isInOpen = (element: Element, opened: Place, button: string) =>
  element.closest(`[data-place="${opened}"]`) !== null ||
  element.closest(`[data-action="${CSS.escape(button)}"]`) !== null;

/**
 * What the Selection bar has open. A popover and the chip's menu close when
 * the selection changes, a press lands outside them, or focus leaves them, and
 * Escape closes them back to their button. More stays open until it's closed.
 */
export const createBarPanels = ({ focus, requestUpdate }: BarPanelsHost) => {
  const paddingBySide = new Set<string>();
  const state: BarPanelsState = {
    menuOpen: false,
    moreOpen: false,
    paddingBySide,
    popover: undefined,
  };

  const closePopover = (returnFocus: boolean) => {
    const { popover } = state;
    if (popover === undefined) {
      return;
    }
    state.popover = undefined;
    requestUpdate();
    if (returnFocus) {
      focus.focusWhenRendered({ action: popover, on: "bar" });
    }
  };

  const closeMenu = (returnFocus: boolean) => {
    if (!state.menuOpen) {
      return;
    }
    state.menuOpen = false;
    requestUpdate();
    if (returnFocus) {
      focus.focusWhenRendered({ action: "chip", on: "bar" });
    }
  };

  return {
    closeMenu,

    closeMore: (returnFocus: boolean) => {
      if (!state.moreOpen) {
        return;
      }
      state.moreOpen = false;
      requestUpdate();
      if (returnFocus) {
        focus.focusWhenRendered({ action: "more", on: "bar" });
      }
    },

    closePopover,

    /** Focus that leaves a popover or the menu, and its button, closes it. */
    onFocusout({ relatedTarget }: FocusEvent) {
      if (!(relatedTarget instanceof Element)) {
        return;
      }
      const { popover } = state;
      if (
        popover !== undefined &&
        !isInOpen(relatedTarget, "barPopover", popover)
      ) {
        closePopover(false);
      }
      if (state.menuOpen && !isInOpen(relatedTarget, "barMenu", "chip")) {
        closeMenu(false);
      }
    },

    /** A press outside a popover or the menu, and its button, closes it. */
    onPointerdown({ target }: PointerEvent) {
      if (!(target instanceof Element)) {
        return;
      }
      const { popover } = state;
      if (popover !== undefined && !isInOpen(target, "barPopover", popover)) {
        closePopover(false);
      }
      if (state.menuOpen && !isInOpen(target, "barMenu", "chip")) {
        closeMenu(false);
      }
    },

    /** Shows a Row's padding by side, or as one value while it's the same. */
    showPaddingBySide(rowId: string, bySide: boolean) {
      if (bySide) {
        paddingBySide.add(rowId);
      } else {
        paddingBySide.delete(rowId);
      }
      requestUpdate();
    },

    /** A new selection has its own bar, with nothing of the last one's open. */
    onSelect() {
      state.popover = undefined;
      state.menuOpen = false;
    },

    state,

    /** Opens the chip's menu with focus on its first item, or closes it. */
    toggleMenu() {
      state.menuOpen = !state.menuOpen;
      state.popover = undefined;
      requestUpdate();
      if (state.menuOpen) {
        focus.focusWhenRendered({ on: "barMenu" });
      }
    },

    /** Opens More, with focus in it from the keyboard, or closes it. */
    toggleMore(fromKeyboard: boolean) {
      state.moreOpen = !state.moreOpen;
      state.popover = undefined;
      state.menuOpen = false;
      requestUpdate();
      if (state.moreOpen && fromKeyboard) {
        focus.focusWhenRendered({ on: "more" });
      }
    },

    /** Opens a popover with focus on its first field, or closes it. */
    togglePopover(id: string) {
      state.popover = state.popover === id ? undefined : id;
      state.menuOpen = false;
      requestUpdate();
      if (state.popover !== undefined) {
        focus.focusWhenRendered({ on: "barPopover" });
      }
    },
  };
};

/** What the bar and More show: the selected Block, Row, or the email. */
type Target =
  | { kind: "block"; position: BlockPosition }
  | { kind: "row"; position: RowPosition }
  | { kind: "email" };

const targetOf = ({ selectedBlock, selectedRow }: PanelApi): Target => {
  if (selectedBlock) {
    return { kind: "block", position: selectedBlock };
  }
  return selectedRow
    ? { kind: "row", position: selectedRow }
    : { kind: "email" };
};

/** The Block section's ID, which keeps what's typed with the Block it's for. */
const BLOCK_SECTION_ID = "block";

/** Where what's typed in a selected Block's field is kept. */
export const blockDraftKey = (blockId: string, fieldKey: string) =>
  draftKey({ id: BLOCK_SECTION_ID, targetId: blockId }, { key: fieldKey });

/**
 * Opens the file picker, with only the types an upload takes. The picker is
 * the button's, so it's no Tab stop of its own.
 */
const renderUpload = (
  blockId: string,
  uploadImage: (blockId: string, file: File) => void,
  label: string,
  attributes: {
    action?: string;
    className: string;
    describedBy?: string;
    icon?: TemplateResult;
  }
) => html`
  <button
    aria-describedby=${attributes.describedBy ?? nothing}
    class=${attributes.className}
    data-action=${attributes.action ?? nothing}
    tabindex=${attributes.action ? "-1" : nothing}
    type="button"
    @click=${({ currentTarget }: MouseEvent) =>
      (
        (currentTarget as Element).nextElementSibling as HTMLInputElement
      ).click()}
  >
    ${attributes.icon ?? nothing}<span>${label}</span>
  </button>
  <input
    accept=${UPLOADABLE_TYPES.join(",")}
    hidden
    type="file"
    @change=${({ currentTarget }: Event) => {
      const input = currentTarget as HTMLInputElement;
      const [file] = input.files ?? [];
      // So the same file can be picked again.
      input.value = "";
      if (file) {
        uploadImage(blockId, file);
      }
    }}
  />
`;

const blockSection = (
  { block }: BlockPosition,
  api: PanelApi
): SettingsSection => ({
  command: (props) => ({ blockId: block.id, props, type: "updateBlockProps" }),
  extras:
    block.type === "image"
      ? {
          src: {
            control: api.uploadImage
              ? renderUpload(
                  block.id,
                  api.uploadImage,
                  api.text("bar.uploadImage"),
                  { className: "text-button" }
                )
              : undefined,
            error: api.uploadErrorOf(block.id),
          },
        }
      : undefined,
  fields: blockSettingsFields(block),
  id: BLOCK_SECTION_ID,
  legend: blockTypeName(block.type, api.text),
  targetId: block.id,
  values: block.props,
});

const rowSection = ({ row }: RowPosition, api: PanelApi): SettingsSection => ({
  command: (props) => ({ props, rowId: row.id, type: "updateRowProps" }),
  fields: rowSettingsFields(row),
  id: "row",
  legend: api.text("bar.row"),
  targetId: row.id,
  unsetColor: api.email.settings.backgroundColor,
  values: row.props,
});

const emailSection = (api: PanelApi): SettingsSection => ({
  command: (settings) => ({ settings, type: "updateEmailSettings" }),
  fields: EMAIL_SETTINGS_FIELDS,
  id: "email",
  legend: api.text("bar.email"),
  targetId: "",
  values: { ...api.email.settings },
});

const sectionOf = (target: Target, api: PanelApi) => {
  switch (target.kind) {
    case "block": {
      return blockSection(target.position, api);
    }
    case "row": {
      return rowSection(target.position, api);
    }
    default: {
      return emailSection(api);
    }
  }
};

/**
 * One of the bar's settings. Its keys are the fields it shows; every field of
 * what's selected that no control shows is in More.
 */
type Control =
  /** A field typed in, wide or narrow, with its name or an icon inside. */
  | {
      kind: "text";
      key: string;
      icon?: TemplateResult;
      label?: StringId;
      placeholder?: StringId;
      /** In its place where there's an Upload button before the field. */
      placeholderAfterUpload?: StringId;
      width: number;
    }
  /** A number in px, with its name before it where the field doesn't say. */
  | { kind: "number"; key: string; label?: StringId }
  /** A color's swatch and name, which opens its field. */
  | { kind: "color"; key: string; label: StringId }
  /** One of a few, as a track of buttons, each its icon or a short name. */
  | {
      kind: "choice";
      key: string;
      icons?: Readonly<Record<string, TemplateResult>>;
      short?: (value: number | string) => string;
    }
  /** A button that opens fields in a popover. */
  | {
      kind: "popover";
      id: string;
      keys: readonly string[];
      icon?: TemplateResult;
      /** What the button says. Without it, it's its icon and a tooltip. */
      label?: (values: Record<string, unknown>, text: Text) => string;
      name: StringId;
      grid?: boolean;
    }
  /** A Row's layout, as its Columns. */
  | { kind: "layout" }
  /** Upload, for an Image, with the Host app's `uploadImage`. */
  | { kind: "upload" };

const ALIGN_ICONS = {
  center: ICONS.alignCenter,
  left: ICONS.alignLeft,
  right: ICONS.alignRight,
};

const ALIGN: Control = { icons: ALIGN_ICONS, key: "align", kind: "choice" };

/** The keys a control shows. */
const keysOf = (control: Control): readonly string[] => {
  switch (control.kind) {
    case "popover": {
      return control.keys;
    }
    case "layout":
    case "upload": {
      return [];
    }
    default: {
      return [control.key];
    }
  }
};

/**
 * Each Block's two to four most-used settings, and a Row's and the email's,
 * as the picked frames draw them. An Image's depend on whether it has one.
 */
const CONTROLS: Readonly<
  Record<BlockType, (values: Record<string, unknown>) => readonly Control[]>
> & {
  readonly email: readonly Control[];
  readonly row: (columns: number) => readonly Control[];
} = {
  button: () => [
    {
      icon: ICONS.link,
      key: "href",
      kind: "text",
      placeholder: "bar.addLink",
      width: 250,
    },
    { key: "backgroundColor", kind: "color", label: "bar.fill" },
    { key: "color", kind: "color", label: "bar.textColor" },
    ALIGN,
  ],
  divider: () => [
    { key: "color", kind: "color", label: "bar.color" },
    { key: "thickness", kind: "number", label: "bar.thickness" },
  ],
  email: [
    { key: "preheader", kind: "text", label: "bar.preheader", width: 300 },
    { key: "language", kind: "text", label: "bar.language", width: 130 },
    { key: "width", kind: "number", label: "bar.width" },
  ],
  heading: () => [
    {
      key: "level",
      kind: "choice",
      short: (level) => `H${level}`,
    },
    { key: "fontSize", kind: "number" },
    { key: "color", kind: "color", label: "bar.color" },
    ALIGN,
  ],
  image: ({ src }) =>
    src === undefined
      ? [
          { kind: "upload" },
          {
            icon: ICONS.link,
            key: "src",
            kind: "text",
            placeholder: "bar.imageUrl",
            placeholderAfterUpload: "bar.pasteImageUrl",
            width: 230,
          },
          { key: "alt", kind: "text", label: "bar.alt", width: 190 },
        ]
      : [
          { kind: "upload" },
          { key: "alt", kind: "text", label: "bar.alt", width: 230 },
          {
            icon: ICONS.width,
            id: "popover-width",
            keys: ["width"],
            kind: "popover",
            label: ({ width }, text) =>
              width === undefined
                ? text("bar.widthFill")
                : text("bar.widthOf", { width: String(width) }),
            name: "field.width",
          },
          {
            icon: ICONS.link,
            id: "popover-link",
            keys: ["href"],
            kind: "popover",
            name: "field.link",
          },
        ],
  row: (columns) => [
    { kind: "layout" },
    {
      grid: true,
      icon: ICONS.padding,
      id: "popover-padding",
      keys: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
      kind: "popover",
      label: (_values, text) => text("bar.padding"),
      name: "bar.padding",
    },
    ...(columns > 1
      ? [
          {
            icon: ICONS.phone,
            id: "popover-stack",
            keys: ["stackOnPhone"],
            kind: "popover",
            label: (_values: Record<string, unknown>, text: Text) =>
              text("bar.stackOnPhones"),
            name: "field.stackOnPhone",
          } satisfies Control,
        ]
      : []),
  ],
  social: () => [
    {
      icon: ICONS.link,
      id: "popover-links",
      keys: ["links"],
      kind: "popover",
      label: (_values, text) => text("bar.links"),
      name: "field.socialLinks",
    },
    { key: "iconStyle", kind: "choice" },
    { key: "iconSize", kind: "choice", short: String },
    ALIGN,
  ],
  spacer: () => [{ key: "height", kind: "number", label: "bar.height" }],
  text: () => [
    { key: "fontSize", kind: "number" },
    { key: "color", kind: "color", label: "bar.color" },
    ALIGN,
  ],
};

const controlsOf = (target: Target) => {
  switch (target.kind) {
    case "block": {
      const { block } = target.position;
      return CONTROLS[block.type](block.props as Record<string, unknown>);
    }
    case "row": {
      return CONTROLS.row(target.position.row.columns.length);
    }
    default: {
      return CONTROLS.email;
    }
  }
};

/** The fields of what's selected that the bar doesn't show, for More. */
const moreFieldsOf = (target: Target, section: SettingsSection) => {
  const shown = new Set(controlsOf(target).flatMap(keysOf));
  return section.fields.filter(({ key }) => !shown.has(key));
};

/** What a field shows unset: its default, or for a color, what's behind it. */
const shownValue = (section: SettingsSection, field: SettingsField) =>
  fieldText(field, section.values) || section.unsetColor || "";

const renderSeparator = () =>
  html`<span aria-hidden="true" class="bar-separator"></span>`;

/** What a field shows empty, which can point to the Upload button before it. */
const placeholderOf = (
  control: Extract<Control, { kind: "text" }>,
  api: PanelApi
) => (api.uploadImage && control.placeholderAfterUpload) || control.placeholder;

/** A field typed in, which applies on Enter or as focus leaves, as every field does. */
const renderTextControl = (
  section: SettingsSection,
  field: SettingsField,
  control: Extract<Control, { kind: "text" }>,
  api: PanelApi,
  isStop: boolean
) => {
  const { drafts, text } = api;
  const placeholder = placeholderOf(control, api);
  const id = `bar-${section.id}-${field.key}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const tags =
    field.type === "text" && !field.disabled
      ? fieldTags(api)(id)
      : NO_FIELD_TAGS;
  const description = [
    field.descriptionId && fieldWords(field.descriptionId, text),
    tags.hint,
  ]
    .filter(Boolean)
    .join(" ");
  const describedBy = [
    description ? descriptionId : "",
    refusals ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");
  return html`
    <label
      class="bar-field"
      ?data-invalid=${refusals > 0}
      style=${styleProperties({ "--_mq-field-width": `${control.width}px` })}
    >
      ${control.icon ?? nothing}
      ${
        control.label
          ? html`<span aria-hidden="true" class="bar-label">
              ${text(control.label)}
            </span>`
          : nothing
      }
      <input
        aria-activedescendant=${tags.activeDescendant}
        aria-controls=${tags.controls}
        aria-describedby=${describedBy || nothing}
        aria-invalid=${refusals ? "true" : "false"}
        aria-label=${fieldWords(field.labelId, text)}
        autocomplete="off"
        data-action=${`field-${field.key}`}
        data-draft-key=${key}
        ?data-merge-tags=${tags.takesTags}
        data-place=${place(draft ? "settingsDraft" : "barField")}
        ?disabled=${field.disabled ?? false}
        id=${id}
        placeholder=${placeholder ? text(placeholder) : nothing}
        spellcheck="false"
        tabindex=${isStop ? "0" : "-1"}
        type="text"
        .value=${live(draft?.text ?? fieldText(field, section.values))}
        @change=${({ currentTarget }: Event) =>
          drafts.onCommit(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
        @input=${({ currentTarget }: Event) =>
          drafts.onInput(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
      />
      ${
        description
          ? html`<span class="visually-hidden" id=${descriptionId}>
              ${description}
            </span>`
          : nothing
      }
      ${tags.list}
      ${
        refusals
          ? keyed(
              refusals,
              html`<p class="bar-error" id=${errorId} role="alert">
                ${fieldWords(field.invalidMessageId, text)}
              </p>`
            )
          : nothing
      }
    </label>
  `;
};

/** A number of px, with its name before it where the bar shows one. */
const renderNumberControl = (
  section: SettingsSection,
  field: Extract<SettingsField, { type: "number" }>,
  control: Extract<Control, { kind: "number" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const id = `bar-${section.id}-${field.key}`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const unit = text(`unit.${field.unit}`);
  return html`
    ${
      control.label
        ? html`<span aria-hidden="true" class="bar-name">
            ${text(control.label)}
          </span>`
        : nothing
    }
    <label class="bar-field number" ?data-invalid=${refusals > 0}>
      <input
        aria-describedby=${refusals ? errorId : nothing}
        aria-invalid=${refusals ? "true" : "false"}
        aria-label=${`${fieldWords(field.labelId, text)} ${text("settings.unit", { unit })}`}
        autocomplete="off"
        data-action=${`field-${field.key}`}
        data-draft-key=${key}
        data-place=${place(draft ? "settingsDraft" : "barField")}
        id=${id}
        max=${field.max ?? nothing}
        min=${field.min}
        step="1"
        tabindex="-1"
        type="number"
        .value=${live(draft?.text ?? fieldText(field, section.values))}
        @change=${({ currentTarget }: Event) =>
          drafts.onCommit(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
        @input=${({ currentTarget }: Event) =>
          drafts.onInput(
            section,
            field,
            typedIn(currentTarget as HTMLInputElement)
          )}
      />
      <span aria-hidden="true" class="unit">${unit}</span>
      ${
        refusals
          ? keyed(
              refusals,
              html`<p class="bar-error" id=${errorId} role="alert">
                ${fieldWords(field.invalidMessageId, text, {
                  max: field.max,
                  min: field.min,
                })}
              </p>`
            )
          : nothing
      }
    </label>
  `;
};

/**
 * A choice of a few, each a button that's pressed while it's the value, in
 * a group named for the setting. Each is one of the bar's controls.
 */
const renderChoiceControl = (
  section: SettingsSection,
  field: Extract<SettingsField, { type: "select" }>,
  control: Extract<Control, { kind: "choice" }>,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const current = fieldText(field, section.values);
  return html`
    <span
      aria-label=${fieldWords(field.labelId, text)}
      class="segments"
      role="group"
    >
      ${field.options.map(({ labelId, value }) => {
        const label = fieldWords(labelId, text);
        const icon = control.icons?.[String(value)];
        // A short name shown is the button's name, as a person who speaks
        // to their computer says what they see; its tooltip says it in full.
        const shown = icon ?? control.short?.(value) ?? label;
        return html`
          <button
            aria-label=${icon ? label : nothing}
            aria-pressed=${String(value) === current ? "true" : "false"}
            class="segment"
            data-action=${`choice-${field.key}-${value}`}
            data-tooltip=${icon || control.short ? label : nothing}
            tabindex="-1"
            type="button"
            @click=${() =>
              drafts.onCommit(section, field, {
                badInput: false,
                text: String(value),
              })}
          >
            ${shown}
          </button>
        `;
      })}
    </span>
  `;
};

/** The settings in a popover, under its button, titled `legend`. */
const renderPopover = (
  section: SettingsSection,
  fields: readonly SettingsField[],
  { grid = false, legend }: { grid?: boolean; legend: string },
  api: PanelApi
) => html`
  <div
    aria-label=${legend}
    class=${grid ? "ui bar-popover grid" : "ui bar-popover"}
    data-place=${place("barPopover")}
    role="dialog"
    tabindex="-1"
  >
    ${renderSettingsPanel(
      { ...section, legend },
      api.drafts,
      fieldTags(api),
      api.text,
      fields
    )}
  </div>
`;

/** The one field a Row's padding is while it's the same on every side. */
const EVERY_SIDE = "paddingEverySide";

/**
 * A Row's padding: one field while it's the same on every side, which sets
 * all four as one step, or a field for each side once "Same on every side" is
 * off. It's on wherever every side is the same, unless the person turned it
 * off; turning it on gives every side Top's value.
 */
const renderPaddingPopover = (
  section: SettingsSection,
  sides: readonly SettingsField[],
  legend: string,
  api: PanelApi
) => {
  const { drafts, text } = api;
  const [top] = sides;
  if (!top) {
    return nothing;
  }
  const texts = sides.map((side) => fieldText(side, section.values));
  const equal = texts.every((value) => value === texts[0]);
  const same = equal && !api.bar.paddingBySide.has(section.targetId);
  const everySide = { ...top, key: EVERY_SIDE, labelId: "bar.everySide" };
  const everySection: SettingsSection = {
    ...section,
    command: (changes) =>
      section.command(
        Object.fromEntries(sides.map(({ key }) => [key, changes[EVERY_SIDE]]))
      ),
    fields: [everySide],
    values: { ...section.values, [EVERY_SIDE]: section.values[top.key] },
  };
  // A side set on its own keeps the sides apart, so the fields don't change
  // under the person once the sides happen to be the same.
  const bySideSection: SettingsSection = {
    ...section,
    command: (changes) => {
      api.showPaddingBySide(section.targetId, true);
      return section.command(changes);
    },
  };
  const switchId = `bar-${section.id}-padding-same`;
  const onSame = ({ currentTarget }: Event) => {
    const on = (currentTarget as HTMLInputElement).checked;
    // What was typed in a field it hid or hides isn't what the email has.
    drafts.drop(section, sides);
    drafts.drop(everySection, [everySide]);
    api.showPaddingBySide(section.targetId, !on);
    if (on && !equal) {
      drafts.onCommit(everySection, everySide, {
        badInput: false,
        text: texts[0] ?? "",
      });
    }
  };
  // Under the name and above the fields, so it stays where it was pressed
  // as they change.
  const sameSides = html`
    <div class="field same-sides inline">
      <label for=${switchId}>${text("bar.sameOnEverySide")}</label>
      <input
        id=${switchId}
        role="switch"
        type="checkbox"
        .checked=${live(same)}
        @change=${onSame}
      />
    </div>
  `;
  return html`
    <div
      aria-label=${legend}
      class="ui bar-popover grid"
      data-place=${place("barPopover")}
      role="dialog"
      tabindex="-1"
    >
      ${renderSettingsPanel(
        same ? { ...everySection, legend } : { ...bySideSection, legend },
        drafts,
        fieldTags(api),
        text,
        same ? [everySide] : sides,
        sameSides
      )}
    </div>
  `;
};

const renderPopoverControl = (
  section: SettingsSection,
  control: Extract<Control, { kind: "popover" }>,
  api: PanelApi,
  open: boolean
) => {
  const fields = section.fields.filter(({ key }) => control.keys.includes(key));
  if (fields.length === 0) {
    return nothing;
  }
  const name = api.text(control.name);
  const label = control.label?.(section.values, api.text);
  const popoverOf = () =>
    control.id === "popover-padding"
      ? renderPaddingPopover(section, fields, name, api)
      : renderPopover(
          section,
          fields,
          { grid: control.grid, legend: name },
          api
        );
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${label ? nothing : name}
        class=${label ? "bar-button" : "icon-button"}
        data-action=${control.id}
        data-tooltip=${name}
        tabindex="-1"
        type="button"
        @click=${() => api.togglePopover(control.id)}
      >
        ${control.icon ?? nothing}
        ${
          label
            ? html`<span class="words">${label}</span>${
                  control.keys[0] === "links"
                    ? html`<span class="count">
                        ${(section.values.links as unknown[] | undefined)?.length ?? 0}
                      </span>`
                    : nothing
                }${ICONS.chevronDown}`
            : nothing
        }
      </button>
      ${open ? popoverOf() : nothing}
    </span>
  `;
};

/** A color's swatch and its short name, which opens the color's field. */
const renderColorControl = (
  section: SettingsSection,
  field: SettingsField,
  control: Extract<Control, { kind: "color" }>,
  api: PanelApi,
  open: boolean
) => {
  const { text } = api;
  const id = `popover-${field.key}`;
  const name = fieldWords(field.labelId, text);
  const value = shownValue(section, field);
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${open ? "true" : "false"}
        aria-haspopup="dialog"
        aria-label=${text("bar.valueOf", {
          label: text(control.label),
          value: value || text("settings.none"),
        })}
        class="bar-button"
        data-action=${id}
        data-tooltip=${name}
        tabindex="-1"
        type="button"
        @click=${() => api.togglePopover(id)}
      >
        <span
          class="swatch"
          style=${styleProperties({ "background-color": value || undefined })}
        ></span>
        <span class="words">${text(control.label)}</span>
      </button>
      ${open ? renderPopover(section, [field], { legend: name }, api) : nothing}
    </span>
  `;
};

/** A layout as its Column widths. */
export const renderThumbnail = (layout: RowLayout) => html`
  <span aria-hidden="true" class="thumbnail">
    ${layout
      .split("/")
      .map(
        (width) =>
          html`<span style=${styleProperties({ "flex-grow": width })}></span>`
      )}
  </span>
`;

const renderLayoutControl = ({ row }: RowPosition, api: PanelApi) => {
  const { text } = api;
  const current = rowLayoutOf(row);
  return html`
    <span aria-hidden="true" class="bar-name">${text("bar.columns")}</span>
    <span aria-label=${text("bar.columns")} class="segments" role="group">
      ${ROW_LAYOUTS.map(
        (layout) => html`
          <button
            aria-label=${text("bar.layout", { layout })}
            aria-pressed=${layout === current ? "true" : "false"}
            class="segment layout-option"
            data-action=${`layout-${layout}`}
            data-tooltip=${text("bar.layout", { layout })}
            tabindex="-1"
            type="button"
            @click=${() => api.setRowLayout(row.id, layout)}
          >
            ${renderThumbnail(layout)}
          </button>
        `
      )}
    </span>
  `;
};

/** Upload, or Replace once there's an image, and why the last upload failed. */
const renderUploadControl = ({ block }: BlockPosition, api: PanelApi) => {
  const { text, uploadImage } = api;
  if (!uploadImage) {
    return nothing;
  }
  const error = api.uploadErrorOf(block.id);
  return html`
    <span class="bar-anchor">
      ${renderUpload(
        block.id,
        uploadImage,
        text(
          block.type === "image" && block.props.src !== undefined
            ? "bar.replace"
            : "bar.upload"
        ),
        {
          action: "upload",
          className: "bar-button",
          describedBy: error ? "bar-upload-error" : undefined,
          icon: ICONS.export,
        }
      )}
      ${
        error
          ? html`<p
              class="bar-error"
              data-testid="upload-error"
              id="bar-upload-error"
              role="alert"
            >
              ${error}
            </p>`
          : nothing
      }
    </span>
  `;
};

/** A field by its key, if what's selected has it. */
const fieldOf = (section: SettingsSection, key: string) =>
  section.fields.find((field) => field.key === key);

const renderControl = (
  target: Target,
  section: SettingsSection,
  control: Control,
  api: PanelApi,
  isStop: boolean
) => {
  const open = (id: string) => api.bar.popover === id;
  switch (control.kind) {
    case "layout": {
      return target.kind === "row"
        ? renderLayoutControl(target.position, api)
        : nothing;
    }
    case "upload": {
      return target.kind === "block"
        ? renderUploadControl(target.position, api)
        : nothing;
    }
    case "popover": {
      return renderPopoverControl(section, control, api, open(control.id));
    }
    default: {
      break;
    }
  }
  const field = fieldOf(section, control.key);
  if (!field) {
    return nothing;
  }
  switch (control.kind) {
    case "text": {
      return renderTextControl(section, field, control, api, isStop);
    }
    case "number": {
      return field.type === "number"
        ? renderNumberControl(section, field, control, api)
        : nothing;
    }
    case "color": {
      return renderColorControl(
        section,
        field,
        control,
        api,
        open(`popover-${field.key}`)
      );
    }
    default: {
      return field.type === "select"
        ? renderChoiceControl(section, field, control, api)
        : nothing;
    }
  }
};

/** What's selected, and where: the chip, with its menu of what's around it. */
const renderChip = (target: Target, api: PanelApi) => {
  const { text } = api;
  if (target.kind === "email") {
    return html`
      <span class="bar-chip">
        <span class="chip-icon">${ICONS.mail}</span>${text("bar.email")}
      </span>
    `;
  }
  const { rowIndex } = target.position;
  const row = text("canvas.row", { row: rowIndex + 1 });
  /** A menu item's click: its menu closes, and from the keyboard, `detail` is 0. */
  const select =
    (then: (fromKeyboard: boolean) => void) =>
    ({ detail }: MouseEvent) => {
      api.closeMenu(false);
      then(detail === 0);
    };
  return html`
    <span class="bar-anchor">
      <button
        aria-expanded=${api.bar.menuOpen ? "true" : "false"}
        aria-haspopup="menu"
        class="bar-chip"
        data-action="chip"
        tabindex="0"
        type="button"
        @click=${() => api.toggleMenu()}
      >
        <span class="chip-icon">
          ${
            target.kind === "block"
              ? BLOCK_VIEWS[target.position.block.type].icon
              : ICONS.rows
          }
        </span>
        ${
          target.kind === "block"
            ? html`<span class="chip-path">${text("bar.path", { row })}</span>
                <span>
                  ${blockTypeName(target.position.block.type, text)}
                </span>`
            : html`<span>${row}</span>`
        }
        ${ICONS.chevronDown}
      </button>
      ${
        api.bar.menuOpen
          ? html`
              <div
                aria-label=${text("bar.around")}
                class="ui bar-menu"
                data-place=${place("barMenu")}
                role="menu"
              >
                ${
                  target.kind === "block"
                    ? html`
                        <button
                          role="menuitem"
                          tabindex="-1"
                          type="button"
                          @click=${select((fromKeyboard) =>
                            api.selectRow(target.position.row.id, fromKeyboard)
                          )}
                        >
                          ${ICONS.rows}<span>${row}</span>
                        </button>
                      `
                    : nothing
                }
                <button
                  role="menuitem"
                  tabindex="-1"
                  type="button"
                  @click=${select((fromKeyboard) =>
                    api.selectEmail(fromKeyboard)
                  )}
                >
                  ${ICONS.mail}<span>${text("bar.email")}</span>
                </button>
              </div>
            `
          : nothing
      }
    </span>
  `;
};

/** A button with its keys in its tooltip and `aria-keyshortcuts`. */
const renderKeyedButton = (
  {
    action,
    disabled = false,
    icon,
    keys,
    label,
    onClick,
    danger = false,
  }: {
    action: string;
    disabled?: boolean;
    icon: TemplateResult;
    keys?: { keys: string; shortcuts: string };
    label: string;
    onClick: (event: MouseEvent) => void;
    danger?: boolean;
  },
  text: Text
) => html`
  <button
    aria-keyshortcuts=${keys?.shortcuts ?? nothing}
    aria-label=${label}
    class=${danger ? "icon-button danger" : "icon-button"}
    data-action=${action}
    data-tooltip=${keys ? withKeys(label, keys.keys, text) : label}
    ?disabled=${disabled}
    tabindex="-1"
    type="button"
    @click=${onClick}
  >
    ${icon}
  </button>
`;

/**
 * With nothing selected, at the bar's end, the Add button, which opens the
 * Add panel, as `/` does.
 */
const renderAddButton = (api: PanelApi) => {
  const { text } = api;
  const keys = keyLabel("emailBar", "openAddPanel");
  return html`
    <button
      aria-expanded=${api.adding.panel ? "true" : "false"}
      aria-keyshortcuts=${keys.shortcuts}
      class="bar-button"
      data-action="add"
      data-tooltip=${withKeys(text("add.add"), keys.keys, text)}
      tabindex="-1"
      type="button"
      @click=${({ detail }: MouseEvent) => api.openAddPanel(detail === 0)}
    >
      ${ICONS.plus}<span>${text("add.add")}</span
      ><kbd aria-hidden="true">${keys.keys}</kbd>
    </button>
  `;
};

/** The Block's or Row's own actions, and More, at the bar's end. */
const renderActions = (target: Target, api: PanelApi) => {
  const { text } = api;
  const more = html`
    <button
      aria-expanded=${api.bar.moreOpen ? "true" : "false"}
      aria-label=${text("bar.more")}
      class="icon-button"
      data-action="more"
      data-tooltip=${text("bar.more")}
      tabindex="-1"
      type="button"
      @click=${({ detail }: MouseEvent) => api.toggleMore(detail === 0)}
    >
      ${ICONS.more}
    </button>
  `;
  if (target.kind === "email") {
    return html`${more} ${renderSeparator()} ${renderAddButton(api)}`;
  }
  const own = actionsOf(target, api);
  return html`
    <span class="bar-actions">
      ${own.map(({ disabledWhy, ...action }) =>
        renderKeyedButton({ ...action, disabled: Boolean(disabledWhy) }, text)
      )}
    </span>
    ${more}
  `;
};

interface ActionButton {
  action: string;
  danger?: boolean;
  /** Why it can't be done, if it can't. */
  disabledWhy?: string;
  icon: TemplateResult;
  keys?: { keys: string; shortcuts: string };
  label: string;
  onClick: (event: MouseEvent) => void;
}

const BLOCK_MOVES = [
  ["up", "canvas.moveBlockUp"],
  ["down", "canvas.moveBlockDown"],
] as const satisfies readonly [Direction, StringId][];

const ROW_MOVES = [
  ["up", "canvas.moveRowUp"],
  ["down", "canvas.moveRowDown"],
] as const satisfies readonly ["down" | "up", StringId][];

/** The keys for an action where the bar answers them. */
const barKeys = (
  scope: KeyScope,
  action: Action,
  direction?: Direction
): { keys: string; shortcuts: string } =>
  keyLabel(scope, action, { direction });

/**
 * Move up, move down, duplicate and delete, as the Block's and Row's toolbars
 * had them. From the keyboard, a click has a `detail` of 0.
 */
/** Why a Row can't move that way, at the top or the bottom, if it can't. */
const cantMoveRowWhy = (
  rowIndex: number,
  count: number,
  direction: "down" | "up",
  text: Text
) => {
  if (direction === "up") {
    return rowIndex === 0 ? text("more.firstRow") : undefined;
  }
  return rowIndex === count - 1 ? text("more.lastRow") : undefined;
};

const actionsOf = (
  target: Exclude<Target, { kind: "email" }>,
  api: PanelApi
): ActionButton[] => {
  const { text } = api;
  if (target.kind === "block") {
    return [
      ...BLOCK_MOVES.map(([direction, label]) => ({
        action: `move-${direction}`,
        icon: ICONS[direction],
        keys: barKeys("blockBar", "moveBlock", direction),
        label: text(label),
        onClick: () => api.moveBlock(direction),
      })),
      {
        action: "duplicate",
        icon: ICONS.duplicate,
        keys: barKeys("blockBar", "duplicateBlock"),
        label: text("canvas.duplicateBlock"),
        onClick: ({ detail }: MouseEvent) => api.duplicateBlock(detail === 0),
      },
      {
        action: "delete",
        danger: true,
        icon: ICONS.delete,
        label: text("canvas.deleteBlock"),
        onClick: ({ detail }: MouseEvent) => api.deleteBlock(detail === 0),
      },
    ];
  }
  const { row, rowIndex } = target.position;
  const count = api.email.rows.length;
  return [
    ...ROW_MOVES.map(([direction, label]) => ({
      action: `move-${direction}`,
      disabledWhy: cantMoveRowWhy(rowIndex, count, direction, text),
      icon: ICONS[direction],
      keys: barKeys("rowBar", "moveRow", direction),
      label: text(label),
      onClick: () => api.moveRow(row.id, direction),
    })),
    {
      action: "duplicate",
      icon: ICONS.duplicate,
      keys: barKeys("rowBar", "duplicateRow"),
      label: text("canvas.duplicateRow"),
      onClick: () => api.duplicateRow(row.id),
    },
    {
      action: "delete",
      danger: true,
      icon: ICONS.delete,
      keys: barKeys("rowBar", "deleteRow"),
      label: text("canvas.deleteRow"),
      onClick: ({ detail }: MouseEvent) => api.deleteRow(row.id, detail === 0),
    },
  ];
};

/** What a screen reader calls the bar: what it's the settings of. */
const nameOf = (target: Target, text: Text) => {
  switch (target.kind) {
    case "block": {
      return blockTypeName(target.position.block.type, text);
    }
    case "row": {
      return text("canvas.row", { row: target.position.rowIndex + 1 });
    }
    default: {
      return text("bar.email");
    }
  }
};

const BAR_PLACE: Record<Target["kind"], Place> = {
  block: "blockBar",
  email: "emailBar",
  row: "rowBar",
};

/**
 * The Selection bar. One stop for Tab, at its chip, or with nothing selected
 * its first field, and the arrow keys go along its controls. More, where it
 * floats, hangs below it, in the same sticky dock, so it stays in sight as the
 * email scrolls, and isn't one of the bar's controls.
 */
export const renderSelectionBar = (api: PanelApi) => {
  const { text } = api;
  const target = targetOf(api);
  const section = sectionOf(target, api);
  const controls = controlsOf(target);
  // Said, as the mark on the Row's tag isn't read.
  const hiddenOnPhones =
    target.kind === "row" &&
    (target.position.row.props as RowProps).hideOnPhone === true;
  return html`
    <div class="bar-dock">
      <div
        aria-describedby=${hiddenOnPhones ? "bar-hidden-on-phones" : nothing}
        aria-label=${text("bar.of", { name: nameOf(target, text) })}
        class="ui selection-bar"
        data-place=${place(BAR_PLACE[target.kind])}
        data-testid="selection-bar"
        role="toolbar"
      >
        <div class="bar-content">
          ${renderChip(target, api)} ${renderSeparator()}
          ${controls.map((control, index) =>
            renderControl(
              target,
              section,
              control,
              api,
              target.kind === "email" && index === 0
            )
          )}
          ${renderSeparator()} ${renderActions(target, api)}
        </div>
        ${
          hiddenOnPhones
            ? html`<span class="visually-hidden" id="bar-hidden-on-phones">
                ${text("canvas.hiddenOnPhones")}
              </span>`
            : nothing
        }
      </div>
      ${api.bar.moreOpen && !api.bar.docked ? renderMore(api) : nothing}
    </div>
  `;
};

/** One of More's actions: a row with its name, and its keys where it has them. */
const renderMoreAction = ({
  action,
  danger = false,
  disabledWhy,
  icon,
  keys,
  label,
  narrowOnly = false,
  onClick,
}: {
  action: string;
  danger?: boolean;
  /** Why it can't be done, which its tooltip says, as it stays reachable. */
  disabledWhy?: string;
  icon: TemplateResult;
  keys?: { keys: string; shortcuts: string };
  label: string;
  narrowOnly?: boolean;
  onClick: (event: MouseEvent) => void;
}) => html`
  <button
    aria-disabled=${disabledWhy ? "true" : nothing}
    aria-keyshortcuts=${keys?.shortcuts ?? nothing}
    class=${[
      "more-action",
      danger ? "danger" : "",
      narrowOnly ? "narrow-only" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    data-action=${`more-${action}`}
    data-tooltip=${disabledWhy ?? nothing}
    type="button"
    @click=${(event: MouseEvent) => {
      if (!disabledWhy) {
        onClick(event);
      }
    }}
  >
    ${icon}<span>${label}</span
    ><kbd aria-hidden="true">${keys?.keys ?? ""}</kbd>
  </button>
`;

/** Why a Block can't move into the Column that way, if it can't. */
const cantMoveWhy = (
  { columnIndex, row }: BlockPosition,
  direction: "left" | "right",
  text: Text
) => {
  if (row.columns.length === 1) {
    return text("more.onlyColumn");
  }
  if (direction === "left" && columnIndex === 0) {
    return text("more.firstColumn");
  }
  return direction === "right" && columnIndex === row.columns.length - 1
    ? text("more.lastColumn")
    : undefined;
};

const renderMoreActions = (
  target: Exclude<Target, { kind: "email" }>,
  api: PanelApi
) => {
  const { text } = api;
  const isBlock = target.kind === "block";
  const scope: KeyScope = isBlock ? "block" : "rowBar";
  return html`
    <div class="more-actions">
      <h3>${text("more.actions")}</h3>
      ${actionsOf(target, api).map((button) =>
        renderMoreAction({ ...button, narrowOnly: true })
      )}
      ${renderMoreAction({
        action: "copy",
        icon: ICONS.duplicate,
        keys: barKeys(scope, isBlock ? "copyBlock" : "copyRow"),
        label: text("more.copy"),
        onClick: () => api.copySelected(),
      })}
      ${renderMoreAction({
        action: "cut",
        icon: ICONS.cut,
        keys: barKeys(scope, isBlock ? "cutBlock" : "cutRow"),
        label: text("more.cut"),
        onClick: () => api.cutSelected(),
      })}
      ${renderMoreAction({
        action: "paste",
        icon: ICONS.down,
        keys: barKeys(scope, isBlock ? "paste" : "pasteAfterRow"),
        label: text("more.paste"),
        onClick: () => api.pasteBelow(),
      })}
      ${
        target.kind === "block"
          ? html`
              ${(
                [
                  ["left", "more.moveLeft"],
                  ["right", "more.moveRight"],
                ] as const
              ).map(([direction, label]) =>
                renderMoreAction({
                  action: `move-${direction}`,
                  disabledWhy: cantMoveWhy(target.position, direction, text),
                  icon: ICONS[direction],
                  keys: barKeys("block", "moveBlock", direction),
                  label: text(label),
                  onClick: () => api.moveBlock(direction),
                })
              )}
              ${renderMoreAction({
                action: "select-row",
                icon: ICONS.rows,
                label: text("more.selectRow", {
                  row: target.position.rowIndex + 1,
                }),
                onClick: ({ detail }) =>
                  api.selectRow(target.position.row.id, detail === 0),
              })}
            `
          : nothing
      }
    </div>
  `;
};

/** What More is titled, and what's under its title. */
const headingOf = (target: Target, text: Text) => {
  switch (target.kind) {
    case "block": {
      const { block, columnIndex, rowIndex } = target.position;
      return {
        subtitle: text("more.blockPlace", columnPlace(rowIndex, columnIndex)),
        title: blockTypeName(block.type, text),
      };
    }
    case "row": {
      const { row, rowIndex } = target.position;
      const count = row.columns.length;
      return {
        subtitle:
          count === 1
            ? text("more.oneColumn")
            : text("more.columns", { count }),
        title: text("canvas.row", { row: rowIndex + 1 }),
      };
    }
    default: {
      return { subtitle: undefined, title: text("bar.email") };
    }
  }
};

/**
 * Where the Selection bar is short of room for what it shows, it puts its own
 * actions in More, and then, if it's still short, shows its buttons' icons
 * without their words. Measured after each update and as the Canvas changes
 * size, before the page is drawn, so the bar never shows a step on the way.
 */
export const fitSelectionBar = (root: ParentNode) => {
  const bar = [
    findPlace(root, "blockBar"),
    findPlace(root, "rowBar"),
    findPlace(root, "emailBar"),
  ].find(Boolean);
  const content = bar?.firstElementChild;
  if (!(bar && content instanceof HTMLElement)) {
    return;
  }
  // The room the bar has, as wide as its content can be.
  content.style.setProperty("width", "100%");
  const room = content.getBoundingClientRect().width;
  // Fields shrink to their least, so each step measures what's left at that.
  content.style.setProperty("max-width", "none");
  content.style.setProperty("width", "min-content");
  content.dataset.measuring = "";
  let compact: string | undefined;
  delete bar.dataset.compact;
  for (const step of ["actions", "words"]) {
    if (content.getBoundingClientRect().width <= room) {
      break;
    }
    compact = step;
    bar.dataset.compact = step;
  }
  delete content.dataset.measuring;
  content.style.removeProperty("max-width");
  content.style.removeProperty("width");
  findPlace(root, "morePanel")?.toggleAttribute(
    "data-compact",
    compact !== undefined
  );
  // Focus on an action the bar now leaves to More goes to More's button, so
  // it stays in the editor.
  const focused = (bar.getRootNode() as ShadowRoot).activeElement;
  if (
    focused &&
    bar.contains(focused) &&
    focused.getClientRects().length === 0
  ) {
    bar.querySelector<HTMLElement>('[data-action="more"]')?.focus();
  }
};

/** More where it docks beside the email: a column as tall as the editor. */
export const renderMoreDock = (api: PanelApi) =>
  html`<div class="more-dock">${renderMore(api)}</div>`;

/**
 * More: the settings of what's selected that the bar doesn't show, then its
 * less common actions. It shows whatever is selected while it's open.
 */
const renderMore = (api: PanelApi) => {
  const { text } = api;
  const target = targetOf(api);
  const section = sectionOf(target, api);
  const fields = moreFieldsOf(target, section);
  const { subtitle, title } = headingOf(target, text);
  return html`
    <section
      aria-label=${title}
      class=${api.bar.docked ? "ui more-panel docked" : "ui more-panel floating"}
      data-place=${place("morePanel")}
      data-testid="more-panel"
    >
      <div class="more-head">
        <div>
          <h2 class="more-title">${title}</h2>
          ${subtitle ? html`<p class="more-subtitle">${subtitle}</p>` : nothing}
        </div>
        <button
          aria-label=${text("bar.close")}
          class="icon-button"
          data-action="close-more"
          data-tooltip=${text("bar.close")}
          type="button"
          @click=${() => api.closeMore(true)}
        >
          ${ICONS.close}
        </button>
      </div>
      <div class="more-body thin-scrollbar">
        ${
          fields.length > 0
            ? renderSettingsPanel(
                section,
                api.drafts,
                fieldTags(api),
                text,
                fields
              )
            : nothing
        }
        ${target.kind === "email" ? nothing : renderMoreActions(target, api)}
      </div>
    </section>
  `;
};
