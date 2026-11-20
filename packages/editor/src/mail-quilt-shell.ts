import { isSameDocument, loadDocument } from "@mailquilt/core";
import type { BlocksDocument, LoadResult } from "@mailquilt/core";
import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";

import "./mail-quilt.js";
import type { MailQuilt } from "./mail-quilt.js";
import { refuseFiles } from "./refuse-files.js";
import { themeTokens, UI_LANG, uiStyles } from "./theme.js";
import { takeValueSetEarly } from "./value-set-early.js";

/** The Shell's own buttons. */
export type ShellAction = "export-html" | "export-json" | "import-json";

/** Every theme token's name, from the one list that defines them. */
const TOKEN_NAMES = themeTokens.cssText.match(/--mq-[\w-]+(?=\s*:)/gu) ?? [];

/**
 * The editor inside takes the Shell's tokens rather than its own defaults, so
 * a token set on the Shell restyles both.
 */
const inheritTokens = unsafeCSS(
  `mail-quilt { ${TOKEN_NAMES.map((name) => `${name}: inherit;`).join(" ")} }`
);

/** Never throws, as what it reads may have been damaged or edited by hand. */
const parseEmail = (text: string): LoadResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Not valid JSON" };
  }
  return loadDocument(parsed);
};

/** What the host's next `value` does to the open email, once the Shell starts. */
type Opened =
  /**
   * A saved email opened instead of the host's `value`, or of its first one
   * if it hasn't set one yet, or the person imported one instead of that
   * first one. That first one, or a copy of it, doesn't open.
   */
  | "saved"
  /**
   * With `save-key` and no saved email that opens, the host's first `value`
   * opened, when it was set. A copy of it doesn't open, so the person's work
   * stays.
   */
  | "first"
  /**
   * Every `value` the host sets opens, as on `<mail-quilt>`: without
   * `save-key` at the first update, or once the host has set a different email.
   */
  | "open";

/**
 * Only `#hostSets()`, `#openSaved()` and an import change it. `value` is the
 * host's latest `value`, and `key` is the `save-key` the Shell last read, to
 * tell when it changes.
 */
type Opening =
  /** Before the first update. */
  | { readonly state: "waiting"; readonly value: unknown }
  | {
      readonly state: Opened;
      readonly key: string | null | undefined;
      readonly value: unknown;
    };

/**
 * What a notice in the message bar reports: an export, an import, an email the
 * host set that the editor refused, or a saved email that couldn't be opened.
 * Each is kept apart, so none hides another.
 */
type NoticeOf = "export" | "import" | "refused" | "saved";

/**
 * Keeps a saved email that couldn't be opened where nothing saves, as it may
 * only be from a newer version: under `<key>:unopened`, or `:unopened:2` and
 * on if those keep others. The same one opened again isn't kept twice. Throws
 * if the browser can't keep it.
 */
const keepUnopened = (key: string, text: string) => {
  let name = `${key}:unopened`;
  let kept = localStorage.getItem(name);
  for (let count = 2; kept !== null && kept !== text; count += 1) {
    name = `${key}:unopened:${count}`;
    kept = localStorage.getItem(name);
  }
  if (kept === null) {
    localStorage.setItem(name, text);
  }
};

const downloadFile = (name: string, type: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
  // Later, because a browser may still be starting the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * A ready-made editor page: `<mail-quilt>` with a header, Import and Export,
 * and messages. It offers the same `value`, `mq-change`, `mq-error` and
 * `exportHtml()`, and can keep the email in the browser under `save-key`.
 */
export class MailQuiltShell extends LitElement {
  static override properties = {
    actions: {},
    heading: {},
    saveKey: { attribute: "save-key" },
  };

  static override styles = [
    themeTokens,
    uiStyles,
    inheritTokens,
    css`
      :host {
        display: block;
        height: 100%;
      }

      :host([hidden]) {
        display: none;
      }

      .shell {
        display: flex;
        overflow: clip;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .header {
        align-items: center;
        background: var(--mq-color-surface);
        border-block-end: 1px solid var(--mq-color-border);
        display: flex;
        flex: none;
        flex-wrap: wrap;
        gap: var(--mq-space-2) var(--mq-space-3);
        min-height: 48px;
        padding: var(--mq-space-2) var(--mq-space-4);
      }

      .heading {
        flex: 1 1 auto;
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--mq-space-2);
      }

      .messages {
        display: flex;
        flex: none;
        flex-direction: column;
      }

      .messages p {
        background: color-mix(
          in srgb,
          var(--mq-color-danger) 8%,
          var(--mq-color-surface)
        );
        border-block-end: 1px solid
          color-mix(in srgb, var(--mq-color-danger) 25%, var(--mq-color-border));
        color: var(--mq-color-danger);
        margin: 0;
        padding: var(--mq-space-2) var(--mq-space-4);
      }

      /* Everything below the header, scrolling when the email is longer. */
      .body {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
        overflow: auto;
        scrollbar-color: var(--mq-color-border) transparent;
        scrollbar-width: thin;
      }

      mail-quilt {
        flex: 1 0 auto;
      }

      /* The Shell's frame is the editor's, so the editor doesn't draw its own. */
      mail-quilt::part(frame) {
        border-radius: 0;
        box-shadow: none;
      }
    `,
  ];

  /**
   * The buttons to show, by name and separated by spaces. Without it, all of
   * them show. Names the Shell doesn't know are ignored.
   */
  declare actions: string | null | undefined;
  /** "Email" when unset or empty. */
  declare heading: string | null | undefined;
  /** Where the email is kept in the browser. Without it, nothing is stored. */
  declare saveKey: string | null | undefined;

  readonly #editor: MailQuilt = document.createElement("mail-quilt");
  readonly #body = createRef<HTMLElement>();
  readonly #fileInput = createRef<HTMLInputElement>();
  /** The email to open is chosen at the first update, or earlier if asked for. */
  #opening: Opening = { state: "waiting", value: undefined };
  /**
   * Gives the editor the height the email scrolls in, for its side panel. The
   * underscore keeps it apart from the theme tokens, as it isn't one. Made at
   * the first render, as that's when there's a body to observe.
   */
  #bodyObserver: ResizeObserver | undefined;
  /** Set while the browser can't save the email. */
  #cantSave = false;
  /**
   * A `save-key` whose saved email couldn't be opened or copied where nothing
   * saves, so nothing is saved over it.
   */
  #uncopiedKey: string | undefined;
  /**
   * What went wrong, until the next change, or until an import or export
   * works. Each has an ID, so the same notice again is a new alert and is
   * read out.
   */
  readonly #notices = new Map<
    NoticeOf,
    { readonly id: number; readonly text: string }
  >();
  #noticeId = 0;

  constructor() {
    super();
    // Its header is outside <mail-quilt>, which refuses the rest.
    this.addEventListener("dragover", refuseFiles);
    this.addEventListener("drop", refuseFiles);
    takeValueSetEarly(this);
    this.#editor.addEventListener("mq-change", ({ detail }) => {
      this.#keep(detail.document);
    });
    this.#editor.addEventListener("mq-error", ({ detail }) => {
      this.#showNotice(
        "refused",
        `This email couldn't be opened: ${detail.reason}`
      );
    });
  }

  get value(): BlocksDocument | undefined {
    // Started early if need be, as for `exportHtml()`, so this is the email the
    // editor opens: with `save-key`, the saved one.
    if (this.#opening.state === "waiting") {
      this.#openSaved();
    }
    return this.#editor.value;
  }

  /**
   * As on `<mail-quilt>`. With `save-key`, a saved email opens instead of the
   * host's first email. Until the host sets a different one, setting that
   * first email again leaves the open email as it is, saved or typed, as a
   * host that renders again does. While a saved email stands in, so do
   * setting nothing before the first email and that first email set late.
   */
  set value(value: unknown) {
    this.#hostSets(value);
  }

  /** As on `<mail-quilt>`, and also straight after `value` is set. */
  async exportHtml() {
    // The email reaches the editor at the first update, which can be yet to come.
    if (this.#opening.state === "waiting") {
      this.#openSaved();
    }
    if (!this.#editor.value) {
      throw new Error("<mail-quilt-shell> has no document to export");
    }
    return await this.#editor.exportHtml();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#observeBody();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#bodyObserver?.disconnect();
  }

  protected override willUpdate() {
    this.#openSaved();
  }

  protected override firstUpdated() {
    this.#observeBody();
  }

  protected override render() {
    const named = this.actions?.split(/\s+/u);
    const shows = (action: ShellAction) => named?.includes(action) ?? true;
    const cantSave = shows("export-json")
      ? "This browser can't save your email here. Export it as JSON to keep it."
      : "This browser can't save your email here.";
    const buttons: readonly (readonly [ShellAction, string, () => unknown])[] =
      [
        ["import-json", "Import JSON", this.#chooseFile],
        ["export-json", "Export JSON", this.#exportJson],
        ["export-html", "Export HTML", this.#exportHtmlFile],
      ];

    return html`
      <div class="ui frame shell" part="frame">
        <div class="header" part="header">
          <!--
            A heading the host sets is in the host page's language, and takes
            its direction from its own text, as the Shell is left to right.
          -->
          <h2
            class="heading"
            dir=${this.heading ? "auto" : nothing}
            lang=${this.heading ? nothing : UI_LANG}
            part="heading"
          >
            ${this.heading || "Email"}
          </h2>
          <div class="actions" lang=${UI_LANG} part="actions">
            ${buttons.map(([action, label, onClick]) =>
              shows(action)
                ? html`
                    <button
                      class=${
                        action === "export-html"
                          ? "text-button primary"
                          : "text-button"
                      }
                      part=${action}
                      type="button"
                      @click=${onClick}
                    >
                      ${label}
                    </button>
                  `
                : nothing
            )}
            ${
              shows("import-json")
                ? html`
                    <input
                      accept=".json,application/json"
                      data-testid="file-input"
                      hidden
                      type="file"
                      ${ref(this.#fileInput)}
                      @change=${this.#importJson}
                    />
                  `
                : nothing
            }
          </div>
        </div>
        <div class="messages" lang=${UI_LANG} part="messages">
          ${
            this.#cantSave
              ? html`<p part="message" role="alert">${cantSave}</p>`
              : nothing
          }
          ${repeat(
            this.#notices.values(),
            ({ id }) => id,
            ({ text }) => html`<p part="message" role="alert">${text}</p>`
          )}
        </div>
        <div class="body" data-testid="body" ${ref(this.#body)}>
          ${this.#editor}
        </div>
      </div>
    `;
  }

  /** Until the first update, the host's `value` waits for `#openSaved()`. */
  #hostSets(value: unknown) {
    const opening = this.#opening;
    if (opening.state === "waiting") {
      this.#opening = { state: "waiting", value };
      return;
    }
    const isFirst = opening.value === undefined || opening.value === null;
    if (opening.state === "saved" && isFirst) {
      // The host's first email, or nothing yet, which the saved one stands in for.
      this.#opening = { ...opening, value };
      return;
    }
    // With no email open, such as when the editor refused the first one, there's
    // nothing to keep, so a copy goes to the editor and is refused again.
    if (
      opening.state !== "open" &&
      this.#editor.value !== undefined &&
      isSameDocument(value, opening.value)
    ) {
      return;
    }
    // A first email set late opens, and a copy of it then doesn't.
    const state = opening.state === "first" && isFirst ? "first" : "open";
    this.#opening = { key: opening.key, state, value };
    this.#editor.value = value;
  }

  /**
   * The email saved under `save-key` opens instead of the host's `value`, if
   * it can: at the first update, or before it when `value` or `exportHtml()`
   * needs the email, and when `save-key` changes.
   */
  #openSaved() {
    const opening = this.#opening;
    const key = this.saveKey;
    // Also a key set after `exportHtml()` or `value` started the Shell early.
    if (opening.state !== "waiting" && key === opening.key) {
      return;
    }
    // Both were about the last key. Saving under another key, or none, may
    // work, which its next change says.
    this.#cantSave = false;
    this.#notices.delete("saved");
    const saved = key ? this.#readSavedEmail(key) : undefined;
    if (saved) {
      this.#opening = { key, state: "saved", value: opening.value };
      this.#editor.value = saved;
    } else if (opening.state === "waiting") {
      this.#opening = {
        key,
        state: key ? "first" : "open",
        value: opening.value,
      };
      this.#editor.value = opening.value;
    } else {
      // Another key keeps another email. With none saved there, the current
      // email stays, and is saved under it from its next change.
      this.#opening = { ...opening, key };
    }
  }

  /** Once rendered, and again whenever the Shell is put back on the page. */
  #observeBody() {
    const body = this.#body.value;
    if (body) {
      this.#bodyObserver ??= new ResizeObserver(([entry]) => {
        this.#editor.style.setProperty(
          "--_mq-visible-height",
          `${entry?.target.clientHeight ?? 0}px`
        );
      });
      this.#bodyObserver.observe(body);
    }
  }

  /** The email saved under `key`, if there's one that can be opened. */
  #readSavedEmail(key: string) {
    this.#uncopiedKey = undefined;
    let saved: string | null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      this.#cantSave = true;
      return;
    }
    if (saved === null) {
      return;
    }
    const loaded = parseEmail(saved);
    if (!loaded.ok) {
      this.#showNotice(
        "saved",
        `Your saved email couldn't be opened: ${loaded.reason}`
      );
      // The next change is saved over it.
      try {
        keepUnopened(key, saved);
      } catch {
        // Then no change is saved over it, and the Shell says it can't save.
        this.#uncopiedKey = key;
        this.#cantSave = true;
      }
      return;
    }
    return loaded.document;
  }

  /** Saves a changed email, which also answers whatever went wrong before it. */
  #keep(email: BlocksDocument) {
    if (this.saveKey) {
      let cantSave = this.saveKey === this.#uncopiedKey;
      if (!cantSave) {
        try {
          localStorage.setItem(this.saveKey, JSON.stringify(email));
        } catch {
          cantSave = true;
        }
      }
      if (cantSave !== this.#cantSave) {
        this.#cantSave = cantSave;
        this.requestUpdate();
      }
    }
    // Only when there are any, as this runs on every keystroke.
    if (this.#notices.size > 0) {
      this.#notices.clear();
      this.requestUpdate();
    }
  }

  /** Always renders, so the same notice again is read out again. */
  #showNotice(of: NoticeOf, text: string) {
    this.#noticeId += 1;
    this.#notices.set(of, { id: this.#noticeId, text });
    this.requestUpdate();
  }

  #clearNotice(of: NoticeOf) {
    if (this.#notices.delete(of)) {
      this.requestUpdate();
    }
  }

  readonly #exportHtmlFile = async () => {
    if (!this.value) {
      this.#showNotice("export", "There's no email to export.");
      return;
    }
    try {
      downloadFile("email.html", "text/html", await this.exportHtml());
      this.#clearNotice("export");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#showNotice("export", `The HTML couldn't be exported: ${reason}`);
    }
  };

  readonly #exportJson = () => {
    const email = this.value;
    if (!email) {
      this.#showNotice("export", "There's no email to export.");
      return;
    }
    downloadFile(
      "email.json",
      "application/json",
      JSON.stringify(email, null, 2)
    );
    this.#clearNotice("export");
  };

  readonly #chooseFile = () => {
    this.#fileInput.value?.click();
  };

  readonly #importJson = async ({ currentTarget }: Event) => {
    const input = currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // So that choosing the same file again, once it's fixed, is reported too.
    input.value = "";
    if (!file) {
      return;
    }
    let loaded: LoadResult;
    try {
      loaded = parseEmail(await file.text());
    } catch {
      loaded = { ok: false, reason: "The file couldn't be read" };
    }
    if (!loaded.ok) {
      this.#showNotice(
        "import",
        `That file couldn't be imported: ${loaded.reason}`
      );
      return;
    }
    // The email that's open, so nothing changes.
    if (isSameDocument(loaded.document, this.#editor.value)) {
      this.#clearNotice("import");
      return;
    }
    this.#editor.value = loaded.document;
    const email = this.#editor.value;
    if (email) {
      const opening = this.#opening;
      // The person's work, which the host's first email set late can't replace.
      if (opening.state === "first") {
        this.#opening = { ...opening, state: "saved" };
      }
      this.#keep(email);
      this.dispatchEvent(
        new CustomEvent("mq-change", {
          bubbles: true,
          composed: true,
          detail: { document: email },
        })
      );
    }
  };
}

if (!customElements.get("mail-quilt-shell")) {
  customElements.define("mail-quilt-shell", MailQuiltShell);
}

declare global {
  interface HTMLElementTagNameMap {
    "mail-quilt-shell": MailQuiltShell;
  }
}
