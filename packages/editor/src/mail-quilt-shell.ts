import { isSameDocument, loadDocument } from "@mailquilt/core";
import type { BlocksDocument, LoadResult } from "@mailquilt/core";
import { css, html, LitElement, nothing, render, unsafeCSS } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";

import { HOST_APP_PROPERTIES } from "./host-app.js";
import type { HostAppProperties } from "./host-app.js";
import { ICONS } from "./icons.js";
import "./mail-quilt.js";
import type { MailQuilt } from "./mail-quilt.js";
import { refuseFiles } from "./refuse-files.js";
import type { StringId } from "./strings.js";
import { createText } from "./text.js";
import type { Text } from "./text.js";
import { themeTokens, uiStyles } from "./theme.js";
import { takeValueSetEarly } from "./value-set-early.js";

/** The Shell's own buttons. */
export type ShellAction = "export-html" | "export-json" | "import-json";

/** The Shell's menus in the top bar: Export, and ⋯ with Import JSON. */
type Menu = "export" | "more";

/** Where focus goes in a menu once it's drawn. */
type MenuFocus = "button" | "first" | "last";

interface MenuItem {
  action: ShellAction;
  /** What the item gives the person, under its name. */
  help?: string;
  icon: TemplateResult;
  label: string;
  run: () => unknown;
}

/** Every theme token's name, from the one list that defines them. */
const TOKEN_NAMES = themeTokens.cssText.match(/--mq-[\w-]+(?=\s*:)/gu) ?? [];

/**
 * The editor inside takes the Shell's tokens rather than its own defaults, so
 * a token set on the Shell restyles both.
 */
const inheritTokens = unsafeCSS(
  `mail-quilt { ${TOKEN_NAMES.map((name) => `${name}: inherit;`).join(" ")} }`
);

/**
 * Why an email couldn't be read: core's reason, in English for developers, or
 * one of the Shell's own texts.
 */
type Unread = { ok: false; reason: string } | { ok: false; reasonId: StringId };

/** The reason, in the Host app's words where it's the Shell's own. */
const reasonOf = (unread: Unread, text: Text) =>
  "reasonId" in unread ? text(unread.reasonId) : unread.reason;

/** Never throws, as what it reads may have been damaged or edited by hand. */
const parseEmail = (json: string): LoadResult | Unread => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reasonId: "shell.notJson" };
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

/**
 * A press on a menu's button or items leaves focus where it is. Safari and
 * Firefox on a Mac don't focus a button that's pressed, so focus would leave
 * the menu and close it before the click.
 */
const keepFocus = (event: MouseEvent) => {
  event.preventDefault();
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
export class MailQuiltShell extends LitElement implements HostAppProperties {
  static override properties = {
    actions: {},
    heading: {},
    saveKey: { attribute: "save-key" },
    // Passed on to the editor, as properties only.
    ...Object.fromEntries(
      HOST_APP_PROPERTIES.map((name) => [name, { attribute: false }])
    ),
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

      /*
       * Everything, scrolling when the email is longer, under the editor's top
       * bar, which stays in sight.
       */
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

      /* The Shell's frame is the editor's, so the editor doesn't draw its own. */
      mail-quilt::part(frame) {
        border-radius: 0;
        box-shadow: none;
      }

      /* In the editor's top bar: the email's name and whether it's saved. */
      .bar-start {
        align-items: center;
        display: flex;
        gap: var(--mq-space-2);
        min-width: 0;
      }

      .heading {
        font-size: var(--mq-font-size);
        font-weight: 600;
        letter-spacing: -0.005em;
        margin: 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .status {
        align-items: center;
        color: var(--mq-color-text-muted);
        display: inline-flex;
        flex: none;
        font-size: var(--mq-font-size-small);
        gap: 5px;
      }

      .status[data-failed] {
        color: var(--mq-color-danger);
      }

      .status[data-failed]::before {
        background: currentColor;
        border-radius: 50%;
        content: "";
        height: 6px;
        width: 6px;
      }

      /* Between the Shell's own and undo. */
      .divider {
        background: var(--mq-color-border);
        flex: none;
        height: 18px;
        margin-inline: var(--mq-space-1);
        width: 1px;
      }

      /* In the top bar's other end: the ⋯ menu, then Export. */
      .bar-end {
        align-items: center;
        display: flex;
        gap: 6px;
      }

      .menu-anchor {
        display: inline-flex;
        position: relative;
      }

      .export {
        align-items: center;
        display: inline-flex;
        gap: 6px;
        padding-inline: 10px 8px;
      }

      /* Off, it's a quiet button, not a faded call to action. */
      .export[aria-disabled="true"],
      .export[aria-disabled="true"]:hover {
        background: var(--mq-color-surface-muted);
        border-color: var(--mq-color-border);
        box-shadow: none;
        color: var(--mq-color-text-muted);
        cursor: default;
      }

      .bar-end button:active:not([aria-disabled="true"]) {
        transform: scale(0.97);
      }

      .bar-end button {
        transition:
          background-color 120ms,
          color 120ms,
          transform 100ms;
      }

      /* It grows from its button, at the top bar's right edge. */
      .menu {
        background: var(--mq-color-surface);
        border: 1px solid var(--mq-color-border);
        border-radius: var(--mq-radius);
        box-shadow: var(--mq-shadow);
        display: flex;
        flex-direction: column;
        gap: 2px;
        inset-block-start: calc(100% + 6px);
        inset-inline-end: 0;
        min-width: 240px;
        padding: var(--mq-space-1);
        position: absolute;
        transform-origin: top right;
        transition:
          opacity 150ms ease-out,
          transform 150ms ease-out;
      }

      @starting-style {
        .menu {
          opacity: 0;
          transform: scale(0.96);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ui * {
          transition: none !important;
        }
      }

      .menu-item {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: var(--mq-radius-small);
        color: var(--mq-color-text);
        cursor: pointer;
        display: flex;
        gap: 10px;
        padding: 6px 10px;
        text-align: start;
        width: 100%;
      }

      .menu-item:has(.menu-help) {
        align-items: flex-start;
      }

      .menu-item:has(.menu-help) > .icon {
        margin-block-start: 2px;
      }

      .menu-item > .icon {
        color: var(--mq-color-text-muted);
      }

      .menu-item:is(:hover, :focus-visible) {
        background: var(--mq-color-surface-hover);
      }

      .ui .menu-item:focus-visible {
        outline-offset: -2px;
      }

      .menu-label,
      .menu-help {
        display: block;
      }

      .menu-help {
        color: var(--mq-color-text-muted);
        font-size: var(--mq-font-size-small);
      }

      /* Below the top bar, above the email. */
      .messages {
        display: flex;
        flex-direction: column;
      }

      .message {
        align-items: center;
        background: color-mix(
          in srgb,
          var(--mq-color-danger) 8%,
          var(--mq-color-surface)
        );
        border-block-end: 1px solid
          color-mix(in srgb, var(--mq-color-danger) 25%, var(--mq-color-border));
        display: flex;
        gap: 10px;
        min-height: 40px;
        padding: var(--mq-space-1) var(--mq-space-4);
      }

      .message > .icon {
        color: var(--mq-color-danger);
      }

      .message p {
        flex: 1;
        margin: 0;
        min-width: 0;
      }

      .message .text-button {
        flex: none;
      }
    `,
  ];

  /**
   * The buttons to show, by name and separated by spaces. Without it, all of
   * them show. Names the Shell doesn't know are ignored.
   */
  declare actions: string | null | undefined;
  /** The Shell's own heading, `shell.email` in `strings`, when unset or empty. */
  declare heading: string | null | undefined;
  /** Where the email is kept in the browser. Without it, nothing is stored. */
  declare saveKey: string | null | undefined;
  /** As on `<mail-quilt>`. */
  declare mergeTags: HostAppProperties["mergeTags"];
  /** As on `<mail-quilt>`. */
  declare socialIconsUrl: HostAppProperties["socialIconsUrl"];
  /** As on `<mail-quilt>`, and for the Shell's own words too. */
  declare strings: HostAppProperties["strings"];
  /** As on `<mail-quilt>`. */
  declare uploadImage: HostAppProperties["uploadImage"];

  /** The Shell's own words, in the Host app's where it gives them. */
  readonly #text = createText(() => this.strings);
  readonly #editor: MailQuilt = document.createElement("mail-quilt");
  readonly #body = createRef<HTMLElement>();
  readonly #fileInput = createRef<HTMLInputElement>();
  /** The menu that's open in the top bar, if any. */
  #openMenu: Menu | undefined;
  /**
   * Where focus goes once the menus are drawn, with a ring only from the
   * keyboard, as a press doesn't focus the button first.
   */
  #menuFocus: { fromKeyboard: boolean; menu: Menu; to: MenuFocus } | undefined;
  /** Whether the top bar was last drawn with nothing in the email. */
  #drawnEmpty = true;
  /** The email to open is chosen at the first update, or earlier if asked for. */
  #opening: Opening = { state: "waiting", value: undefined };
  /**
   * Gives the editor the height of the part the email scrolls in, for its side
   * panel. Made at the first render, as that's when there's a body to observe.
   */
  #bodyObserver: ResizeObserver | undefined;
  /** Set while the browser can't save the email. */
  #cantSave = false;
  /**
   * Whether the open email is the one saved under `save-key`, so the top bar
   * says "Saved" only then. One the host opens is saved from its next change.
   */
  #saved = false;
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
    { readonly id: number; readonly words: (text: Text) => string }
  >();
  #noticeId = 0;

  constructor() {
    super();
    // Its header is outside <mail-quilt>, which takes or refuses the rest.
    const refuseOutsideEditor = (event: DragEvent) => {
      if (!event.composedPath().includes(this.#editor)) {
        refuseFiles(event);
      }
    };
    this.addEventListener("dragover", refuseOutsideEditor);
    this.addEventListener("drop", refuseOutsideEditor);
    takeValueSetEarly(this);
    // The Shell's top bar is the editor's, so `header` still styles it.
    this.#editor.setAttribute("exportparts", "top-bar: header");
    this.#editor.addEventListener("mq-change", ({ detail }) => {
      this.#keep(detail.document);
      // Export is off with nothing in the email.
      if ((detail.document.rows.length === 0) !== this.#drawnEmpty) {
        this.requestUpdate();
      }
    });
    this.#editor.addEventListener("mq-error", ({ detail }) => {
      this.#showNotice("refused", (text) =>
        text("shell.cantOpen", { reason: detail.reason })
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
    // As the first update would pass it on, which can be yet to come too.
    this.#editor.socialIconsUrl = this.socialIconsUrl;
    return await this.#editor.exportHtml();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#observeBody();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#bodyObserver?.disconnect();
    this.#closeMenu();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    for (const name of HOST_APP_PROPERTIES) {
      if (changed.has(name)) {
        Object.assign(this.#editor, { [name]: this[name] });
      }
    }
    this.#openSaved();
  }

  protected override firstUpdated() {
    this.#observeBody();
  }

  /**
   * The Shell's parts of the top bar and its messages go in the editor's
   * slots. They're in the Shell's shadow root, so its styles and parts reach
   * them.
   */
  protected override updated() {
    const first = this.#editor.childElementCount === 0;
    render(this.#renderSlotted(), this.#editor, { host: this });
    // With no email, the editor draws its top bar only once these are in it.
    if (first) {
      this.#editor.requestUpdate();
    }
    const focus = this.#menuFocus;
    this.#menuFocus = undefined;
    if (focus) {
      const button = this.renderRoot.querySelector<HTMLElement>(
        `#${focus.menu}-button`
      );
      const items = [
        ...this.renderRoot.querySelectorAll<HTMLElement>(
          `#${focus.menu}-menu > [role="menuitem"]`
        ),
      ];
      const to = { button, first: items[0], last: items.at(-1) }[focus.to];
      to?.focus({ focusVisible: focus.fromKeyboard });
    }
  }

  protected override render() {
    return html`
      <div class="ui frame shell" part="frame">
        <div class="body thin-scrollbar" data-testid="body" ${ref(this.#body)}>
          ${this.#editor}
        </div>
      </div>
    `;
  }

  /** The email's name and save status, Export and ⋯, and the messages. */
  #renderSlotted() {
    const named = this.actions?.split(/\s+/u);
    const shows = (action: ShellAction) => named?.includes(action) ?? true;
    const text = this.#text;
    const language = text("language");
    const isEmpty = !this.#editor.value?.rows.length;
    this.#drawnEmpty = isEmpty;
    const cantSave = text(
      shows("export-json") ? "shell.cantSave" : "shell.cantSaveNoExport"
    );
    const exports: MenuItem[] = [
      {
        action: "export-html" as const,
        help: text("shell.exportHtmlHelp"),
        icon: ICONS.file,
        label: text("shell.exportHtml"),
        run: this.#exportHtmlFile,
      },
      {
        action: "export-json" as const,
        help: text("shell.exportJsonHelp"),
        icon: ICONS.file,
        label: text("shell.exportJson"),
        run: this.#exportJson,
      },
    ].filter(({ action }) => shows(action));

    return html`
      <div class="ui bar-start" slot="top-bar-start">
        <!--
          A heading the host sets is in the host page's language, and takes
          its direction from its own text, as the Shell is left to right.
        -->
        <h2
          class="heading"
          dir=${this.heading ? "auto" : nothing}
          lang=${this.heading ? nothing : language}
          part="heading"
        >
          ${this.heading || text("shell.email")}
        </h2>
        ${
          this.saveKey && (this.#cantSave || this.#saved)
            ? html`
                <span
                  class="status"
                  lang=${language}
                  part="status"
                  ?data-failed=${this.#cantSave}
                >
                  ${text(this.#cantSave ? "shell.notSaved" : "shell.saved")}
                </span>
              `
            : nothing
        }
        <span aria-hidden="true" class="divider"></span>
      </div>
      <div
        class="ui bar-end"
        lang=${language}
        part="actions"
        slot="top-bar-end"
      >
        ${
          shows("import-json")
            ? this.#renderMenu(
                "more",
                {
                  className: "icon-button",
                  content: ICONS.more,
                  label: text("shell.more"),
                  tooltip: text("shell.more"),
                },
                [
                  {
                    action: "import-json",
                    icon: ICONS.import,
                    label: text("shell.importJson"),
                    run: this.#chooseFile,
                  },
                ]
              )
            : nothing
        }
        ${
          exports.length > 0
            ? this.#renderMenu(
                "export",
                {
                  className: "text-button primary export",
                  content: html`
                    ${ICONS.export}<span>${text("shell.export")}</span>
                    ${ICONS.chevronDown}
                  `,
                  off: isEmpty,
                  part: "export",
                  tooltip: isEmpty ? text("topBar.emptyEmail") : undefined,
                },
                exports
              )
            : nothing
        }
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
      <div class="ui messages" lang=${language} part="messages" slot="messages">
        ${
          this.#cantSave
            ? html`
                <div class="message" part="message">
                  ${ICONS.alert}
                  <p role="alert">${cantSave}</p>
                  ${
                    shows("export-json")
                      ? html`
                          <button
                            class="text-button"
                            type="button"
                            @click=${this.#exportJson}
                          >
                            ${text("shell.exportJsonNow")}
                          </button>
                        `
                      : nothing
                  }
                </div>
              `
            : nothing
        }
        ${repeat(
          this.#notices.values(),
          ({ id }) => id,
          ({ words }) => html`
            <div class="message" part="message">
              ${ICONS.alert}
              <p role="alert">${words(text)}</p>
            </div>
          `
        )}
      </div>
    `;
  }

  /**
   * A menu button, and its menu while it's open. Arrow keys go along the
   * items, Escape closes it and goes back to its button, and focus leaving it
   * closes it.
   */
  #renderMenu(
    menu: Menu,
    button: {
      className: string;
      content: TemplateResult;
      /** For a button without words. */
      label?: string;
      /** With nothing in the email, it's off and says so. */
      off?: boolean;
      part?: string;
      tooltip?: string;
    },
    items: readonly MenuItem[]
  ) {
    const open = this.#openMenu === menu;
    return html`
      <div
        class="menu-anchor"
        id=${`${menu}-anchor`}
        @focusout=${this.#onMenuFocusout}
        @keydown=${this.#onMenuKeydown}
        @mousedown=${keepFocus}
      >
        <button
          aria-controls=${`${menu}-menu`}
          aria-disabled=${button.off ? "true" : nothing}
          aria-expanded=${open ? "true" : "false"}
          aria-haspopup="menu"
          aria-label=${button.label ?? nothing}
          class=${button.className}
          data-tooltip=${button.tooltip ?? nothing}
          id=${`${menu}-button`}
          part=${button.part ?? nothing}
          type="button"
          @click=${({ detail }: MouseEvent) => {
            if (!button.off) {
              this.#toggleMenu(menu, "first", detail === 0);
            }
          }}
        >
          ${button.content}
        </button>
        <div
          aria-labelledby=${`${menu}-button`}
          class="menu"
          id=${`${menu}-menu`}
          role="menu"
          ?hidden=${!open}
        >
          ${items.map(
            ({ action, help, icon, label, run }) => html`
              <button
                class="menu-item"
                part=${action}
                role="menuitem"
                tabindex="-1"
                type="button"
                @click=${({ detail }: MouseEvent) => {
                  this.#closeMenu("button", detail === 0);
                  run();
                }}
              >
                ${icon}
                <!-- Named by both, as the name has to hold what's shown. -->
                <span>
                  <span class="menu-label">${label}</span>
                  ${
                    help
                      ? html`<span class="menu-help">${help}</span>`
                      : nothing
                  }
                </span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  /** Opens a menu with focus on its first item, or closes it. */
  #toggleMenu(menu: Menu, to: MenuFocus, fromKeyboard: boolean) {
    if (this.#openMenu === menu) {
      this.#closeMenu("button", fromKeyboard);
      return;
    }
    this.#openMenu = menu;
    this.#menuFocus = { fromKeyboard, menu, to };
    this.requestUpdate();
  }

  /** Closes the open menu, and moves focus back to its button if asked. */
  #closeMenu(focus?: "button", fromKeyboard = true) {
    const menu = this.#openMenu;
    if (menu === undefined) {
      return;
    }
    this.#openMenu = undefined;
    if (focus) {
      this.#menuFocus = { fromKeyboard, menu, to: focus };
    }
    this.requestUpdate();
  }

  /**
   * Focus leaving a menu and its button closes it, such as with Tab, or a
   * press anywhere else, which takes focus from the item that has it.
   */
  readonly #onMenuFocusout = ({ currentTarget, relatedTarget }: FocusEvent) => {
    const anchor = currentTarget as Element;
    // Only its own menu, as focus leaves one menu's button for another's.
    if (
      anchor.id === `${this.#openMenu}-anchor` &&
      !(relatedTarget instanceof Node && anchor.contains(relatedTarget))
    ) {
      this.#closeMenu();
    }
  };

  /** A menu's keys, as a menu in any app has them. */
  readonly #onMenuKeydown = (event: KeyboardEvent) => {
    const anchor = event.currentTarget as Element;
    const menu = anchor.id.replace(/-anchor$/u, "") as Menu;
    const target = event.target as HTMLElement;
    const items = [
      ...anchor.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    const index = items.indexOf(target);
    const { altKey, ctrlKey, key, metaKey, shiftKey } = event;
    // With any modifiers, as Escape acts elsewhere in the editor. It closes the
    // menu and goes no further, so a host's dialog stays open.
    if (key === "Escape" && this.#openMenu === menu) {
      event.preventDefault();
      event.stopPropagation();
      this.#closeMenu("button");
      return;
    }
    if (altKey || ctrlKey || metaKey || shiftKey) {
      return;
    }
    if (index === -1) {
      // On the button: the arrows open it too, at either end.
      if (
        (key === "ArrowDown" || key === "ArrowUp") &&
        target.getAttribute("aria-disabled") !== "true"
      ) {
        event.preventDefault();
        this.#toggleMenu(menu, key === "ArrowDown" ? "first" : "last", true);
      }
      return;
    }
    const last = items.length - 1;
    const next: Record<string, HTMLElement | undefined> = {
      ArrowDown: items[index === last ? 0 : index + 1],
      ArrowUp: items[index === 0 ? last : index - 1],
      End: items[last],
      Home: items[0],
    };
    if (key in next) {
      event.preventDefault();
      next[key]?.focus();
    }
  };

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
    this.#saved = false;
    // Export is off with nothing in the email.
    this.requestUpdate();
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
    this.#saved = Boolean(saved);
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
      this.#showNotice("saved", (text) =>
        text("shell.cantOpenSaved", { reason: reasonOf(loaded, text) })
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
      if (cantSave !== this.#cantSave || cantSave === this.#saved) {
        this.#cantSave = cantSave;
        this.#saved = !cantSave;
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
  /** `words` are made at each render, so they follow a change to `strings`. */
  #showNotice(of: NoticeOf, words: (text: Text) => string) {
    this.#noticeId += 1;
    this.#notices.set(of, { id: this.#noticeId, words });
    this.requestUpdate();
  }

  #clearNotice(of: NoticeOf) {
    if (this.#notices.delete(of)) {
      this.requestUpdate();
    }
  }

  readonly #exportHtmlFile = async () => {
    if (!this.value) {
      this.#showNotice("export", (text) => text("shell.nothingToExport"));
      return;
    }
    try {
      downloadFile("email.html", "text/html", await this.exportHtml());
      this.#clearNotice("export");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#showNotice("export", (text) =>
        text("shell.cantExport", { reason })
      );
    }
  };

  readonly #exportJson = () => {
    const email = this.value;
    if (!email) {
      this.#showNotice("export", (text) => text("shell.nothingToExport"));
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
    let loaded: LoadResult | Unread;
    try {
      loaded = parseEmail(await file.text());
    } catch {
      loaded = { ok: false, reasonId: "shell.cantRead" };
    }
    if (!loaded.ok) {
      const unread = loaded;
      this.#showNotice("import", (text) =>
        text("shell.cantImport", { reason: reasonOf(unread, text) })
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
    this.requestUpdate();
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
