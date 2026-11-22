import { INVALID_LINK, isAllowedLinkHref } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import type { KeyLabel } from "./key-map.js";
import { keyLabel, textKeyLabel } from "./key-map.js";
import { fieldTags } from "./merge-tag-picker.js";
import type { OwnPanelsApi, PanelApi } from "./panel-api.js";
import type { TextBlockView } from "./text-block-view.js";
import type { ToggleableMark } from "./text-commands.js";

export const formatBarStyles = css`
  /*
   * Below the text being edited, at its end: clear of where the next Block's
   * text starts, and of its drag handle. Moved from here where there's no room
   * (tool-fitting.ts).
   */
  .format-bar {
    flex-wrap: wrap;
    inset-block-start: calc(100% + 6px);
    inset-inline-end: 0;
    max-width: min(360px, calc(100vw - 32px));
    position: absolute;
    width: max-content;
    /* Over the floating toolbar, as the Block's toolbar is. */
    z-index: var(--_mq-layer-block-tools);
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

  .link-form .description {
    color: var(--mq-color-text-muted);
  }

  .link-form .field-merge-tag-picker {
    flex-basis: 100%;
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

interface LinkFormHost {
  /** The selected Block's text, where the link goes. */
  view: () => TextBlockView | undefined;
  /** Whether focus is in that text, so the format bar already shows. */
  editingText: () => boolean;
  /** Moves focus to the field, once the next update has rendered it. */
  focusField: () => void;
  /** Moves focus back to the text. */
  focusText: () => void;
  requestUpdate: () => void;
}

/** The link field: open or closed, and what its buttons do. */
export const createLinkForm = ({
  editingText,
  focusField,
  focusText,
  requestUpdate,
  view,
}: LinkFormHost) => {
  let state: OwnPanelsApi["linkField"];

  const close = () => {
    if (state) {
      state = undefined;
      requestUpdate();
    }
  };

  /**
   * From the Block itself too: its text takes focus, and shows the format bar.
   * Focus in the text closes the field, so the text takes it first.
   */
  const open = () => {
    if (!view()) {
      return;
    }
    if (!editingText()) {
      focusText();
    }
    state = { refusals: 0 };
    requestUpdate();
    focusField();
  };

  const cancel = () => {
    close();
    focusText();
  };

  const remove = () => {
    close();
    view()?.removeLink();
  };

  const submit = (href: string) => {
    if (!isAllowedLinkHref(href)) {
      state = { refusals: (state?.refusals ?? 0) + 1 };
      requestUpdate();
      return;
    }
    close();
    view()?.setLink(href);
  };

  return {
    cancel,
    close,
    open,
    remove,
    get state() {
      return state;
    },
    submit,
  };
};

const LINK_URL_ID = "link-url";

const renderLinkForm = (
  refusals: number,
  href: string | undefined,
  api: PanelApi
) => {
  const tags = fieldTags(api)(LINK_URL_ID);
  const describedBy = [
    tags.hint ? "link-description" : "",
    refusals ? "link-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return html`
    <form
      class="link-form"
      data-place=${place("linkField")}
      novalidate
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        api.submitLink(String(new FormData(form).get("href")).trim());
      }}
    >
      <label>
        Link URL
        <input
          aria-activedescendant=${tags.activeDescendant}
          aria-controls=${tags.controls}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${refusals ? "true" : "false"}
          autocomplete="off"
          ?data-merge-tags=${tags.hint !== ""}
          id=${LINK_URL_ID}
          name="href"
          spellcheck="false"
          type="text"
          value=${href ?? ""}
        />
      </label>
      ${tags.list}
      ${
        tags.hint
          ? html`<p class="description" id="link-description">${tags.hint}</p>`
          : nothing
      }
      <button class="text-button primary" type="submit">Apply</button>
      ${
        href === undefined
          ? nothing
          : html`
              <button
                class="text-button"
                type="button"
                @click=${api.removeLink}
              >
                Remove link
              </button>
            `
      }
      <button class="text-button" type="button" @click=${api.cancelLink}>
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
};

/**
 * Next to the text being edited. Alt+F10 reaches it from the text and Escape
 * goes back, so it takes no stop of its own from Tab.
 */
export const renderFormatBar = (api: PanelApi) => {
  const { formats, linkField } = api;
  // Its name, not a pressed state, says the text is in a link, as pressing it
  // opens the link field rather than taking the link away.
  const linkLabel = formats?.linkHref === undefined ? "Link" : "Edit link";
  return html`
    <div
      aria-label="Text formatting"
      class="ui bar format-bar"
      data-place=${place("formatBar")}
      role="toolbar"
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
            @click=${() => api.toggleMark(mark)}
          >
            ${ICONS[mark]}
          </button>
        `
      )}
      <span class="separator"></span>
      <button
        aria-expanded=${linkField ? "true" : "false"}
        aria-keyshortcuts=${LINK_KEYS.shortcuts}
        aria-label=${linkLabel}
        class="icon-button"
        ?data-active=${formats?.linkHref !== undefined}
        data-tooltip=${`${linkLabel} (${LINK_KEYS.keys})`}
        ?disabled=${!formats}
        tabindex="-1"
        type="button"
        @click=${api.openLinkField}
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
        @click=${api.insertLineBreak}
      >
        ${ICONS.lineBreak}
      </button>
      ${
        api.insertMergeTag
          ? html`
              <button
                aria-label="Merge Tag"
                class="icon-button"
                data-tooltip="Merge Tag (type {{)"
                ?disabled=${!formats}
                tabindex="-1"
                type="button"
                @click=${api.insertMergeTag}
              >
                ${ICONS.mergeTag}
              </button>
            `
          : nothing
      }
      ${linkField ? renderLinkForm(linkField.refusals, formats?.linkHref, api) : nothing}
    </div>
  `;
};
