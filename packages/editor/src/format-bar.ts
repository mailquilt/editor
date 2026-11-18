import { INVALID_LINK, isAllowedLinkHref } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { ICONS } from "./icons.js";
import type { KeyLabel } from "./key-map.js";
import { keyLabel, textKeyLabel } from "./key-map.js";
import type {
  TextBlockView,
  TextFormats,
  ToggleableMark,
} from "./text-block-view.js";

export const formatBarStyles = css`
  /*
   * Below the text being edited, at its end: clear of where the next Block's
   * text starts, and of its drag handle.
   */
  .format-bar {
    flex-wrap: wrap;
    inset-block-start: calc(100% + 6px);
    inset-inline-end: 0;
    max-width: min(360px, calc(100vw - 32px));
    position: absolute;
    width: max-content;
    z-index: 5;
  }

  .link-form {
    align-items: center;
    border-top: 1px solid var(--mq-color-border);
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: 2px;
    padding: var(--mq-space-2) var(--mq-space-1) var(--mq-space-1);
  }

  .link-form label {
    color: var(--mq-color-text-muted);
    display: flex;
    flex: 1 1 100%;
    flex-direction: column;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
    gap: 4px;
  }

  .link-form input {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text);
    height: 30px;
    min-width: 0;
    padding: 0 8px;
    width: 100%;
  }

  .link-form input:focus-visible {
    border-color: var(--mq-color-accent);
    box-shadow: 0 0 0 3px var(--mq-color-accent-soft);
    outline-offset: -1px;
  }

  .link-form p {
    color: var(--mq-color-danger);
    flex-basis: 100%;
    font-size: var(--mq-font-size-small);
    margin: 0;
  }
`;

const MARK_BUTTONS: {
  keys: KeyLabel;
  label: string;
  mark: ToggleableMark;
}[] = [
  { keys: textKeyLabel("bold"), label: "Bold", mark: "bold" },
  { keys: textKeyLabel("italic"), label: "Italic", mark: "italic" },
  { keys: textKeyLabel("underline"), label: "Underline", mark: "underline" },
];

const LINK_KEYS = keyLabel("text", "openLinkField");
const LINE_BREAK_KEYS = textKeyLabel("lineBreak");

export interface FormatBarState {
  /** Unset until the Block's text has its editor, and the buttons wait for it. */
  formats: TextFormats | undefined;
  /**
   * Set while the link field is open. Each refusal counts, so the same one again
   * is a new alert and is read out.
   */
  linkForm: { refusals: number } | undefined;
}

export interface FormatBarEvents {
  onCancelLink: () => void;
  onControlMousedown: (event: MouseEvent) => void;
  onLineBreak: () => void;
  onOpenLinkForm: () => void;
  onRemoveLink: () => void;
  onSubmitLink: (href: string) => void;
  onToggleMark: (mark: ToggleableMark) => void;
}

interface LinkFormHost {
  /** The selected Block's text, where the link goes. */
  view: () => TextBlockView | undefined;
  /** Whether focus is in that text, so the format bar already shows. */
  editingText: () => boolean;
  /** Moves focus to the field, once the next update has rendered it. */
  focusField: () => Promise<void>;
  /** Moves focus back to the text. */
  focusText: () => void;
  requestUpdate: () => void;
}

/** The link field: open or closed, and what its buttons do. */
export const createLinkForm = (host: LinkFormHost) => {
  let state: FormatBarState["linkForm"];

  const close = () => {
    if (state) {
      state = undefined;
      host.requestUpdate();
    }
  };

  /** From the Block itself too: its text takes focus, and shows the format bar. */
  const open = async () => {
    const view = host.view();
    if (!view) {
      return;
    }
    if (!host.editingText()) {
      host.focusText();
    }
    state = { refusals: 0 };
    host.requestUpdate();
    await host.focusField();
  };

  const events: Pick<
    FormatBarEvents,
    "onCancelLink" | "onOpenLinkForm" | "onRemoveLink" | "onSubmitLink"
  > = {
    onCancelLink: () => {
      close();
      host.focusText();
    },
    onOpenLinkForm: open,
    onRemoveLink: () => {
      close();
      host.view()?.removeLink();
    },
    onSubmitLink: (href) => {
      if (!isAllowedLinkHref(href)) {
        state = { refusals: (state?.refusals ?? 0) + 1 };
        host.requestUpdate();
        return;
      }
      close();
      host.view()?.setLink(href);
    },
  };

  return {
    close,
    events,
    open,
    get state() {
      return state;
    },
  };
};

/** For what has to stay with the element it happened in. */
const stopPropagation = (event: Event) => event.stopPropagation();

const renderLinkForm = (
  refusals: number,
  href: string | undefined,
  events: FormatBarEvents
) => html`
  <form
    class="link-form"
    novalidate
    @beforeinput=${stopPropagation}
    @submit=${(event: SubmitEvent) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      events.onSubmitLink(String(new FormData(form).get("href")).trim());
    }}
  >
    <label>
      Link URL
      <input
        aria-describedby=${refusals ? "link-error" : nothing}
        aria-invalid=${refusals ? "true" : "false"}
        autocomplete="off"
        name="href"
        spellcheck="false"
        type="text"
        value=${href ?? ""}
      />
    </label>
    <button class="text-button primary" type="submit">Apply</button>
    ${
      href === undefined
        ? nothing
        : html`
            <button
              class="text-button"
              type="button"
              @click=${events.onRemoveLink}
            >
              Remove link
            </button>
          `
    }
    <button class="text-button" type="button" @click=${events.onCancelLink}>
      Cancel
    </button>
    ${
      refusals
        ? keyed(
            refusals,
            html`<p id="link-error" role="alert">${INVALID_LINK}</p>`
          )
        : nothing
    }
  </form>
`;

/**
 * Next to the text being edited. Alt+F10 reaches it from the text and Escape
 * goes back, so it takes no stop of its own from Tab.
 */
export const renderFormatBar = (
  { formats, linkForm }: FormatBarState,
  events: FormatBarEvents
) => {
  // Its name, not a pressed state, says the text is in a link, as pressing it
  // opens the link field rather than taking the link away.
  const linkLabel = formats?.linkHref === undefined ? "Link" : "Edit link";
  return html`
    <div
      aria-label="Text formatting"
      class="ui bar format-bar"
      role="toolbar"
      @mousedown=${events.onControlMousedown}
    >
      ${MARK_BUTTONS.map(
        ({ keys, label, mark }) => html`
          <button
            aria-keyshortcuts=${keys.shortcuts}
            aria-label=${label}
            aria-pressed=${formats?.[mark] ? "true" : "false"}
            class="icon-button"
            data-tooltip=${`${label} (${keys.keys})`}
            ?disabled=${!formats || (mark === "bold" && !formats.canBold)}
            tabindex="-1"
            type="button"
            @click=${() => events.onToggleMark(mark)}
          >
            ${ICONS[mark]}
          </button>
        `
      )}
      <span class="separator"></span>
      <button
        aria-expanded=${linkForm ? "true" : "false"}
        aria-keyshortcuts=${LINK_KEYS.shortcuts}
        aria-label=${linkLabel}
        class="icon-button"
        ?data-active=${formats?.linkHref !== undefined}
        data-tooltip=${`${linkLabel} (${LINK_KEYS.keys})`}
        ?disabled=${!formats}
        tabindex="-1"
        type="button"
        @click=${events.onOpenLinkForm}
      >
        ${ICONS.link}
      </button>
      <button
        aria-keyshortcuts=${LINE_BREAK_KEYS.shortcuts}
        aria-label="Line break"
        class="icon-button"
        data-tooltip=${`Line break (${LINE_BREAK_KEYS.keys})`}
        ?disabled=${!formats}
        tabindex="-1"
        type="button"
        @click=${events.onLineBreak}
      >
        ${ICONS.lineBreak}
      </button>
      ${linkForm ? renderLinkForm(linkForm.refusals, formats?.linkHref, events) : nothing}
    </div>
  `;
};
