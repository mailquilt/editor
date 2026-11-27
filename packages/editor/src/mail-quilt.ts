import { isSameDocument, loadDocument } from "@mailquilt/core";
import type {
  BlocksDocument,
  BlockType,
  Command,
  Editor,
  LoadResult,
  RichTextDocument,
} from "@mailquilt/core";
import { EMAIL_LOOK, editorOfLoaded } from "@mailquilt/core/internal";
import { renderEmail, renderText } from "@mailquilt/renderer";
import type { Problem } from "@mailquilt/renderer";
import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import type { PropertyValues } from "lit";
import { keyed } from "lit/directives/keyed.js";

import {
  addingStyles,
  createAdding,
  createInsertHover,
  renderAddPanel,
} from "./adding.js";
import { createAnnouncements } from "./announcements.js";
import { BLOCK_VIEWS, blockTypeStyles, hasRichText } from "./block-types.js";
import {
  canvasStyles,
  drawnEmail,
  renderFloatingToolbar,
  renderRows,
} from "./canvas.js";
import type { CanvasEvents, CanvasState, NotOnDevice } from "./canvas.js";
import {
  CHECK_PANEL_WIDTH_PX,
  CHECK_STAGE_PADDING_PX,
  checkStyles,
  createCheck,
  createFixNote,
  checkZoom,
  renderCheck,
} from "./check-mode.js";
import type { FixNote } from "./check-mode.js";
import { readPasted } from "./clipboard.js";
import { createDragging } from "./dragging.js";
import type { Dragging } from "./dragging.js";
import { createEditingActions } from "./editing-actions.js";
import { findPlace, findPlaces, place } from "./editor-places.js";
import { createFieldMergeTags } from "./field-merge-tags.js";
import { createFocus } from "./focus.js";
import type { FocusTarget } from "./focus.js";
import { createLinkForm, formatBarStyles } from "./format-bar.js";
import type { HostAppProperties } from "./host-app.js";
import { createImageUploads } from "./image-uploads.js";
import { createKeyDispatch } from "./key-dispatch.js";
import { keyLabel, keysInWords } from "./key-map.js";
import type { Action, KeyScope } from "./key-map.js";
import {
  mergeTagPickerStyles,
  showHighlightedTag,
} from "./merge-tag-picker.js";
import type { PanelApi } from "./panel-api.js";
import { blocksIn, locate, locateColumn, locateRow } from "./positions.js";
import { createPresses } from "./presses.js";
import {
  createRowPictures,
  createRowsList,
  renderRowsList,
  renderRowsSheet,
  ROWS_LIST_COLLAPSED_WIDTH_PX,
  ROWS_LIST_WIDTH_PX,
  rowsListStyles,
} from "./rows-list.js";
import {
  blockDraftKey,
  createBarPanels,
  fieldShownIn,
  renderMoreDock,
  renderSelectionBar,
  selectionBarStyles,
} from "./selection-bar.js";
import { createSelection } from "./selection.js";
import {
  createSettingsDrafts,
  draftKey,
  settingsPanelStyles,
} from "./settings-panel.js";
import { openSheets, PHONE_LAYOUT_WIDTH, sheetStyles } from "./sheet.js";
import type { MailQuiltStrings } from "./strings.js";
import { createStylePanel, stylePanelStyles } from "./style-panel.js";
import type { StyleMark } from "./style-panel.js";
import { styleProperties } from "./style-properties.js";
import { createTextBlockView, textBlockStyles } from "./text-block-view.js";
import type { ShownMergeTagPicker, TextBlockView } from "./text-block-view.js";
import type { TextFormats } from "./text-commands.js";
import { isMergeTagName } from "./text-schema.js";
import { blockTypeName, createText } from "./text.js";
import type { Text } from "./text.js";
import { themeTokens, uiStyles } from "./theme.js";
import type { MailQuiltTheme } from "./theme.js";
import { createToolFitting } from "./tool-fitting.js";
import type { ToolFitting } from "./tool-fitting.js";
import { createTooltips } from "./tooltips.js";
import type { Tooltips } from "./tooltips.js";
import {
  modePanelId,
  modeTabId,
  PHONE_WIDTH,
  renderTopBar,
  renderTopMenu,
  topBarStyles,
} from "./top-bar.js";
import type { Device, Mode, TopBarEvents } from "./top-bar.js";
import { takeValueSetEarly } from "./value-set-early.js";
import { createVideos } from "./videos.js";
import { createWebFonts, usableFonts } from "./web-fonts.js";
import type { HostFont } from "./web-fonts.js";

/**
 * Heard on the page, on the way in, as Firefox fires them at the body and
 * WebKit at this element, rather than at the Block or Row with focus.
 */
const CLIPBOARD_EVENTS = ["copy", "cut", "paste"] as const;

/** Outside Style, nothing on the Canvas is marked for a setting. */
const NO_MARKS: ReadonlyMap<string, StyleMark> = new Map();

/** Beside the email on the Canvas, each side. */
const CANVAS_GUTTER_PX = 40;

/** More's width. */
const PANEL_WIDTH_PX = 320;

/**
 * The Add panel's width: four tiles across, and narrower than More, so it
 * docks beside the usual email from 968px wide, on a small laptop too.
 */
const ADD_WIDTH_PX = 288;

/** Typing after a gap this long starts a new undo step. */
const TYPING_PAUSE_MS = 1000;

/**
 * The keys for an action, for the Block key help, which a screen reader reads,
 * so each key is named as `aria-keyshortcuts` names it: "A, B, or C".
 */
const keysFor = (scope: KeyScope, action: Action, text: Text) =>
  new Intl.ListFormat(text("language"), { type: "disjunction" }).format(
    keyLabel(scope, action)
      .shortcuts.split(" ")
      .map((keys) => keysInWords(keys, text))
  );

/** The keys the Block key help names. */
const blockKeys = (text: Text) => ({
  backToBlock: keysFor("text", "backToBlock", text),
  editText: keysFor("block", "editText", text),
  formatBar: keysFor("text", "focusFormatBar", text),
  moveBlock: keysFor("block", "moveBlock", text),
  selectBlock: keysFor("block", "selectBlock", text),
});

/** The element's own frame, the workspace, the email card and the drop line. */
const elementStyles = css`
  /* A column, so the editor fills any height the host gives the element. */
  :host {
    display: flex;
    flex-direction: column;
  }

  :host([hidden]) {
    display: none;
  }

  /*
   * The top bar, the Shell's messages, then the Mode's panel, which fills any
   * height the host gives, but never shrinks below the email.
   */
  .app {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    min-height: 600px;
  }

  /*
   * On a phone, the email takes the width, with no gutters, so there's no
   * room for a Block's handle, as touch doesn't drag. Frame p08.
   */
  .app[data-phone] .editor {
    --_mq-gutter: 0px;
  }

  .app[data-phone] .canvas-area {
    padding-block-end: 0;
  }

  /* A Mode's panel other than the Canvas, which fills it: Check. */
  .mode-panel {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
  }

  /*
   * Edit: the Add panel while it's open, the canvas, then More where it docks.
   * Clipped rather than hidden, which would stop the panels and toolbar
   * sticking. What focus scrolls to stays clear of the top bar.
   */
  .editor {
    /* Beside the email, room for a Block's handle and a Row's tag. */
    --_mq-gutter: ${unsafeCSS(CANVAS_GUTTER_PX)}px;
    --_mq-panel-width: ${unsafeCSS(PANEL_WIDTH_PX)}px;
    --_mq-add-width: ${unsafeCSS(ADD_WIDTH_PX)}px;
    align-items: stretch;
    display: flex;
    overflow: clip;
    flex: 1 0 auto;
    position: relative;
  }

  .editor * {
    scroll-margin-block-start: calc(
      var(--_mq-top-bar-height) + var(--_mq-selection-bar-height)
    );
  }

  /* The Selection bar itself is shown under the top bar alone. */
  .editor .bar-dock {
    scroll-margin-block-start: var(--_mq-top-bar-height);
  }

  /* On a phone, the Selection bar is at the bottom, so it's kept clear of. */
  .app[data-phone] .editor * {
    scroll-margin-block: var(--_mq-top-bar-height)
      calc(var(--_mq-phone-bar-height) + 2 * var(--mq-space-2));
  }

  .canvas-area {
    background-color: var(--mq-color-workspace);
    display: flex;
    flex: 1 1 calc(var(--_mq-email-width) + 2 * var(--_mq-gutter));
    flex-direction: column;
    gap: var(--mq-space-5);
    /* Room for a selected Block's tools. */
    min-height: 480px;
    min-width: 0;
    /* The Selection bar spans the top, so the gutters are only at the sides. */
    padding: 0 var(--_mq-gutter) var(--mq-space-4);
  }

  /* In Style, with no Selection bar above it, the email keeps a gutter there too. */
  .styling .canvas-area {
    padding-block-start: var(--_mq-gutter);
  }

  /*
   * The email card: the email's own settings, and of the editor's tokens only
   * its shadow, on the workspace. Inherited properties cross the Shadow DOM
   * boundary, so hostile values on the host element stop here. Direction and
   * custom properties aren't reset by all, so the email takes the editor's:
   * left to right, as its export is, and the tokens for its outlines and tools.
   */
  .email {
    all: initial;
    box-shadow: var(--mq-shadow);
    box-sizing: border-box;
    color: #000000;
    display: block;
    font-size: ${unsafeCSS(EMAIL_LOOK.fontSize)};
    line-height: ${unsafeCSS(EMAIL_LOOK.lineHeight)};
    margin: 0 auto;
    max-width: 100%;
    position: relative;
  }

  .drop-indicator {
    background: var(--mq-color-accent);
    border-radius: 2px;
    box-shadow: 0 0 0 2px rgb(255 255 255 / 80%);
    height: 3px;
    margin-block-start: -1.5px;
    pointer-events: none;
    position: absolute;
    z-index: var(--_mq-layer-drop-indicator);
  }

  .drop-indicator::before,
  .drop-indicator::after {
    background: var(--mq-color-surface);
    border: 2px solid var(--mq-color-accent);
    border-radius: 50%;
    content: "";
    height: 9px;
    position: absolute;
    top: -3px;
    width: 9px;
  }

  .drop-indicator::before {
    left: -5px;
  }

  .drop-indicator::after {
    right: -5px;
  }

  /*
   * Forced colors drop the line's background, which is all it's drawn with.
   * The text's color stands out from the email in every palette.
   */
  @media (forced-colors: active) {
    .drop-indicator {
      background: CanvasText;
      forced-color-adjust: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui * {
      transition: none !important;
    }
  }
`;

export class MailQuilt extends LitElement implements HostAppProperties {
  static override properties = {
    // As mergeTags.
    fonts: {
      attribute: false,
      hasChanged: (
        next: HostAppProperties["fonts"],
        previous: HostAppProperties["fonts"]
      ) => JSON.stringify(next) !== JSON.stringify(previous),
    },
    // A React host gives a new list at each render, which only a change to
    // one of its tags redraws. No list isn't an empty one, which Check reads
    // as a list that has none of the email's tags.
    mergeTags: {
      attribute: false,
      hasChanged: (
        next: HostAppProperties["mergeTags"],
        previous: HostAppProperties["mergeTags"]
      ) => JSON.stringify(next) !== JSON.stringify(previous),
    },
    sender: { attribute: false },
    socialIconsUrl: { attribute: false },
    // A React host gives a new object at each render.
    strings: {
      attribute: false,
      hasChanged: (next: MailQuiltStrings, previous: MailQuiltStrings) =>
        JSON.stringify(next ?? {}) !== JSON.stringify(previous ?? {}),
    },
    // Only whether there's one changes what shows, and a React host may give
    // a new function at each render, such as on each key.
    uploadImage: {
      attribute: false,
      hasChanged: (next: unknown, previous: unknown) =>
        Boolean(next) !== Boolean(previous),
    },
    subject: { attribute: false },
    // As uploadImage.
    sendTest: {
      attribute: false,
      hasChanged: (next: unknown, previous: unknown) =>
        Boolean(next) !== Boolean(previous),
    },
    // Reflected, as the theme is drawn from the attribute.
    theme: { reflect: true },
    notOnDevice: { attribute: false },
  };

  static override styles = [
    themeTokens,
    uiStyles,
    settingsPanelStyles,
    addingStyles,
    rowsListStyles,
    selectionBarStyles,
    stylePanelStyles,
    blockTypeStyles,
    formatBarStyles,
    mergeTagPickerStyles,
    checkStyles,
    topBarStyles,
    sheetStyles,
    elementStyles,
    canvasStyles,
    textBlockStyles,
  ];

  /** Lit's, which is this element's shadow root, as Lit attaches it. */
  declare readonly renderRoot: ShadowRoot;

  declare fonts: HostAppProperties["fonts"];
  declare mergeTags: HostAppProperties["mergeTags"];
  declare sender: HostAppProperties["sender"];
  declare sendTest: HostAppProperties["sendTest"];
  declare socialIconsUrl: HostAppProperties["socialIconsUrl"];
  declare strings: HostAppProperties["strings"];
  declare subject: HostAppProperties["subject"];
  declare uploadImage: HostAppProperties["uploadImage"];
  /**
   * The editor's built-in theme: `light`, the default, `dark`, or `auto`,
   * which follows the person's system. A theme token set on the element wins
   * over either. The email keeps its own colors.
   */
  declare theme: MailQuiltTheme | undefined;
  /**
   * How the Canvas shows what isn't on the device being viewed, which the
   * Shell's menu sets. Folded until it's set. The Shell's own, and not yet a
   * promise to hosts.
   */
  declare notOnDevice: NotOnDevice | undefined;

  get #notOnDevice(): NotOnDevice {
    return this.notOnDevice ?? "fold";
  }

  /** The email as the Canvas draws it on the device being viewed. */
  #drawnEmail() {
    const email = this.#editor?.getDocument();
    return email && drawnEmail(email, this.#device, this.#notOnDevice);
  }

  /** Each of the editor's texts, in the Host app's words where it gives them. */
  readonly #text = createText(() => this.strings);
  #editor: Editor | undefined;
  readonly #views = new Map<string, TextBlockView>();
  /** Edits in the same typing session merge into one undo step. */
  #typingSession = 0;
  #lastTypedAt = 0;
  #formats: TextFormats | undefined;
  #mergeTagPicker: ShownMergeTagPicker | undefined;
  readonly #mergeTagsGiven = () => this.mergeTags ?? [];
  /** The Host app's fonts the editor can use, checked once for each list. */
  #fonts: HostFont[] = [];
  readonly #webFonts = createWebFonts({
    offered: () => this.#fonts,
    requestUpdate: () => this.requestUpdate(),
  });
  readonly #focus = createFocus({
    requestUpdate: () => this.requestUpdate(),
    root: () => this.renderRoot,
    selectedBlockId: () => this.#selection.blockId,
    textOf: (blockId) => this.#views.get(blockId),
  });
  readonly #selection = createSelection({
    focus: this.#focus,
    onSelect: () => {
      this.#linkForm.close();
      this.#barPanels.onSelect();
      // With nothing selected, More has nothing to show.
      if (
        this.#selection.blockId === undefined &&
        this.#selection.rowId === undefined
      ) {
        this.#barPanels.closeMore(false);
      }
      this.#formats = this.#selection.selectedText?.formats();
      this.#mergeTagPicker = this.#selection.selectedText?.mergeTagPicker();
      this.requestUpdate();
    },
    requestUpdate: () => this.requestUpdate(),
    textOf: (blockId) => this.#views.get(blockId),
  });
  readonly #adding = createAdding({
    focus: this.#focus,
    selected: () => {
      if (this.#selection.blockId !== undefined) {
        return "block";
      }
      return this.#selection.rowId === undefined ? undefined : "row";
    },
    requestUpdate: () => this.requestUpdate(),
  });
  readonly #rowsList = createRowsList({
    focus: this.#focus,
    requestUpdate: () => this.requestUpdate(),
  });
  /** Set while the element is connected, as it observes sizes on the page. */
  #rowPictures: ReturnType<typeof createRowPictures> | undefined;
  readonly #barPanels = createBarPanels({
    focus: this.#focus,
    requestUpdate: () => this.requestUpdate(),
  });
  readonly #presses = createPresses({
    focus: this.#focus,
    selection: this.#selection,
  });
  readonly #stylePanel = createStylePanel({
    apply: (command, mergeKey) =>
      this.#apply(command, { mergeKey, refusable: true }),
    focus: this.#focus,
    fonts: () => this.#fonts,
    webFonts: this.#webFonts,
    requestUpdate: () => this.requestUpdate(),
    text: this.#text,
  });
  readonly #drafts = createSettingsDrafts({
    apply: (command) => this.#apply(command, { refusable: true }),
    focusInList: (listId, at) =>
      this.#focus.focusWhenRendered({ at, listId, on: "list" }),
    onEnter: (value) => {
      // An image URL that failed may load now, so entering it again tries again.
      if (typeof value === "string" && this.#failedImages.delete(value)) {
        this.requestUpdate();
      }
    },
    requestUpdate: () => this.requestUpdate(),
    say: (words) => this.#announcements.say(words),
    text: this.#text,
  });
  /** One copy of the document for each update, as `value` makes a new one. */
  #rendered: BlocksDocument | undefined;
  /** Image URLs that didn't load, which the canvas stops trying to show. */
  readonly #failedImages = new Set<string>();
  readonly #linkForm = createLinkForm({
    editingText: () => this.#selection.editingText,
    focusField: () => this.#focus.focusWhenRendered({ on: "linkField" }),
    focusText: () => this.#focus.focus({ on: "text" }),
    requestUpdate: () => this.requestUpdate(),
    view: () => this.#selection.selectedText,
  });
  readonly #check = createCheck({
    email: () => this.#editor?.getDocument(),
    exportHtml: () => this.exportHtml(),
    exportText: () => this.exportText(),
    isShown: () => this.#mode === "check",
    mergeTags: () => this.mergeTags,
    requestUpdate: () => this.requestUpdate(),
    say: (words) => this.#announcements.say(words),
    sendTest: () => this.sendTest,
    subject: () => this.subject,
    text: this.#text,
  });
  readonly #fixNote = createFixNote({
    requestUpdate: () => this.requestUpdate(),
    root: () => this.shadowRoot,
  });
  /** Set while the element is connected. */
  #dragging: Dragging | undefined;
  /** Set while the element is connected. */
  #insertHover: { destroy: () => void } | undefined;
  /** Set while the element is connected, as it observes sizes on the page. */
  #toolFitting: ToolFitting | undefined;
  #tooltips: { element: HTMLElement; tooltips: Tooltips } | undefined;
  /** Laid out for a phone, as on one or in a narrow part of a page. */
  #phone = false;
  /** On a phone, the top bar's menu, or the Rows sheet from it, while open. */
  #phoneSheet: "menu" | "rows" | undefined;
  /** The element's width, which More docks beside the email where it fits. */
  #width = 0;
  /** The element's height, which More floating over the email stays inside. */
  #height = 0;
  /** What the person last used in the editor: its keys or a pointer. */
  #lastInput: "keys" | "pointer" = "pointer";
  /** Edit until the person picks another, and with nothing in the email. */
  #mode: Mode = "edit";
  /** The view the person picked, if they have. */
  #chosenDevice: Device | undefined;

  /** What the Canvas shows, which on a phone is the Phone view until another is picked. */
  get #device(): Device {
    return this.#chosenDevice ?? (this.#phone ? "phone" : "desktop");
  }
  readonly #topBarEvents: TopBarEvents = {
    doneTyping: () => this.#focus.focus({ on: "block" }),
    selectDevice: (device) => {
      this.#chosenDevice = device;
      this.requestUpdate();
    },
    selectMode: (mode) => {
      if (mode !== this.#mode) {
        if (this.#mode === "check") {
          this.#check.leave();
        }
        this.#mode = mode;
        this.#stylePanel.forget();
        this.requestUpdate();
      }
    },
    stepHistory: (step) => this.#stepHistory(step),
    toggleMenu: (fromKeyboard) => {
      if (this.#phoneSheet) {
        this.#closePhoneSheet();
      } else {
        this.#phoneSheet = "menu";
        this.requestUpdate();
        if (fromKeyboard) {
          this.#focus.focusWhenRendered({
            action: "view-desktop",
            on: "topMenu",
          });
        }
      }
    },
  };

  /** Closes the top bar's menu, or the Rows sheet from it, back to ⋯. */
  readonly #closePhoneSheet = () => {
    if (this.#phoneSheet === undefined) {
      return;
    }
    this.#phoneSheet = undefined;
    this.requestUpdate();
    this.#focus.focusWhenRendered({ on: "topMenu" });
  };

  /** Made on the page, as a server rendering the editor has no ResizeObserver. */
  #resizeObserver: ResizeObserver | undefined;

  /**
   * How much of the window's bottom the on-screen keyboard covers, which what
   * stays at the bottom on a phone, such as the format bar, keeps above.
   */
  readonly #onViewport = () => {
    if (!this.#phone) {
      this.style.removeProperty("--_mq-keyboard-inset");
      return;
    }
    const viewport = this.ownerDocument.defaultView?.visualViewport;
    const covered = viewport
      ? Math.max(
          0,
          (this.ownerDocument.defaultView?.innerHeight ?? 0) -
            viewport.height -
            viewport.offsetTop
        )
      : 0;
    this.style.setProperty("--_mq-keyboard-inset", `${Math.round(covered)}px`);
  };

  readonly #announcements = createAnnouncements({
    email: () => this.#editor?.getDocument(),
    requestUpdate: () => this.requestUpdate(),
    text: this.#text,
  });
  readonly #editing = createEditingActions({
    announcements: this.#announcements,
    apply: (command) => this.#apply(command),
    drawnEmail: () => this.#drawnEmail(),
    email: () => this.#editor?.getDocument(),
    focus: this.#focus,
    // Refused without uploadImage, as a dropped file is.
    pasteFiles: (files, position) => {
      if (this.uploadImage) {
        return this.#uploads.drop(files, position);
      }
      this.#announcements.say(this.#text("paste.noUploads"));
    },
    selection: this.#selection,
    text: this.#text,
  });
  readonly #uploads = createImageUploads({
    addImageBlocks: (count, position) =>
      this.#editing.addBlocksAt("image", count, position),
    announcements: this.#announcements,
    email: () => this.#editor?.getDocument(),
    select: (blockId) => this.#selection.selectLanded(blockId),
    setImage: (blockId, src) => {
      // A Video's image is its thumbnail.
      const email = this.#editor?.getDocument();
      const isVideo =
        email !== undefined && locate(email, blockId)?.block.type === "video";
      const key = isVideo ? "thumbnail" : "src";
      if (isVideo) {
        this.#videos.willChange(blockId, { thumbnail: src });
      }
      const result = this.#apply(
        {
          blockId,
          props: { [key]: src },
          type: "updateBlockProps",
        },
        { refusable: true }
      );
      // The field shows the new URL, rather than what was typed and refused,
      // and the canvas tries it again, as it may not have been there before.
      if (result?.ok || result?.code === "unchanged") {
        this.#drafts.forget(blockDraftKey(blockId, key));
        if (this.#failedImages.delete(src)) {
          this.requestUpdate();
        }
      }
      return result;
    },
    text: this.#text,
    uploadImage: () => this.uploadImage,
  });
  readonly #videos = createVideos({
    announcements: this.#announcements,
    apply: (blockId, props) =>
      this.#apply(
        { blockId, props, type: "updateBlockProps" },
        { refusable: true }
      ),
    email: () => this.#editor?.getDocument(),
    requestUpdate: () => this.requestUpdate(),
    text: this.#text,
    uploadImage: () => this.uploadImage,
  });
  readonly #uploadImage = (blockId: string, file: File) => {
    this.#uploads.upload(blockId, file);
  };
  readonly #fieldMergeTags = createFieldMergeTags({
    requestUpdate: () => this.requestUpdate(),
    tags: this.#mergeTagsGiven,
  });
  readonly #keys = createKeyDispatch({
    adding: this.#adding,
    bar: this.#barPanels,
    canStep: (step) =>
      step === "undo"
        ? (this.#editor?.canUndo() ?? false)
        : (this.#editor?.canRedo() ?? false),
    drafts: this.#drafts,
    editing: this.#editing,
    fieldMergeTags: this.#fieldMergeTags,
    // Of the Blocks the Canvas draws, as one it hides has nowhere for focus.
    firstBlockIn: (rowId) => {
      const email = this.#drawnEmail();
      const position = email && locateRow(email, rowId);
      return position?.row.columns.flatMap(({ blocks }) => blocks)[0]?.id;
    },
    firstBlockInColumn: (columnId) => {
      const email = this.#drawnEmail();
      const position = email && locateColumn(email, columnId);
      return (
        position && {
          blockId: position.column.blocks[0]?.id,
          rowId: position.row.id,
        }
      );
    },
    focus: this.#focus,
    isDragging: () => this.#dragging?.isDragging() ?? false,
    linkForm: this.#linkForm,
    checking: () => this.#mode === "check",
    rowsList: this.#rowsList,
    selection: this.#selection,
    stepHistory: (step) => this.#stepHistory(step),
    style: this.#stylePanel,
  });

  /** What the Add panel, the Selection bar and More do, made once. */
  readonly #panelActions = {
    addBlock: (blockType) => {
      this.#closeFloatingAdd();
      this.#editing.addBlock(blockType);
    },
    addBlockAt: (blockType, { columnId, index }) => {
      this.#adding.closePicker(false);
      this.#editing.addBlock(blockType, { columnId, index });
    },
    addRow: (layout, fromKeyboard) => {
      this.#closeFloatingAdd();
      this.#rowsList.closeAdd(false);
      this.#editing.addRow(layout, fromKeyboard);
    },
    cancelLink: () => this.#linkForm.cancel(),
    closeAddPanel: (returnFocus) => this.#adding.closePanel(returnFocus),
    closeMenu: (returnFocus) => this.#barPanels.closeMenu(returnFocus),
    closeMore: (returnFocus) => this.#barPanels.closeMore(returnFocus),
    closePopover: (returnFocus) => this.#barPanels.closePopover(returnFocus),
    copySelected: () =>
      this.#keys.runClipboard(
        this.#selection.rowId === undefined ? "copyBlock" : "copyRow"
      ),
    cutSelected: () =>
      this.#keys.runClipboard(
        this.#selection.rowId === undefined ? "cutBlock" : "cutRow"
      ),
    deleteBlock: (fromKeyboard) => this.#editing.deleteBlock(fromKeyboard),
    deleteRow: (rowId, fromKeyboard) =>
      this.#editing.deleteRow(rowId, fromKeyboard),
    drafts: this.#drafts.fields,
    duplicateBlock: (fromKeyboard) =>
      this.#editing.duplicateBlock(fromKeyboard),
    duplicateRow: (rowId) => this.#editing.duplicateRow(rowId),
    insertLineBreak: () => this.#selection.selectedText?.insertLineBreak(),
    moveBlock: (direction) => this.#editing.moveBlock(direction),
    moveRow: (rowId, direction) => this.#editing.moveRow(rowId, direction),
    openAddPanel: (fromKeyboard) =>
      this.#adding.openPanel(fromKeyboard, fromKeyboard || !this.#phone),
    openLinkField: () => this.#linkForm.open(),
    openPicker: (at, fromKeyboard) => this.#adding.openPicker(at, fromKeyboard),
    openCheck: () => {
      this.#topBarEvents.selectMode("check");
      // The button is hidden with the Canvas, so focus goes to Check's tab.
      this.#focus.focusWhenRendered({ on: "emailTools" });
    },
    pasteBelow: () => {
      void this.#pasteBelow();
    },
    pickMergeTag: (index) => this.#selection.selectedText?.pickMergeTag(index),
    removeLink: () => this.#linkForm.remove(),
    searchAdd: (where, query) => this.#adding.search(where, query),
    selectEmail: (fromKeyboard) => {
      this.#selection.select(undefined);
      this.#focus.focusWhenRendered(
        { action: "field-preheader", on: "bar" },
        { focusVisible: fromKeyboard }
      );
    },
    selectColumn: (columnId, fromKeyboard) =>
      this.#selection.selectColumn(columnId, fromKeyboard),
    selectRow: (rowId, fromKeyboard) =>
      this.#selection.selectRow(rowId, fromKeyboard),
    selectRowInList: (rowId, fromKeyboard) => {
      this.#selection.select({ rowId });
      this.#focus.focusWhenRendered(
        { on: "rowsList", rowId },
        { focusVisible: fromKeyboard }
      );
      this.#focus.revealRow(rowId);
    },
    setRowLayout: (rowId, layout) => {
      this.#apply({ layout, rowId, type: "setRowLayout" });
    },
    stepHistory: (step) => this.#stepHistory(step),
    submitLink: (href) => this.#linkForm.submit(href),
    toggleList: (type) => this.#selection.selectedText?.toggleList(type),
    toggleMark: (mark) => this.#selection.selectedText?.toggleMark(mark),
    toggleMenu: () => this.#barPanels.toggleMenu(),
    toggleMore: (fromKeyboard) => this.#barPanels.toggleMore(fromKeyboard),
    togglePopover: (id) => this.#barPanels.togglePopover(id),
    toggleRowsAdd: (fromKeyboard) => this.#rowsList.toggleAdd(fromKeyboard),
    toggleRowsList: (expanded, fromKeyboard) =>
      this.#rowsList.toggleExpanded(expanded, fromKeyboard),
    showPaddingBySide: (rowId, bySide) =>
      this.#barPanels.showPaddingBySide(rowId, bySide),
  } satisfies Partial<PanelApi>;

  readonly #canvasEvents: CanvasEvents = {
    onBlockFocus: (blockId) => {
      this.#linkForm.close();
      this.#selection.onBlockFocus(blockId);
      // More over the email can cover a narrow Column's Block, so it closes
      // for a Block reached from the keyboard. A click shows where it went.
      if (
        this.#lastInput === "keys" &&
        this.#barPanels.state.moreOpen &&
        !this.#docksMore(this.#width)
      ) {
        this.#barPanels.closeMore(false);
      }
    },
    onBlockFocusout: () => this.#selection.onBlockFocusout(),
    onEmptyRowFocus: (rowId) => {
      // Not as focus comes back after an update, which changes nothing.
      if (!this.#focus.restoring) {
        this.#selection.select({ rowId });
      }
    },
    onImageError: (src) => this.#onImageError(src),
  };

  protected override createRenderRoot() {
    const root = super.createRenderRoot();
    root.addEventListener("keydown", this.#keys.onKeydown);
    // What's typed in a field, and where its cursor goes, for the Merge Tag
    // picker. A key that moves the cursor has moved it by its keyup.
    for (const type of ["click", "input", "keyup"]) {
      root.addEventListener(type, this.#fieldMergeTags.onFieldEvent);
    }
    root.addEventListener("focusout", (event) => {
      this.#adding.onFocusout(event as FocusEvent);
      this.#rowsList.onFocusout(event as FocusEvent);
      this.#fieldMergeTags.onFocusout(event as FocusEvent);
      this.#barPanels.onFocusout(event as FocusEvent);
    });
    root.addEventListener("mousedown", (event) =>
      this.#presses.onMousedown(event as MouseEvent)
    );
    root.addEventListener("pointerdown", (event) => {
      this.#lastInput = "pointer";
      this.#adding.onPointerdown(event as PointerEvent);
      this.#rowsList.onPointerdown(event as PointerEvent);
      this.#barPanels.onPointerdown(event as PointerEvent);
    });
    root.addEventListener(
      "wheel",
      (event) => this.#presses.onWheel(event as WheelEvent),
      { passive: true }
    );
    return root;
  }

  constructor() {
    super();
    // On the way in, because a Block's text answers a key before it bubbles here.
    this.addEventListener("keydown", this.#keys.onKeydownCapture, {
      capture: true,
    });
    this.addEventListener(
      "keydown",
      () => {
        this.#lastInput = "keys";
      },
      { capture: true }
    );
    takeValueSetEarly(this);
  }

  get value(): BlocksDocument | undefined {
    return this.#editor?.getDocument();
  }

  /**
   * A document with the same content as the current one changes nothing, so a
   * controlled host keeps its undo history and cursor. Any other document loads
   * and clears undo history. A document that can't be trusted fires `mq-error`,
   * and the current email stays as it was. Any value is checked, such as a
   * saved email read back from JSON, so any is allowed.
   */
  set value(value: unknown) {
    const current = this.#editor?.getDocument();
    // Checked first, because a controlled host does this after every keystroke.
    if (isSameDocument(value, current)) {
      return;
    }
    // Null too, which is what JSON.parse gives for nothing saved.
    if (value === undefined || value === null) {
      this.#show(undefined);
      return;
    }
    const loaded = loadDocument(value);
    if (!loaded.ok) {
      this.#emitError(loaded.reason);
      return;
    }
    // An older document only matches the current one once it has been migrated.
    if (!isSameDocument(loaded.document, current)) {
      this.#show(loaded);
    }
  }

  /** Returns the final HTML. MJML loads the first time this is called. */
  async exportHtml() {
    if (!this.#editor) {
      throw new Error("<mail-quilt> has no document to export");
    }
    return await renderEmail(this.#editor.getDocument(), {
      socialIconsUrl: this.socialIconsUrl,
    });
  }

  /**
   * Returns the email as plain text, to send beside its HTML, for email apps
   * that show only text. It needs no MJML, so it returns at once.
   */
  exportText() {
    if (!this.#editor) {
      throw new Error("<mail-quilt> has no document to export");
    }
    return renderText(this.#editor.getDocument());
  }

  override connectedCallback() {
    super.connectedCallback();
    // Laid out for its width from the first frame, rather than as on a laptop
    // and then, once the observer reports, as on a phone.
    const { clientWidth } = this;
    if (clientWidth > 0) {
      this.#phone = clientWidth < PHONE_LAYOUT_WIDTH;
    }
    this.#resizeObserver ??= new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const height = entry?.contentRect.height ?? 0;
      const phone = width < PHONE_LAYOUT_WIDTH;
      const changed =
        phone !== this.#phone ||
        height !== this.#height ||
        this.#docksMore(width) !== this.#docksMore(this.#width) ||
        JSON.stringify(this.#rowsListShape(width)) !==
          JSON.stringify(this.#rowsListShape(this.#width)) ||
        this.#docksAdd(width) !== this.#docksAdd(this.#width) ||
        this.#docksStyle(width) !== this.#docksStyle(this.#width) ||
        // Check draws its inbox smaller to fit, but on a phone.
        (this.#mode === "check" && !phone && width !== this.#width);
      // What's only on a phone closes with the phone layout.
      if (!phone) {
        this.#phoneSheet = undefined;
      }
      this.#phone = phone;
      this.#width = width;
      this.#height = height;
      if (changed) {
        // A frame later, as changing size inside this callback is reported as a
        // ResizeObserver loop error.
        requestAnimationFrame(() => this.requestUpdate());
      }
    });
    this.#resizeObserver.observe(this);
    const viewport = this.ownerDocument.defaultView?.visualViewport;
    viewport?.addEventListener("resize", this.#onViewport);
    viewport?.addEventListener("scroll", this.#onViewport);
    for (const type of CLIPBOARD_EVENTS) {
      this.ownerDocument.addEventListener(type, this.#keys.onClipboard, {
        capture: true,
      });
    }
    this.#dragging = createDragging({
      acceptsFiles: () => Boolean(this.uploadImage),
      onDrop: (source, position) => this.#editing.drop(source, position),
      onDropFiles: (files, target) => this.#uploads.drop(files, target),
      root: this.renderRoot,
      // As it's drawn, which a drag goes by.
      takesFiles: (blockId) => {
        const email = this.#rendered;
        return email ? locate(email, blockId)?.block.type === "image" : false;
      },
    });
    this.#insertHover = createInsertHover(this.renderRoot);
    this.#rowPictures = createRowPictures(this.renderRoot);
    this.#toolFitting = createToolFitting({
      onMove: () => this.#tooltips?.tooltips.sync(),
      root: this.renderRoot,
    });
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    const viewport = this.ownerDocument.defaultView?.visualViewport;
    viewport?.removeEventListener("resize", this.#onViewport);
    viewport?.removeEventListener("scroll", this.#onViewport);
    for (const type of CLIPBOARD_EVENTS) {
      this.ownerDocument.removeEventListener(type, this.#keys.onClipboard, {
        capture: true,
      });
    }
    this.#dragging?.destroy();
    this.#dragging = undefined;
    this.#insertHover?.destroy();
    this.#insertHover = undefined;
    this.#rowPictures?.destroy();
    this.#rowPictures = undefined;
    this.#toolFitting?.destroy();
    this.#toolFitting = undefined;
    this.#tooltips?.tooltips.destroy();
    this.#tooltips = undefined;
    this.#reset();
  }

  /**
   * Checks the Host app's fonts once for each list it gives, and loads the
   * email's web fonts into the page, which the Canvas draws in.
   */
  #takeFonts(changed: PropertyValues<this>, email: BlocksDocument | undefined) {
    if (changed.has("fonts")) {
      this.#fonts = usableFonts(this.fonts);
    }
    for (const font of email?.settings.fonts ?? []) {
      this.#webFonts.load(font);
    }
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has("mergeTags")) {
      for (const view of this.#views.values()) {
        view.showMergeTags();
      }
      this.#fieldMergeTags.showMergeTags();
      this.#syncFormats();
    }
    // The export names the icons' folder, and the check reads the Merge Tags.
    if (changed.has("socialIconsUrl") || changed.has("mergeTags")) {
      this.#check.forget();
    }
    this.#rendered = this.value;
    // There's nothing to style or check, and the Modes for them are off.
    if (!this.#rendered?.rows.length) {
      this.#mode = "edit";
      this.#stylePanel.forget();
    }
    if (this.#mode === "check" && this.isConnected) {
      this.#check.ensure();
    }
    const email = this.isConnected ? this.#rendered : undefined;
    this.#takeFonts(changed, email);
    const blocks = email ? blocksIn(email) : [];
    const blockIds = new Set(blocks.map(({ id }) => id));
    this.#focus.beforeUpdate();
    if (email) {
      this.#adding.beforeUpdate(
        new Map(
          email.rows.flatMap(({ columns }) =>
            columns.map(
              (column) =>
                [column.id, column.blocks.map(({ id }) => id)] as const
            )
          )
        )
      );
      this.#selection.beforeUpdate({
        blockIds,
        columnIds: new Set(
          email.rows.flatMap(({ columns }) => columns.map(({ id }) => id))
        ),
        rowIds: new Set(email.rows.map(({ id }) => id)),
      });
    }
    // Lit still updates detached elements, and nothing would destroy these
    // views. connectedCallback requests an update that creates them instead.
    if (!this.isConnected) {
      return;
    }
    for (const block of blocks) {
      if (hasRichText(block) && !this.#views.has(block.id)) {
        const { canBold, schema } = BLOCK_VIEWS[block.type].text;
        this.#views.set(
          block.id,
          createTextBlockView({
            canBold,
            content: block.props.content,
            label: this.#textLabel(block.type),
            mergeTags: this.#mergeTagsGiven,
            onChange: (next) => this.#commitText(block.id, next),
            onFocus: () => {
              // As on the Block: focus back in the text closes the link field.
              this.#linkForm.close();
              this.#selection.onTextFocus(block.id);
            },
            onKeyAnswered: (event) => this.#keys.onTextKeyAnswered(event),
            onPickerKey: (event) => this.#keys.onPickerKey(event),
            onStateChange: () => this.#syncFormats(),
            onTypingBreak: () => {
              this.#typingSession += 1;
            },
            schema,
          })
        );
      }
    }
    this.#removeViewsExcept(blockIds);
    const typeOf = new Map(blocks.map(({ id, type }) => [id, type]));
    for (const [blockId, view] of this.#views) {
      const type = typeOf.get(blockId);
      if (type) {
        view.setLabel(this.#textLabel(type));
      }
      view.setLang(this.#emailLang);
      view.setTabStop(blockId === this.#selection.blockId);
    }
  }

  protected override updated() {
    // First, so focus that moves scrolls to where the tools end up.
    this.#toolFitting?.sync();
    // Before focus moves, as it goes into them.
    if (this.isConnected && this.shadowRoot) {
      openSheets(this.shadowRoot);
    }
    this.#rowPictures?.sync();
    this.#focus.afterUpdate();
    this.#fixNote.sync();
    if (this.isConnected && this.shadowRoot) {
      this.#stylePanel.sync(this.shadowRoot);
      this.#syncTooltips(this.shadowRoot);
      showHighlightedTag(this.shadowRoot);
    }
  }

  /**
   * With no email, nothing, unless something is in the top bar's slots, such
   * as the Shell's name, Export and messages, which then show with the top
   * bar, its controls off.
   */
  protected override render() {
    const email = this.#rendered;
    if (!(email || this.querySelector(":scope > [slot]"))) {
      return nothing;
    }
    const text = this.#text;
    const language = text("language");
    const mode = this.#mode;
    const phone = this.#phone;
    const keys = blockKeys(text);
    const topBar = {
      canRedo: this.#editor?.canRedo() ?? false,
      canUndo: this.#editor?.canUndo() ?? false,
      checkCount: this.#check.count,
      device: this.#device,
      isEmpty: !email?.rows.length,
      mode,
      phone: phone
        ? {
            menuOpen: this.#phoneSheet !== undefined,
            typing: mode === "edit" && this.#selection.editingText,
          }
        : undefined,
      text,
    };

    return html`
      ${
        email
          ? html`
              ${this.#announcements.render()} ${this.#fixNote.render()}
              <p hidden id="block-keys" lang=${language}>
                ${text("canvas.blockKeys", keys)}
              </p>
              <p hidden id="block-keys-no-text" lang=${language}>
                ${text("canvas.blockKeysNoText", keys)}
              </p>
            `
          : nothing
      }
      <div
        class="ui frame app"
        data-place=${place("editor")}
        lang=${language}
        part="frame"
        ?data-phone=${phone}
      >
        ${renderTopBar(topBar, this.#topBarEvents)}
        <slot name="messages"></slot>
        ${email ? this.#renderCanvas(email) : nothing}
        ${(["edit", "style", "check"] as const)
          .filter((panel) => !(email && panel === this.#canvasMode))
          .map(
            (panel) => html`
              <div
                aria-labelledby=${modeTabId(panel)}
                class="mode-panel"
                id=${modePanelId(panel)}
                role="tabpanel"
                ?hidden=${mode !== panel}
              >
                ${
                  email && panel === "check" && mode === "check"
                    ? this.#renderCheck(email)
                    : nothing
                }
              </div>
            `
          )}
        ${
          // A new dialog for each, so the one opening takes focus.
          phone
            ? keyed(this.#phoneSheet, this.#renderPhoneSheet(email, topBar))
            : nothing
        }
        <div
          class="ui tooltip"
          data-place=${place("tooltip")}
          hidden
          role="tooltip"
        ></div>
      </div>
    `;
  }

  /** On a phone, the top bar's menu, or the Rows sheet from it, while open. */
  #renderPhoneSheet(
    email: BlocksDocument | undefined,
    topBar: Parameters<typeof renderTopBar>[0]
  ) {
    if (this.#phoneSheet === "menu" || (this.#phoneSheet && !email)) {
      return renderTopMenu(
        { ...topBar, rowCount: email?.rows.length ?? 0 },
        {
          ...this.#topBarEvents,
          close: this.#closePhoneSheet,
          openRows: () => {
            this.#phoneSheet = "rows";
            this.requestUpdate();
          },
        }
      );
    }
    if (this.#phoneSheet !== "rows" || !email) {
      return nothing;
    }
    const { settings } = email;
    const toEdit = () => {
      this.#phoneSheet = undefined;
      this.#topBarEvents.selectMode("edit");
    };
    return renderRowsSheet(
      this.#panelApi(email),
      {
        background: settings.backgroundColor,
        font: settings.fontFamily,
        width: this.#canvasWidths()?.email ?? settings.width,
      },
      {
        emailLang: this.#emailLang,
        failedImages: this.#failedImages,
        socialIconsUrl: this.socialIconsUrl,
        textPicture: (block) => this.#rowsList.textPicture(block),
      },
      {
        addRow: (fromKeyboard) => {
          toEdit();
          this.#adding.openPanel(fromKeyboard, fromKeyboard);
        },
        back: () => {
          this.#phoneSheet = "menu";
          this.requestUpdate();
          this.#focus.focusWhenRendered({ action: "rows", on: "topMenu" });
        },
        close: this.#closePhoneSheet,
        move: (rowId, direction) => {
          this.#editing.moveRow(rowId, direction);
          this.#focus.focusWhenRendered({
            move: direction,
            on: "rowsSheet",
            rowId,
          });
        },
        select: (rowId, fromKeyboard) => {
          toEdit();
          this.#selection.select({ rowId });
          this.#focus.revealRow(rowId);
          this.#focus.focusWhenRendered(
            { action: "chip", on: "bar" },
            { focusVisible: fromKeyboard }
          );
        },
      }
    );
  }

  /**
   * The Mode the Canvas is the panel of: Style, where the email is shown beside
   * its Email style, or else Edit, which it's hidden behind in Check.
   */
  get #canvasMode(): Mode {
    return this.#mode === "style" ? "style" : "edit";
  }

  /**
   * The Canvas, in Edit with its panels, or in Style,
   * where the email is only looked at, beside the Style panel.
   */
  #renderCanvas(email: BlocksDocument) {
    const { settings } = email;
    const api = this.#panelApi(email);
    const phone = this.#phone;
    const canvasMode = this.#canvasMode;
    const styling = canvasMode === "style";
    // The Phone view's email is a phone's width. Its Rows stack and hide as on
    // a phone once the Canvas draws Phone values.
    const width =
      this.#device === "phone"
        ? Math.min(settings.width, PHONE_WIDTH)
        : settings.width;
    return html`
      <div
        aria-labelledby=${modeTabId(canvasMode)}
        class=${styling ? "editor styling" : "editor"}
        data-testid="editor"
        id=${modePanelId(canvasMode)}
        role="tabpanel"
        ?hidden=${this.#mode === "check"}
        style=${styleProperties({
          "--_mq-editor-height": this.#height ? `${this.#height}px` : undefined,
          "--_mq-email-width": `${width}px`,
        })}
      >
        ${
          // First, as they're drawn first, so Tab reaches them in that order.
          // The Add panel takes the Rows list's place where it docks, and
          // otherwise opens over it. On a phone, it's a sheet from the top
          // bar's menu.
          styling || phone || this.#docksAdd(this.#width)
            ? nothing
            : renderRowsList(
                api,
                {
                  ...this.#shownRowsList(),
                  email: {
                    background: settings.backgroundColor,
                    font: settings.fontFamily,
                    width,
                  },
                },
                {
                  emailLang: this.#emailLang,
                  failedImages: this.#failedImages,
                  socialIconsUrl: this.socialIconsUrl,
                  textPicture: (block) => this.#rowsList.textPicture(block),
                }
              )
        }
        ${
          api.adding.panel && !styling
            ? renderAddPanel(api, this.#docksAdd(this.#width))
            : nothing
        }
        <div
          class="canvas-area"
          data-place=${place("workspace")}
          data-testid="workspace"
          @click=${styling ? this.#selectToStyle : this.#presses.onWorkspaceClick}
          @pointerdown=${this.#presses.onWorkspacePointerdown}
        >
          <div
            class="email"
            data-place=${place("email")}
            data-testid="email"
            ?inert=${styling}
            @beforeinput=${this.#keys.onBeforeInput}
            style=${styleProperties({
              // Also for what's dragged, which has nothing behind it.
              "--_mq-email-background": settings.backgroundColor,
              "background-color": settings.backgroundColor,
              "font-family": settings.fontFamily,
              width: `${width}px`,
            })}
          >
            ${renderRows(api, this.#canvasState, this.#canvasEvents)}
            <div
              class="drop-indicator"
              data-place=${place("dropIndicator")}
              data-testid="drop-indicator"
              hidden
            ></div>
          </div>
          ${
            styling
              ? nothing
              : html`${renderSelectionBar(api)}
                ${phone ? nothing : renderFloatingToolbar(api)}`
          }
        </div>
        ${
          !styling && api.bar.moreOpen && api.bar.docked
            ? renderMoreDock(api)
            : nothing
        }
        ${styling ? this.#renderStylePanel(email, api) : nothing}
      </div>
    `;
  }

  #renderCheck(email: BlocksDocument) {
    const room =
      this.#width - CHECK_PANEL_WIDTH_PX - 2 * CHECK_STAGE_PADDING_PX;
    return renderCheck({
      phone: this.#phone,
      check: this.#check,
      email,
      events: this.#checkEvents,
      mergeTags: this.mergeTags,
      sender: this.sender,
      sendsTests: Boolean(this.sendTest),
      subject: this.subject,
      text: this.#text,
      zoom: this.#phone ? 1 : checkZoom(room, email.settings.width),
    });
  }

  readonly #checkEvents = {
    onFix: (problem: Problem, note: FixNote) => this.#fix(problem, note),
    onSamples: (on: boolean) => this.#check.toggleSamples(on),
  };

  /**
   * Opens Edit with what a Problem is about selected and focus in the field
   * that fixes it, opening the popover or More it's in, with the Problem
   * under it. An unsubscribe link has no field, so it selects the last Row,
   * where an email's footer is.
   */
  #fix(problem: Problem, note: FixNote) {
    const email = this.#editor?.getDocument();
    if (!email) {
      return;
    }
    this.#topBarEvents.selectMode("edit");
    const { blockId, field } = problem;
    const position = blockId === undefined ? undefined : locate(email, blockId);
    let target: FocusTarget | undefined;
    if (position && field === "content") {
      this.#selection.select({ blockId: position.block.id });
      target = { blockId: position.block.id, on: "text" };
    } else if (position && field) {
      this.#selection.select({ blockId: position.block.id });
      this.#openFieldIn(fieldShownIn(position.block, field));
      // A Menu's link that says too little is the one with those words, of
      // those the email shows, as only they're checked.
      const { block } = position;
      const item =
        block.type === "menu" && problem.linkText !== undefined
          ? block.props.links.findIndex(
              ({ label, url }) =>
                url !== undefined && label?.trim() === problem.linkText
            )
          : -1;
      target = {
        draftKey: blockDraftKey(
          block.id,
          field,
          item === -1 ? undefined : { item: String(item), key: "label" }
        ),
        on: "field",
      };
    } else if (field && blockId === undefined) {
      this.#selection.select(undefined);
      // On a phone, the email's bar has no room for its fields, so More has them.
      this.#openFieldIn(
        this.#phone ? { in: "more" } : fieldShownIn("email", field)
      );
      target = {
        draftKey: draftKey({ id: "email", targetId: "" }, { key: field }),
        on: "field",
      };
    } else if (problem.code === "no-unsubscribe-link") {
      const last = email.rows.at(-1);
      if (last) {
        this.#selection.selectRow(last.id, true);
        this.#focus.revealRow(last.id);
      }
    }
    if (position) {
      this.#focus.revealBlock(position.block.id);
    }
    if (target) {
      this.#focus.focusWhenRendered(target, { focusVisible: true });
    }
    this.#fixNote.open(note);
    // The field's own name is heard as focus reaches it, and this after.
    this.#announcements.say(this.#text("check.fixSaid", { ...note }));
  }

  /** Opens the popover or More a field is shown in, if it's in one. */
  #openFieldIn(shownIn: ReturnType<typeof fieldShownIn>) {
    const { state } = this.#barPanels;
    if (shownIn.in === "popover" && state.popover !== shownIn.id) {
      this.#barPanels.togglePopover(shownIn.id);
    } else if (shownIn.in === "more" && !state.moreOpen) {
      this.#barPanels.toggleMore(true);
    }
  }

  /** Docked beside the email where both fit, and otherwise over the Canvas's edge. */
  #renderStylePanel(email: BlocksDocument, api: PanelApi) {
    const docked = this.#docksStyle(this.#width);
    const panel = this.#stylePanel.render({
      email,
      floating: !docked,
      phone: this.#phone
        ? {
            done: () => {
              this.#topBarEvents.selectMode("edit");
              this.#focus.focusWhenRendered({ on: "emailTools" });
            },
          }
        : undefined,
      selected: api.selectedBlock?.block,
    });
    if (this.#phone) {
      return panel;
    }
    return docked
      ? html`<div class="style-dock">${panel}</div>`
      : html`<div class="style-float">${panel}</div>`;
  }

  /**
   * In Style, the email is only looked at, so it takes no presses. One
   * selects the Block under it, which the Style panel then says what keeps
   * its own value, or with none there, nothing.
   */
  readonly #selectToStyle = ({ clientX, clientY }: MouseEvent) => {
    const block = findPlaces(this.renderRoot, "block").find((element) => {
      const { bottom, left, right, top } = element.getBoundingClientRect();
      return (
        clientX >= left &&
        clientX <= right &&
        clientY >= top &&
        clientY <= bottom
      );
    });
    const blockId = block?.dataset.blockId;
    this.#selection.select(blockId === undefined ? undefined : { blockId });
  };

  /** Whether the Style panel docks beside the email at `width`. */
  #docksStyle(width: number) {
    const widths = this.#canvasWidths();
    return widths !== undefined && width >= widths.withGutters + PANEL_WIDTH_PX;
  }

  /** The email's width on the Canvas, and with its gutters. */
  #canvasWidths() {
    const settings = this.#editor?.getDocument().settings;
    if (!settings) {
      return;
    }
    const email =
      this.#device === "phone"
        ? Math.min(settings.width, PHONE_WIDTH)
        : settings.width;
    return { email, withGutters: email + 2 * CANVAS_GUTTER_PX };
  }

  /**
   * Whether the Add panel, while it's open, docks beside the email at
   * `width`: where the email, its gutters and the panel fit side by side.
   * Below that, it floats over the Canvas's edge.
   */
  #docksAdd(width: number) {
    const widths = this.#canvasWidths();
    return (
      this.#adding.state.panel !== undefined &&
      widths !== undefined &&
      width >= widths.withGutters + ADD_WIDTH_PX
    );
  }

  /**
   * Whether the Rows list is expanded at `width`, and whether, expanded, it's
   * over the Canvas's start rather than beside the email. Until the person
   * expands or collapses it, it's expanded where it fits beside the email
   * with More docked too, and collapsed below that.
   */
  #rowsListShape(width: number) {
    const widths = this.#canvasWidths();
    const room = (list: number) =>
      widths !== undefined && width >= widths.withGutters + list;
    const expanded =
      this.#rowsList.state.expanded ??
      room(ROWS_LIST_WIDTH_PX + PANEL_WIDTH_PX);
    return { expanded, floating: expanded && !room(ROWS_LIST_WIDTH_PX) };
  }

  /**
   * The Rows list as it's drawn. Where it would open over the Canvas, it stays
   * collapsed while the Add panel is open over the Canvas there too.
   */
  #shownRowsList() {
    const shape = this.#rowsListShape(this.#width);
    return shape.floating && this.#adding.state.panel
      ? { expanded: false, floating: false }
      : shape;
  }

  /** How wide the Add panel or the Rows list is beside the email at `width`. */
  #startWidth(width: number) {
    if (this.#docksAdd(width)) {
      return ADD_WIDTH_PX;
    }
    const { expanded, floating } = this.#rowsListShape(width);
    return expanded && !floating
      ? ROWS_LIST_WIDTH_PX
      : ROWS_LIST_COLLAPSED_WIDTH_PX;
  }

  /**
   * The Add panel over the Canvas's start closes once it adds, as what it
   * added could be under it. Docked, it stays open to add another.
   */
  #closeFloatingAdd() {
    if (!this.#docksAdd(this.#width)) {
      this.#adding.closePanel(false);
    }
  }

  /**
   * Whether More docks beside the email at `width`: where the email, its
   * gutters, More and the Rows list or a docked Add panel fit side by side.
   * Below that, it floats.
   */
  #docksMore(width: number) {
    const widths = this.#canvasWidths();
    return (
      widths !== undefined &&
      width >= widths.withGutters + PANEL_WIDTH_PX + this.#startWidth(width)
    );
  }

  /**
   * More's Paste below: what's on the clipboard, once the browser lets the
   * editor read it, pasted as Ctrl/⌘+V would paste it.
   */
  async #pasteBelow() {
    // The email the paste is for, as the host can give another while the
    // browser asks the person.
    const editor = this.#editor;
    const data = new DataTransfer();
    try {
      const items = await navigator.clipboard.read();
      // What a paste event's data has: HTML and text, and image files.
      const formats = await Promise.all(
        items.flatMap((item) =>
          item.types.map(async (type) => {
            const blob = await item.getType(type);
            return {
              blob,
              text: type.startsWith("text/") ? await blob.text() : "",
              type,
            };
          })
        )
      );
      for (const { blob, text, type } of formats) {
        if (type.startsWith("image/")) {
          data.items.add(new File([blob], "pasted", { type }));
        } else if (type === "text/html" || type === "text/plain") {
          data.setData(type, text);
        }
      }
    } catch {
      this.#announcements.say(this.#text("paste.notAllowed"));
      return;
    }
    if (this.#editor !== editor) {
      return;
    }
    this.#editing.paste(readPasted(data) ?? { refused: "notCopied" });
  }

  /** What the Add panel, the Selection bar and More show, and what they do. */
  #panelApi(email: BlocksDocument): PanelApi {
    // Only with a tag the picker can offer.
    const offersTags =
      this.mergeTags?.some(({ name }) => isMergeTagName(name)) ?? false;
    return {
      ...this.#panelActions,
      adding: this.#adding.state,
      device: this.#device,
      notOnDevice: this.#notOnDevice,
      phone: this.#phone,
      bar: {
        ...this.#barPanels.state,
        docked: this.#docksMore(this.#width),
      },
      canRedo: this.#editor?.canRedo() ?? false,
      canUndo: this.#editor?.canUndo() ?? false,
      editingText: this.#selection.editingText,
      email,
      fieldMergeTags: offersTags
        ? {
            pick: this.#pickFieldMergeTag,
            shown: this.#fieldMergeTags.shown,
          }
        : undefined,
      formats: this.#formats,
      insertMergeTag: offersTags ? this.#insertMergeTag : undefined,
      linkField: this.#linkForm.state,
      rowsList: this.#rowsList.state,
      mergeTagPicker: this.#mergeTagPicker,
      selectedBlock: this.#editing.selectedBlock(email),
      selectedColumn: this.#editing.selectedColumn(email),
      selectedRow: this.#editing.selectedRow(email),
      text: this.#text,
      uploadErrorOf: this.#uploads.errorOf,
      uploadImage: this.uploadImage ? this.#uploadImage : undefined,
      videos: this.#videos,
    };
  }

  get #canvasState(): CanvasState {
    const email = this.#rendered;
    return {
      emailLang: this.#emailLang,
      styleMarks:
        this.#mode === "style" && email
          ? this.#stylePanel.marks(email)
          : NO_MARKS,
      failedImages: this.#failedImages,
      isUploading: this.#uploads.isUploading,
      isAddingPlay: this.#videos.isAdding,
      socialIconsUrl: this.socialIconsUrl,
      textOf: (blockId) => this.#views.get(blockId)?.element,
    };
  }

  /**
   * On each Block's content. With none set, it's unknown, as in the export. A
   * Merge Tag is unknown too until it's filled, and isn't a language a screen
   * reader could read the Canvas in.
   */
  get #emailLang() {
    const language = this.#rendered?.settings.language ?? "";
    return language.startsWith("{{") ? "" : language;
  }

  /** What a screen reader calls a Block's text. */
  readonly #textLabel = (type: BlockType) =>
    this.#text("canvas.textOf", { type: blockTypeName(type, this.#text) });

  readonly #insertMergeTag = () =>
    this.#selection.selectedText?.startMergeTag();

  readonly #pickFieldMergeTag = (index: number) =>
    this.#fieldMergeTags.pickMergeTag(index);

  /**
   * The formats and the Merge Tag picker the text shows. Re-renders only on a
   * change, because this runs on every transaction.
   */
  #syncFormats() {
    const text = this.#selection.selectedText;
    const formats = text?.formats();
    const picker = text?.mergeTagPicker();
    if (
      JSON.stringify([formats, picker]) !==
      JSON.stringify([this.#formats, this.#mergeTagPicker])
    ) {
      this.#formats = formats;
      this.#mergeTagPicker = picker;
      this.requestUpdate();
    }
  }

  #onImageError(src: string) {
    this.#failedImages.add(src);
    this.requestUpdate();
  }

  /**
   * Applies a Command and reports a change with `mq-change`. A rejection is a bug
   * here unless it's `refusable`, as what a person typed is. Text on the canvas
   * shows its own change, so it needs no `render`.
   */
  #apply(
    command: Command,
    {
      mergeKey,
      refusable = false,
      render = true,
    }: { mergeKey?: string; refusable?: boolean; render?: boolean } = {}
  ) {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    const could = { redo: editor.canRedo(), undo: editor.canUndo() };
    const result = editor.apply(command, { mergeKey });
    if (!result.ok) {
      if (!(result.code === "unchanged" || refusable)) {
        // The controls only offer what's allowed, so this is a bug here.
        console.error(`<mail-quilt> rejected a Command: ${result.reason}`);
      }
      return result;
    }
    // Undo and Redo show whether there's a step to take, typing included.
    if (
      render ||
      could.undo !== editor.canUndo() ||
      could.redo !== editor.canRedo()
    ) {
      this.requestUpdate();
    }
    this.#emitChange(editor.getDocument());
    return result;
  }

  /** The text schema is no wider than core's, so a rejection is a bug here. */
  #commitText(blockId: string, content: RichTextDocument) {
    const now = performance.now();
    if (now - this.#lastTypedAt >= TYPING_PAUSE_MS) {
      this.#typingSession += 1;
    }
    this.#lastTypedAt = now;
    this.#apply(
      { blockId, props: { content }, type: "updateBlockProps" },
      {
        mergeKey: `${blockId}:${this.#typingSession}`,
        // The Rows list's picture of it, where the list shows pictures.
        render: !this.#docksAdd(this.#width) && this.#shownRowsList().expanded,
      }
    );
  }

  /** A new render can replace the tooltip, along with everything else. */
  #syncTooltips(root: ShadowRoot) {
    const element = findPlace(root, "tooltip");
    if (element !== this.#tooltips?.element) {
      this.#tooltips?.tooltips.destroy();
      this.#tooltips = element
        ? { element, tooltips: createTooltips({ root, tooltip: element }) }
        : undefined;
    }
    this.#tooltips?.tooltips.sync();
  }

  #stepHistory(step: "redo" | "undo") {
    const editor = this.#editor;
    if (!editor) {
      return;
    }
    if (!editor[step]()) {
      return;
    }
    // The change can move the selection the link field would apply to.
    this.#linkForm.close();
    // What was refused may be fine now, and the fields show what's come back.
    this.#drafts.clear();
    this.#editing.historyStepped(step);
    const email = editor.getDocument();
    for (const block of blocksIn(email)) {
      if (hasRichText(block)) {
        this.#views.get(block.id)?.setContent(block.props.content);
      }
    }
    // Undo and redo can add, remove or move Blocks, Columns and Rows.
    this.requestUpdate();
    this.#emitChange(email);
  }

  /** Opens an email that `loadDocument` accepted, or none. */
  #show(loaded: Extract<LoadResult, { ok: true }> | undefined) {
    const hadFocus = Boolean(this.shadowRoot?.activeElement);
    this.#check.forget();
    this.#announcements.clear();
    this.#drafts.clear();
    // A URL that failed before may load now, as its image may have been
    // uploading, or the connection down.
    this.#failedImages.clear();
    // Their Blocks are gone with the email they were in.
    this.#uploads.clear();
    this.#videos.clear();
    this.#rowsList.forget();
    this.#stylePanel.forget();
    this.#reset();
    // Checked once, by the value's setter.
    this.#editor = loaded && editorOfLoaded(loaded);
    this.#editor?.subscribe(this.#editing.onOperations);
    this.#editor?.subscribe(this.#uploads.onChange);
    this.#editor?.subscribe(this.#videos.onChange);
    this.requestUpdate();
    // Taking down the text views took focus out of the editor if it was in
    // one, before the update could see where it was.
    if (hadFocus && !this.shadowRoot?.activeElement) {
      this.#focus.focusWhenRendered({ on: "emailTools" });
    }
  }

  /** With a copy of the email, which the host owns and may change. */
  #emitChange(email: BlocksDocument) {
    this.#check.forget();
    this.#fixNote.close();
    this.dispatchEvent(
      new CustomEvent("mq-change", {
        bubbles: true,
        composed: true,
        detail: { document: email },
      })
    );
  }

  #emitError(reason: string) {
    // Later, because a host may set `value` just before adding its listener.
    queueMicrotask(() => {
      this.dispatchEvent(
        new CustomEvent("mq-error", {
          bubbles: true,
          composed: true,
          detail: { reason },
        })
      );
    });
  }

  /** A Block that undo brings back gets a new view from the document. */
  #removeViewsExcept(blockIds: Set<string>) {
    for (const [blockId, view] of this.#views) {
      if (!blockIds.has(blockId)) {
        view.destroy();
        this.#views.delete(blockId);
      }
    }
  }

  /** Destroys the text views, and the selection that describes them. */
  #reset() {
    for (const view of this.#views.values()) {
      view.destroy();
    }
    this.#views.clear();
    // The toolbar's state describes those views and their selections.
    this.#selection.select(undefined);
    this.#fixNote.close();
  }
}

if (!customElements.get("mail-quilt")) {
  customElements.define("mail-quilt", MailQuilt);
}

/** Fired with the new document after each change. */
export type MailQuiltChangeEvent = CustomEvent<{ document: BlocksDocument }>;
/** Fired when a document set as `value` is refused, with why. */
export type MailQuiltErrorEvent = CustomEvent<{ reason: string }>;

declare global {
  interface HTMLElementEventMap {
    "mq-change": MailQuiltChangeEvent;
    "mq-error": MailQuiltErrorEvent;
  }

  interface HTMLElementTagNameMap {
    "mail-quilt": MailQuilt;
  }
}
