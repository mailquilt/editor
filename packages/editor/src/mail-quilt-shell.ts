import { isSameDocument, loadDocument } from "@mailquilt/core";
import type { BlocksDocument, LoadResult } from "@mailquilt/core";
import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import type { PropertyValues } from "lit";

import "./mail-quilt.js";
import type { MailQuilt } from "./mail-quilt.js";
import { themeTokens, uiStyles } from "./theme.js";

/** The Shell's own buttons, in the order the header shows them. */
export type ShellAction = "export-html" | "export-json" | "import-json";

/** Every theme token's name, from the one place they're defined. */
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
    actions: { reflect: true },
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

      /* Framed as the editor is, so it reads as one component on the page. */
      .shell {
        background: var(--mq-color-workspace);
        border-radius: var(--mq-radius);
        /* A ring rather than a border, so it takes no room from the space given. */
        box-shadow: 0 0 0 1px var(--mq-color-border);
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
  /** "Email" when unset. */
  declare heading: string | null | undefined;
  /** Where the email is kept in the browser. Without it, nothing is stored. */
  declare saveKey: string | null | undefined;

  readonly #editor: MailQuilt = document.createElement("mail-quilt");
  /** Whether the email to open has been chosen, which waits for the first update. */
  #started = false;
  /** The `value` set before then. */
  #pendingValue: BlocksDocument | undefined;
  /**
   * Set while the saved email stands in for the host's first email, which it
   * holds once the host has set one. See the `value` setter.
   */
  #savedStandsIn: { replaced: BlocksDocument | undefined } | undefined;
  /** Gives the editor the height the email scrolls in, for its side panel. */
  readonly #bodyObserver = new ResizeObserver(([entry]) => {
    this.#editor.style.setProperty(
      "--mq-visible-height",
      `${entry?.target.clientHeight ?? 0}px`
    );
  });
  /** Set while the browser can't save the email. */
  #cantSave = false;
  /** The latest refused email or failed export, until the next change. */
  #notice: string | undefined;

  constructor() {
    super();
    // As on <mail-quilt>, for a `value` set before this element is defined.
    if (Object.hasOwn(this, "value")) {
      const { value } = this;
      Reflect.deleteProperty(this, "value");
      this.value = value;
    }
    this.heading = "Email";
    this.#editor.addEventListener("mq-change", ({ detail }) => {
      this.#keep(detail.document);
    });
    this.#editor.addEventListener("mq-error", ({ detail }) => {
      this.#showNotice(`This email couldn't be opened: ${detail.reason}`);
    });
  }

  get value() {
    return this.#started ? this.#editor.value : this.#pendingValue;
  }

  /**
   * As on `<mail-quilt>`. With `save-key`, a saved email opens instead of the
   * host's first email. Until the host sets a different one, setting nothing
   * or that first email again leaves the saved email open, as a host that
   * renders again, or sets its email late, does.
   */
  set value(document: BlocksDocument | undefined) {
    if (!this.#started) {
      this.#pendingValue = document;
      return;
    }
    if (this.#savedStandsInFor(document)) {
      return;
    }
    this.#savedStandsIn = undefined;
    this.#editor.value = document;
  }

  /** As on `<mail-quilt>`. */
  async exportHtml() {
    return await this.#editor.exportHtml();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#observeBody();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#bodyObserver.disconnect();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (!this.#started) {
      this.#start();
    } else if (changed.has("saveKey") && this.saveKey) {
      // Another key keeps another email. With none saved there, the current
      // email is saved under it from its next change.
      this.#openSavedEmail(this.saveKey);
    }
  }

  protected override firstUpdated() {
    this.#observeBody();
  }

  protected override render() {
    const named = this.actions?.split(/\s+/u);
    const shows = (action: ShellAction) => named?.includes(action) ?? true;
    const messages = [
      this.#cantSave &&
        (shows("export-json")
          ? "This browser can't save your email here. Export it as JSON to keep it."
          : "This browser can't save your email here."),
      this.#notice,
    ].filter(Boolean);

    return html`
      <div class="ui shell">
        <div class="header" part="header">
          <h2 class="heading" part="heading">${this.heading ?? "Email"}</h2>
          <div class="actions" part="actions">
            ${
              shows("import-json")
                ? html`
                    <button
                      class="text-button"
                      part="import-json"
                      type="button"
                      @click=${this.#chooseFile}
                    >
                      Import JSON
                    </button>
                    <input
                      accept=".json,application/json"
                      hidden
                      type="file"
                      @change=${this.#importJson}
                    />
                  `
                : nothing
            }
            ${
              shows("export-json")
                ? html`
                    <button
                      class="text-button"
                      part="export-json"
                      type="button"
                      @click=${this.#exportJson}
                    >
                      Export JSON
                    </button>
                  `
                : nothing
            }
            ${
              shows("export-html")
                ? html`
                    <button
                      class="text-button primary"
                      part="export-html"
                      type="button"
                      @click=${this.#exportHtmlFile}
                    >
                      Export HTML
                    </button>
                  `
                : nothing
            }
          </div>
        </div>
        <div class="messages" part="messages">
          ${messages.map(
            (message) => html`<p part="message" role="alert">${message}</p>`
          )}
        </div>
        <div class="body">${this.#editor}</div>
      </div>
    `;
  }

  /** The email saved under `save-key` opens instead of `value`, if it can be. */
  #start() {
    this.#started = true;
    if (this.saveKey && this.#openSavedEmail(this.saveKey)) {
      this.#savedStandsIn = { replaced: this.#pendingValue };
    } else {
      this.#editor.value = this.#pendingValue;
    }
    this.#pendingValue = undefined;
  }

  /** Whether the saved email stays open in place of this `value`. */
  #savedStandsInFor(document: BlocksDocument | undefined) {
    const standIn = this.#savedStandsIn;
    if (!standIn) {
      return false;
    }
    if (standIn.replaced === undefined) {
      // The host's first email, or nothing yet.
      standIn.replaced = document;
      return true;
    }
    return isSameDocument(document, standIn.replaced);
  }

  /** Once rendered, and again whenever the Shell is put back on the page. */
  #observeBody() {
    const body = this.renderRoot.querySelector(".body");
    if (body) {
      this.#bodyObserver.observe(body);
    }
  }

  /** Returns whether it opened. */
  #openSavedEmail(key: string) {
    let saved: string | null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      this.#cantSave = true;
      return false;
    }
    if (saved === null) {
      return false;
    }
    const loaded = parseEmail(saved);
    if (!loaded.ok) {
      this.#notice = `Your saved email couldn't be opened: ${loaded.reason}`;
      return false;
    }
    this.#editor.value = loaded.document;
    return true;
  }

  /** Saves a changed email, which also answers whatever went wrong before it. */
  #keep(document: BlocksDocument) {
    if (this.saveKey) {
      let cantSave = false;
      try {
        localStorage.setItem(this.saveKey, JSON.stringify(document));
      } catch {
        cantSave = true;
      }
      if (cantSave !== this.#cantSave) {
        this.#cantSave = cantSave;
        this.requestUpdate();
      }
    }
    this.#showNotice(undefined);
  }

  /** Renders only when the message changes, as this runs on every keystroke. */
  #showNotice(notice: string | undefined) {
    if (notice !== this.#notice) {
      this.#notice = notice;
      this.requestUpdate();
    }
  }

  readonly #exportHtmlFile = async () => {
    try {
      downloadFile("email.html", "text/html", await this.exportHtml());
      this.#showNotice(undefined);
    } catch (error) {
      this.#showNotice(`The HTML couldn't be exported: ${String(error)}`);
    }
  };

  readonly #exportJson = () => {
    const document = this.value;
    if (document) {
      downloadFile(
        "email.json",
        "application/json",
        JSON.stringify(document, null, 2)
      );
    } else {
      this.#showNotice("There's no email to export.");
    }
  };

  readonly #chooseFile = () => {
    this.renderRoot
      .querySelector<HTMLInputElement>("input[type=file]")
      ?.click();
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
      this.#showNotice(`That file couldn't be imported: ${loaded.reason}`);
      return;
    }
    this.#editor.value = loaded.document;
    const document = this.#editor.value;
    if (document) {
      this.#keep(document);
      this.dispatchEvent(
        new CustomEvent("mq-change", {
          bubbles: true,
          composed: true,
          detail: { document },
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
