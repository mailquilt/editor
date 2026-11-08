import { loadDocument } from "@mailquilt/core";
import type { BlocksDocument, LoadResult } from "@mailquilt/core";
import { css, html, LitElement, nothing, unsafeCSS } from "lit";

import "./mail-quilt.js";
import type { MailQuilt } from "./mail-quilt.js";
import { themeTokens, uiStyles } from "./theme.js";

export type ShellVariant = "advanced" | "simple";

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
    heading: {},
    saveKey: { attribute: "save-key" },
    variant: { reflect: true },
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
      }

      mail-quilt {
        flex: 1 0 auto;
      }
    `,
  ];

  declare heading: string;
  /** Where the email is kept in the browser. Without it, nothing is stored. */
  declare saveKey: string | undefined;
  declare variant: ShellVariant;

  readonly #editor: MailQuilt = document.createElement("mail-quilt");
  /** Whether the email to open has been chosen, which waits for the first update. */
  #started = false;
  /** The `value` set before then. */
  #pendingValue: BlocksDocument | undefined;
  /** Whether a `value` has been set yet. A saved email stands in for the first. */
  #hasValue = false;
  #openedSavedEmail = false;
  /** Set while the browser can't save the email. */
  #cantSave = false;
  /** The latest refused email or failed export, until the next change. */
  #notice: string | undefined;

  constructor() {
    super();
    this.heading = "Email";
    this.variant = "simple";
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

  /** As on `<mail-quilt>`. With `save-key`, a saved email opens instead of the first. */
  set value(document: BlocksDocument | undefined) {
    const first = !this.#hasValue;
    this.#hasValue = true;
    if (!this.#started) {
      this.#pendingValue = document;
      return;
    }
    if (!(first && this.#openedSavedEmail)) {
      this.#editor.value = document;
    }
  }

  /** As on `<mail-quilt>`. */
  async exportHtml() {
    return await this.#editor.exportHtml();
  }

  protected override willUpdate() {
    if (!this.#started && this.isConnected) {
      this.#start();
    }
  }

  protected override render() {
    const advanced = this.variant === "advanced";
    const messages = [
      this.#cantSave &&
        (advanced
          ? "This browser can't save your email here. Export it as JSON to keep it."
          : "This browser can't save your email here."),
      this.#notice,
    ].filter(Boolean);

    return html`
      <div class="ui shell">
        <div class="header">
          <h2 class="heading">${this.heading}</h2>
          <div class="actions">
            ${
              advanced
                ? html`
                    <button
                      class="text-button"
                      type="button"
                      @click=${this.#chooseFile}
                    >
                      Import JSON
                    </button>
                    <button
                      class="text-button"
                      type="button"
                      @click=${this.#exportJson}
                    >
                      Export JSON
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
            <button
              class="text-button primary"
              type="button"
              @click=${this.#exportHtmlFile}
            >
              Export HTML
            </button>
          </div>
        </div>
        <div class="messages">
          ${messages.map((message) => html`<p role="alert">${message}</p>`)}
        </div>
        <div class="body">${this.#editor}</div>
      </div>
    `;
  }

  /** The email saved under `save-key` opens instead of `value`, if it can be. */
  #start() {
    this.#started = true;
    if (this.saveKey !== undefined) {
      this.#openSavedEmail(this.saveKey);
    }
    if (!this.#openedSavedEmail) {
      this.#editor.value = this.#pendingValue;
    }
    this.#pendingValue = undefined;
  }

  #openSavedEmail(key: string) {
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
    if (loaded.ok) {
      this.#editor.value = loaded.document;
      this.#openedSavedEmail = true;
    } else {
      this.#notice = `Your saved email couldn't be opened: ${loaded.reason}`;
    }
  }

  /** Saves a changed email, which also answers whatever went wrong before it. */
  #keep(document: BlocksDocument) {
    if (this.saveKey !== undefined) {
      try {
        localStorage.setItem(this.saveKey, JSON.stringify(document));
        this.#cantSave = false;
      } catch {
        this.#cantSave = true;
      }
    }
    this.#showNotice(undefined);
  }

  #showNotice(notice: string | undefined) {
    this.#notice = notice;
    this.requestUpdate();
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
