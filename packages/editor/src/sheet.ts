import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { place } from "./editor-places.js";
import type { Place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import { styleProperties } from "./style-properties.js";
import type { Text } from "./text.js";

/**
 * On a phone, a panel that opens over the email is a sheet from the bottom of
 * the screen, as frames `p02`, `p07`, `p09` and `p12` to `p17` of
 * `docs/design/0.4.0` draw it: a modal `<dialog>`, so the browser keeps focus
 * in it and makes the rest of the page inert, with the email dimmed behind.
 * The editor's own state says whether it's open, and its close methods return
 * focus, so the dialog is only ever opened here and taken away by an update.
 */

/** Narrower than this, the editor is laid out for a phone. */
export const PHONE_LAYOUT_WIDTH = 640;

export const sheetStyles = css`
  /* After .ui, which takes every property back to its initial value. */
  dialog.sheet {
    background: var(--mq-color-surface);
    border: 0;
    border-radius: var(--mq-radius-large) var(--mq-radius-large) 0 0;
    box-shadow: var(--mq-shadow);
    color: var(--mq-color-text);
    display: flex;
    flex-direction: column;
    inset: auto 0 0;
    margin: 0;
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    max-width: none;
    overflow: hidden;
    padding: var(--mq-space-2) 0 env(safe-area-inset-bottom);
    position: fixed;
    width: 100%;
  }

  /*
   * It takes focus itself as it opens, so a touch leaves no ring on its first
   * control, and a screen reader starts at its name. From the keyboard, focus
   * goes on to what it's opened for.
   */
  dialog.sheet:focus {
    outline: none;
  }

  /* Opened in the update that draws it, and gone in the one that closes it. */
  dialog.sheet:not([open]) {
    display: none;
  }

  dialog.sheet::backdrop {
    background: var(--mq-color-scrim);
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog.sheet[open] {
      animation: sheet-in 220ms cubic-bezier(0.2, 0, 0, 1);
    }

    dialog.sheet[open]::backdrop {
      animation: scrim-in 220ms ease-out;
    }
  }

  @keyframes sheet-in {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  @keyframes scrim-in {
    from {
      opacity: 0;
    }
  }

  /*
   * Dragged down, it closes the sheet, as on a phone's own sheets. It's
   * drawn small, in a strip as wide as the sheet that a finger finds.
   */
  .sheet-grab {
    cursor: grab;
    display: flex;
    flex: none;
    justify-content: center;
    margin-block: calc(-1 * var(--mq-space-2)) var(--mq-space-1);
    padding: var(--mq-space-2) 0 var(--mq-space-1);
    touch-action: none;
    width: 100%;
  }

  .sheet-grab::before {
    background: var(--mq-color-border-strong);
    border-radius: 3px;
    content: "";
    height: 5px;
    opacity: 0.5;
    width: 36px;
  }

  /*
   * Its name at the start, or between a back arrow and Done in a sheet opened
   * from another, as the frames draw them.
   */
  .sheet-head {
    align-items: center;
    display: grid;
    flex: none;
    gap: var(--mq-space-2);
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0 var(--mq-space-4) var(--mq-space-3);
  }

  .sheet-head:has(> .sheet-back) {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    padding-inline-start: var(--mq-space-2);
    text-align: center;
  }

  .sheet-head:has(> .sheet-back) .sheet-done {
    justify-self: end;
  }

  .sheet-title {
    font-size: var(--_mq-font-size-sheet-title);
    font-weight: 600;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .sheet-subtitle {
    color: var(--mq-color-text-muted);
    margin: 0;
  }

  .sheet-head .sheet-back {
    height: 44px;
    width: 44px;
  }

  .sheet-head .sheet-done {
    height: 36px;
  }

  /* What's in it scrolls under its head. */
  .sheet-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--mq-space-4) var(--mq-space-4);
  }
`;

export interface SheetHead {
  title: unknown;
  /** Under the title, such as where a Block is. */
  subtitle?: string;
  /**
   * In a sheet opened from another, back to that one. Done closes it too, as
   * the frames give both.
   */
  back?: () => void;
  /** Done, or the sheet's own action in its place, such as Apply. */
  done: (event: MouseEvent) => void;
  /** Done's words, where it does something else, such as "Apply". */
  doneLabel?: string;
  /** The ID of the title, which names the sheet. */
  titleId: string;
}

/** A sheet's name, and its back arrow and Done. */
export const renderSheetHead = (
  { back, done, doneLabel, subtitle, title, titleId }: SheetHead,
  text: Text
) => html`
  <div class="sheet-head">
    ${
      back
        ? html`<button
            aria-label=${text("sheet.back")}
            class="icon-button sheet-back"
            data-action="sheet-back"
            type="button"
            @click=${back}
          >
            ${ICONS.chevronLeft}
          </button>`
        : nothing
    }
    <div>
      <h2 class="sheet-title" id=${titleId}>${title}</h2>
      ${subtitle ? html`<p class="sheet-subtitle">${subtitle}</p>` : nothing}
    </div>
    <button
      class=${doneLabel ? "text-button primary sheet-done" : "text-button sheet-done"}
      data-action="sheet-done"
      type="button"
      @click=${done}
    >
      ${doneLabel ?? text("sheet.done")}
    </button>
  </div>
`;

/** How far a sheet is dragged down by its grab before it closes. */
const CLOSE_DRAG_PX = 80;

/**
 * Moves the sheet with a drag down from its grab, and closes it past
 * `CLOSE_DRAG_PX`, or else puts it back. Done and Escape close it too.
 */
const dragToClose = (event: PointerEvent, onClose: () => void) => {
  const grab = event.currentTarget as HTMLElement;
  const sheet = grab.closest("dialog");
  if (!sheet) {
    return;
  }
  const from = event.clientY;
  let down = 0;
  grab.setPointerCapture(event.pointerId);
  const move = ({ clientY }: PointerEvent) => {
    down = Math.max(0, clientY - from);
    sheet.style.translate = `0 ${down}px`;
  };
  const end = () => {
    grab.removeEventListener("pointermove", move);
    grab.removeEventListener("pointerup", end);
    grab.removeEventListener("pointercancel", end);
    sheet.style.removeProperty("translate");
    if (down > CLOSE_DRAG_PX) {
      onClose();
    }
  };
  grab.addEventListener("pointermove", move);
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);
};

/** Whether a press is on the dialog's backdrop, outside the sheet. */
const isOutside = (sheet: HTMLDialogElement, event: MouseEvent) => {
  if (event.target !== sheet) {
    return false;
  }
  const { bottom, left, right, top } = sheet.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x < left || x > right || y < top || y > bottom;
};

/**
 * A key the editor answered, such as Escape closing a popover inside the
 * sheet, stops the browser closing the sheet too, as the browser doesn't
 * close a dialog on an Escape whose keydown was cancelled. `onClose` closes
 * it otherwise, by the editor's state, as a press on the dimmed email does.
 */
export const renderSheet = ({
  body,
  className = "",
  head,
  labelledBy,
  onClose,
  sheetPlace,
  style,
  testId,
}: {
  body: unknown;
  className?: string;
  head?: TemplateResult;
  /** The ID of what names it, which is its title. */
  labelledBy: string;
  onClose: () => void;
  sheetPlace?: Place;
  /** Custom properties for what's in it. */
  style?: Record<string, string | undefined>;
  testId?: string;
}) => html`
  <dialog
    aria-labelledby=${labelledBy}
    class=${`ui sheet ${className}`}
    data-place=${sheetPlace ? place(sheetPlace) : nothing}
    data-testid=${testId ?? nothing}
    style=${styleProperties(style ?? {})}
    tabindex="-1"
    @cancel=${(event: Event) => {
      // The editor's state takes it away, rather than the browser.
      event.preventDefault();
      onClose();
    }}
    @pointerdown=${(event: PointerEvent) => {
      const sheet = event.currentTarget as HTMLDialogElement;
      sheet.toggleAttribute("data-pressed-outside", isOutside(sheet, event));
    }}
    @click=${(event: MouseEvent) => {
      const sheet = event.currentTarget as HTMLDialogElement;
      // A press on the dimmed email, which the dialog's backdrop is, from
      // start to end, not one that began in the sheet, such as a drag
      // across a field's text.
      if (
        Object.hasOwn(sheet.dataset, "pressedOutside") &&
        isOutside(sheet, event)
      ) {
        onClose();
      }
    }}
  >
    <span
      aria-hidden="true"
      class="sheet-grab"
      data-testid="sheet-grab"
      @pointerdown=${(event: PointerEvent) => dragToClose(event, onClose)}
    ></span>
    ${head ?? nothing}
    <div class="sheet-body thin-scrollbar">${body}</div>
  </dialog>
`;

/**
 * Opens each sheet an update drew, before focus moves, so the place the
 * editor sends focus to is in an open dialog. One drawn inside another opens
 * after it, so it's in front.
 */
export const openSheets = (root: ParentNode) => {
  for (const sheet of root.querySelectorAll<HTMLDialogElement>(
    "dialog.sheet:not([open])"
  )) {
    // Not one in a Mode that's hidden, such as More left open in Edit while
    // Check shows, which would make the page inert with nothing to see.
    if (sheet.isConnected && !sheet.parentElement?.closest("[hidden]")) {
      sheet.showModal();
      // Rather than its first control, as the browser would.
      sheet.focus({ preventScroll: true });
    }
  }
};
