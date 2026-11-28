import { css, html, nothing } from "lit";

import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import { keyLabel, withKeys } from "./key-map.js";
import { renderSheet, renderSheetHead } from "./sheet.js";
import type { StringId } from "./strings.js";
import type { Text } from "./text.js";

/** What the editor is for at the moment: changing the email, its look, or checking it. */
export type Mode = "check" | "edit" | "style";

/** The width the email is viewed at. */
export type Device = "desktop" | "phone";

/** A common phone's width, below every phone media query of an email's. */
export const PHONE_WIDTH = 375;

const MODES: readonly { label: StringId; mode: Mode }[] = [
  { label: "topBar.edit", mode: "edit" },
  { label: "topBar.style", mode: "style" },
  { label: "topBar.check", mode: "check" },
];

const DEVICES = [
  { device: "desktop", icon: ICONS.monitor, label: "topBar.desktop" },
  { device: "phone", icon: ICONS.phone, label: "topBar.phone" },
] as const;

const UNDO = keyLabel("editor", "undo");
const REDO = keyLabel("editor", "redo");

/** The ID of a Mode's tab, and of the panel it shows. */
export const modeTabId = (mode: Mode) => `mode-tab-${mode}`;
export const modePanelId = (mode: Mode) => `mode-panel-${mode}`;

export const topBarStyles = css`
  /*
   * Above every Mode, and in sight while the email scrolls, in a Shell or on
   * the host's page. Its corners are the frame's, so a host's frame without
   * corners has a top bar without them.
   */
  .top-bar {
    align-items: center;
    background: var(--mq-color-surface);
    border-block-end: 1px solid var(--mq-color-border);
    border-start-end-radius: inherit;
    border-start-start-radius: inherit;
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    min-height: var(--_mq-top-bar-height);
    padding: 0 var(--mq-space-3) 0 var(--mq-space-4);
    position: sticky;
    top: 0;
    z-index: var(--_mq-layer-top-bar);
  }

  /*
   * On a phone, as frame p08 draws it: Undo, the Modes and ⋯, which opens a
   * sheet with the rest, and while typing, Done in place of the Modes and ⋯.
   */
  .top-bar[data-phone] {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 0 var(--mq-space-2);
  }

  /* Narrower than they are, as in a narrow part of a page, they scroll. */
  .top-bar[data-phone] .modes {
    justify-self: center;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .top-bar[data-phone] .modes > .segment {
    height: 30px;
    padding: 0 10px;
  }

  .top-bar[data-phone] .icon-button {
    height: 44px;
    width: 44px;
  }

  .top-bar .done-typing {
    grid-column: 3;
    height: 36px;
  }

  /* The top bar's menu on a phone: lines of a menu, each 44px tall. */
  .top-menu .top-menu-heading {
    color: var(--mq-color-text);
    font-weight: 600;
    margin: var(--mq-space-2) 0;
  }

  .top-menu .segments {
    margin-block-end: var(--mq-space-2);
  }

  .top-menu .top-menu-note {
    align-items: flex-start;
    color: var(--mq-color-text-muted);
    display: flex;
    font-size: var(--mq-font-size-small);
    gap: var(--mq-space-1);
    margin: 0 0 var(--mq-space-3);
  }

  .top-menu .top-menu-note .icon {
    height: 14px;
    margin-block-start: 2px;
    width: 14px;
  }

  .top-menu hr {
    border: 0;
    border-block-start: 1px solid var(--mq-color-border);
    margin: var(--mq-space-2) 0;
  }

  .top-menu .count {
    color: var(--mq-color-text-muted);
    flex: none;
    font-size: var(--mq-font-size);
  }

  .top-bar-start,
  .top-bar-end {
    align-items: center;
    display: flex;
    gap: 2px;
    min-width: 0;
  }

  .top-bar-end {
    gap: 6px;
    justify-content: flex-end;
    margin-inline-start: auto;
  }

  .top-bar .modes > .segment {
    flex: none;
    height: 28px;
    padding: 0 14px;
  }

  /* How many Problems the email has, once it has been checked as it is. */
  .top-bar .modes .count {
    background: var(--mq-color-warning);
    border-radius: 8px;
    color: var(--mq-color-on-warning);
    display: inline-grid;
    font-size: var(--_mq-font-size-tag);
    font-weight: 600;
    height: 16px;
    margin-inline: 6px -4px;
    min-width: 16px;
    padding: 0 4px;
    place-items: center;
  }

  .top-bar .device > .segment {
    flex: none;
    height: 26px;
    padding: 0;
    width: 28px;
  }

  /* The chosen view in the text's color, as the Modes' is. */
  .top-bar .device > .segment .icon {
    color: inherit;
  }

  .top-bar .segment[aria-disabled="true"] {
    color: var(--mq-color-text-muted);
    cursor: default;
    opacity: 0.45;
  }

  .top-bar button:active:not(:disabled, [aria-disabled="true"]) {
    transform: scale(0.97);
  }

  .top-bar button {
    transition:
      background-color 120ms,
      color 120ms,
      transform 100ms;
  }
`;

export interface TopBarState {
  canRedo: boolean;
  canUndo: boolean;
  /**
   * The email's Problems, once it has been checked as it is. A change clears
   * it, as the check renders the email, which only Check and export load.
   */
  checkCount: number | undefined;
  device: Device;
  /** With nothing in the email, there's nothing to style or check. */
  isEmpty: boolean;
  mode: Mode;
  /**
   * On a phone, only Undo, the Modes and ⋯ show, and while typing, Undo and
   * Done. The Shell's own are in the menu.
   */
  phone: { menuOpen: boolean; typing: boolean } | undefined;
  text: Text;
}

export interface TopBarEvents {
  selectDevice: (device: Device) => void;
  selectMode: (mode: Mode) => void;
  stepHistory: (step: "redo" | "undo") => void;
  /** On a phone: opens the menu, or closes it. */
  toggleMenu: (fromKeyboard: boolean) => void;
  /** On a phone: leaves the text being typed in, for its Block. */
  doneTyping: () => void;
}

/**
 * One Tab stop, with arrow keys between the Modes, which are chosen as focus
 * reaches them, as in any tab list. A Mode that's off still takes
 * focus, so its tooltip can say why.
 */
const renderModes = (
  { checkCount, isEmpty, mode: current, text }: TopBarState,
  { selectMode }: TopBarEvents
) => html`
  <div
    aria-label=${text("topBar.modes")}
    class="segments modes"
    data-place=${place("modes")}
    role="tablist"
  >
    ${MODES.map(({ label, mode }) => {
      const off = isEmpty && mode !== "edit";
      const select = () => {
        if (!off) {
          selectMode(mode);
        }
      };
      return html`
        <button
          aria-controls=${modePanelId(mode)}
          aria-disabled=${off ? "true" : nothing}
          aria-selected=${mode === current ? "true" : "false"}
          class="segment"
          data-tooltip=${
            off
              ? text("topBar.emptyEmail")
              : text("topBar.modeKeys", { mode: text(label) })
          }
          id=${modeTabId(mode)}
          role="tab"
          tabindex=${mode === current ? "0" : "-1"}
          type="button"
          @click=${select}
          @focus=${select}
        >
          ${text(label)}${
            mode === "check" && checkCount
              ? html`<span aria-hidden="true" class="count">${checkCount}</span
                  ><span class="visually-hidden">
                    ${text("check.tabCount", { count: checkCount })}</span
                  >`
              : nothing
          }
        </button>
      `;
    })}
  </div>
`;

const renderDevices = (
  { device: current, text }: TopBarState,
  { selectDevice }: TopBarEvents
) => html`
  <div
    aria-label=${text("topBar.view")}
    class="segments device"
    data-place=${place("controls")}
    role="group"
  >
    ${DEVICES.map(
      ({ device, icon, label }) => html`
        <button
          aria-label=${text(label)}
          aria-pressed=${device === current ? "true" : "false"}
          class="segment"
          data-tooltip=${text(label)}
          type="button"
          @click=${() => selectDevice(device)}
        >
          ${icon}
        </button>
      `
    )}
  </div>
`;

/** Undo, and Redo but on a phone, where it's in the menu. */
const renderHistory = (
  { canRedo, canUndo, phone, text }: TopBarState,
  events: TopBarEvents
) => html`
  <div class="top-bar-start" data-place=${place("history")}>
    <button
      aria-keyshortcuts=${UNDO.shortcuts}
      aria-label=${text("topBar.undo")}
      class="icon-button"
      data-action="undo"
      data-tooltip=${withKeys(text("topBar.undo"), UNDO.keys, text)}
      ?disabled=${!canUndo}
      type="button"
      @click=${() => events.stepHistory("undo")}
    >
      ${ICONS.undo}
    </button>
    ${
      phone
        ? nothing
        : html`<button
            aria-keyshortcuts=${REDO.shortcuts}
            aria-label=${text("topBar.redo")}
            class="icon-button"
            data-action="redo"
            data-tooltip=${withKeys(text("topBar.redo"), REDO.keys, text)}
            ?disabled=${!canRedo}
            type="button"
            @click=${() => events.stepHistory("redo")}
          >
            ${ICONS.redo}
          </button>`
    }
  </div>
`;

/**
 * On a phone, as frame p08 draws it: Undo, the Modes and ⋯, and while
 * typing, as frame p06 draws it, Undo and Done, which leaves the text.
 */
const renderPhoneTopBar = (
  state: TopBarState & { phone: NonNullable<TopBarState["phone"]> },
  events: TopBarEvents
) => {
  const { phone, text } = state;
  return html`
    ${renderHistory(state, events)}
    ${
      // Done's press keeps focus in the text, which would otherwise leave it,
      // and take Done away before its click.
      phone.typing
        ? html`<button
            class="text-button primary done-typing"
            data-action="done-typing"
            data-place=${place("controls")}
            type="button"
            @click=${events.doneTyping}
          >
            ${text("topBar.doneTyping")}
          </button>`
        : html`
            ${renderModes(state, events)}
            <button
              aria-expanded=${phone.menuOpen ? "true" : "false"}
              aria-haspopup="dialog"
              aria-label=${text("topBar.menu")}
              class="icon-button"
              data-place=${place("topMenuButton")}
              type="button"
              @click=${({ detail }: MouseEvent) =>
                events.toggleMenu(detail === 0)}
            >
              ${ICONS.more}
            </button>
          `
    }
  `;
};

/**
 * Undo and redo, the Modes, and the Desktop/Phone switch, in every Mode. Check
 * shows both widths, so it has no switch. The Shell puts the email's name and
 * save status, Export and its menu in the slots either side; they're the
 * Shell's own, and not yet a promise to hosts. On a phone, the Shell's go in
 * the menu instead.
 */
export const renderTopBar = (state: TopBarState, events: TopBarEvents) => {
  const { mode, phone, text } = state;
  return html`
    <div
      class="ui top-bar"
      lang=${text("language")}
      part="top-bar"
      ?data-phone=${phone !== undefined}
    >
      ${
        phone
          ? renderPhoneTopBar({ ...state, phone }, events)
          : html`
              <div class="top-bar-start">
                <slot name="top-bar-start"></slot>
                ${renderHistory(state, events)}
              </div>
              ${renderModes(state, events)}
              <div class="top-bar-end">
                ${mode === "check" ? nothing : renderDevices(state, events)}
                <slot name="top-bar-end"></slot>
              </div>
            `
      }
    </div>
  `;
};

/**
 * On a phone, the top bar's menu, as frame p09 draws it: the Shell's name and
 * save status, the View with what the Phone view changes, the Shell's choice
 * of how what's not on this device shows, Redo, the Rows sheet, and the
 * Shell's Export and Import. The Shell's are in its slots, as in the top bar.
 */
export const renderTopMenu = (
  state: TopBarState & { rowCount: number },
  events: TopBarEvents & { close: () => void; openRows: () => void }
) => {
  const { canRedo, device: current, rowCount, text } = state;
  const titleId = "top-menu-title";
  return renderSheet({
    body: html`
      <p class="top-menu-heading" id="top-menu-view">${text("topBar.view")}</p>
      <div
        aria-labelledby="top-menu-view"
        class="segments sheet-choices"
        data-place=${place("controls")}
        role="group"
      >
        ${DEVICES.map(
          ({ device, label }) => html`
            <button
              aria-pressed=${device === current ? "true" : "false"}
              class="segment"
              data-action=${`view-${device}`}
              type="button"
              @click=${() => events.selectDevice(device)}
            >
              ${text(label)}
            </button>
          `
        )}
      </div>
      <p class="top-menu-note">${ICONS.info}${text("topBar.phoneValues")}</p>
      <slot name="phone-menu-view"></slot>
      <hr />
      <button
        class="sheet-item"
        data-action="redo"
        ?disabled=${!canRedo}
        type="button"
        @click=${() => events.stepHistory("redo")}
      >
        ${ICONS.redo}<span>${text("topBar.redo")}</span>
      </button>
      <button
        class="sheet-item"
        data-action="rows"
        type="button"
        @click=${events.openRows}
      >
        ${ICONS.rows}<span>${text("rows.list")}</span>
        <span class="count">${rowCount}</span>
      </button>
      <slot name="phone-menu-actions"></slot>
    `,
    className: "top-menu",
    head: renderSheetHead(
      {
        done: events.close,
        title: html`<slot name="phone-menu-title"
          >${text("topBar.menu")}</slot
        >`,
        titleId,
      },
      text
    ),
    labelledBy: titleId,
    onClose: events.close,
    sheetPlace: "topMenu",
    testId: "top-menu",
  });
};
