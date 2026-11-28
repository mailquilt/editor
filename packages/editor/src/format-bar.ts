import { isAllowedLinkHref } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import type { KeyLabel } from "./key-map.js";
import { keyLabel, textKeyLabel, withKeys } from "./key-map.js";
import { fieldTags } from "./merge-tag-picker.js";
import type { OwnPanelsApi, PanelApi } from "./panel-api.js";
import { renderSheet, renderSheetHead } from "./sheet.js";
import type { StringId } from "./strings.js";
import type { TextBlockView } from "./text-block-view.js";
import type { ListType, ToggleableMark } from "./text-commands.js";

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

  /*
   * On a phone, at the bottom of the screen, above the keyboard, while the
   * text is typed in, as frame p06 draws it.
   */
  .app[data-phone] .format-bar {
    border-inline: 0;
    border-block-end: 0;
    border-radius: 0;
    bottom: var(--_mq-keyboard-inset, 0px);
    flex-wrap: nowrap;
    inset-block-start: auto;
    inset-inline: 0;
    justify-content: space-between;
    max-width: none;
    overflow-x: auto;
    padding: var(--mq-space-1) var(--mq-space-2);
    position: fixed;
    /* Over where tool-fitting.ts would move it beside the text. */
    translate: none !important;
    width: auto;
    z-index: var(--_mq-layer-top-bar);
  }

  .app[data-phone] .format-bar > .icon-button {
    flex: 1 1 0;
    height: 44px;
    max-width: 44px;
    min-width: 32px;
    width: auto;
  }

  /* On a phone, the link field is a sheet, as frame p17 draws it. */
  dialog.sheet .link-form {
    border: 0;
    margin: 0;
    padding: 0;
  }

  dialog.sheet .link-form input {
    height: 44px;
  }

  dialog.sheet .link-form .text-button {
    flex: 1 1 100%;
    height: 44px;
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
  label: StringId;
  mark: ToggleableMark;
}[] = [
  { keys: textKeyLabel("bold"), label: "format.bold", mark: "bold" },
  { keys: textKeyLabel("italic"), label: "format.italic", mark: "italic" },
  {
    keys: textKeyLabel("underline"),
    label: "format.underline",
    mark: "underline",
  },
];

const LIST_BUTTONS: {
  keys: KeyLabel;
  label: StringId;
  list: ListType;
}[] = [
  {
    keys: textKeyLabel("bulletList"),
    label: "format.bulletList",
    list: "bulletList",
  },
  {
    keys: textKeyLabel("orderedList"),
    label: "format.numberedList",
    list: "orderedList",
  },
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
  const linkForm = html`
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
        ${api.text("format.linkUrl")}
        <input
          aria-activedescendant=${tags.activeDescendant}
          aria-controls=${tags.controls}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${refusals ? "true" : "false"}
          autocomplete="off"
          ?data-merge-tags=${tags.takesTags}
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
      <button class="text-button primary" ?hidden=${api.phone} type="submit">
        ${api.text("format.applyLink")}
      </button>
      ${
        href === undefined
          ? nothing
          : html`
              <button
                class="text-button"
                type="button"
                @click=${api.removeLink}
              >
                ${api.text("format.removeLink")}
              </button>
            `
      }
      <button
        class="text-button"
        ?hidden=${api.phone}
        type="button"
        @click=${api.cancelLink}
      >
        ${api.text("format.cancelLink")}
      </button>
      ${
        refusals
          ? keyed(
              refusals,
              html`<p id="link-error" role="alert">
                ${api.text("invalid.link")}
              </p>`
            )
          : nothing
      }
    </form>
  `;
  if (!api.phone) {
    return linkForm;
  }
  // Apply is the sheet's own button, in Done's place, as frame p17 draws it.
  return renderSheet({
    body: linkForm,
    className: "link-sheet",
    head: renderSheetHead(
      {
        done: ({ currentTarget }: MouseEvent) =>
          (currentTarget as Element)
            .closest("dialog")
            ?.querySelector("form")
            ?.requestSubmit(),
        doneLabel: api.text("format.applyLink"),
        title: api.text("format.link"),
        titleId: "link-title",
      },
      api.text
    ),
    labelledBy: "link-title",
    onClose: api.cancelLink,
    // So Escape anywhere in it cancels the link, as in its field.
    sheetPlace: "linkField",
  });
};

/**
 * Next to the text being edited. Alt+F10 reaches it from the text and Escape
 * goes back, so it takes no stop of its own from Tab.
 */
export const renderFormatBar = (api: PanelApi) => {
  const { formats, linkField, text } = api;
  // Its name, not a pressed state, says the text is in a link, as pressing it
  // opens the link field rather than taking the link away.
  const linkLabel = text(
    formats?.linkHref === undefined ? "format.link" : "format.editLink"
  );
  return html`
    <div
      aria-label=${text("format.bar")}
      class="ui bar format-bar"
      data-place=${place("formatBar")}
      role="toolbar"
    >
      ${MARK_BUTTONS.map(
        ({ keys, label, mark }) => html`
          <button
            aria-keyshortcuts=${keys.shortcuts}
            aria-label=${text(label)}
            aria-pressed=${formats?.[mark] ? "true" : "false"}
            class="icon-button"
            data-tooltip=${withKeys(text(label), keys.keys, text)}
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
      ${LIST_BUTTONS.map(
        ({ keys, label, list }) => html`
          <button
            aria-keyshortcuts=${keys.shortcuts}
            aria-label=${text(label)}
            aria-pressed=${formats?.list === list ? "true" : "false"}
            class="icon-button"
            data-tooltip=${withKeys(text(label), keys.keys, text)}
            ?disabled=${!formats?.canList}
            tabindex="-1"
            type="button"
            @click=${() => api.toggleList(list)}
          >
            ${ICONS[list]}
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
        data-tooltip=${withKeys(linkLabel, LINK_KEYS.keys, text)}
        ?disabled=${!formats}
        tabindex="-1"
        type="button"
        @click=${api.openLinkField}
      >
        ${ICONS.link}
      </button>
      <button
        aria-keyshortcuts=${LINE_BREAK_KEYS.shortcuts}
        aria-label=${text("format.lineBreak")}
        class="icon-button"
        data-tooltip=${withKeys(
          text("format.lineBreak"),
          LINE_BREAK_KEYS.keys,
          text
        )}
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
                aria-label=${text("format.mergeTag")}
                class="icon-button"
                data-tooltip=${text("format.mergeTagKeys")}
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
