import type { RichTextDocument } from "@mailquilt/core";
import { EMAIL_LOOK } from "@mailquilt/core/internal";
import { css, unsafeCSS } from "lit";
import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import { Fragment, Slice } from "prosemirror-model";
import type { MarkType, Node as ProseMirrorNode } from "prosemirror-model";
import {
  EditorState,
  Plugin,
  Selection,
  TextSelection,
} from "prosemirror-state";
import type { Command as TextCommand, Transaction } from "prosemirror-state";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
} from "prosemirror-transform";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import type { NodeViewConstructor } from "prosemirror-view";

import { place } from "./editor-places.js";
import { scaleOf } from "./geometry.js";
import { proseMirrorKeys } from "./key-map.js";
import {
  closeMergeTagPicker,
  mergeTagPicker,
  mergeTagsFromText,
  moveInMergeTagPicker,
  pickerOf,
  pickMergeTag,
  startMergeTag,
} from "./merge-tags.js";
import type { MergeTag, MergeTagPickerState } from "./merge-tags.js";
import { pastedHtmlParser, withoutStyles } from "./pasted-html.js";
import {
  atParagraphOffset,
  createTextCommands,
  LIST_FORMATTING,
  paragraphOffset,
} from "./text-commands.js";
import type { ListType, TextFormats, ToggleableMark } from "./text-commands.js";
import type { TextSchema } from "./text-schema.js";

/** ProseMirror's base styles, for a Block's text (ADR 0002). */
export const textBlockStyles = css`
  .ProseMirror {
    font-variant-ligatures: none;
    overflow-wrap: break-word;
    padding: ${unsafeCSS(EMAIL_LOOK.blockPadding)};
    position: relative;
    white-space: pre-wrap;
    white-space: break-spaces;
  }

  .ProseMirror:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .ProseMirror p {
    margin: 0;
  }

  /* As the export writes them: indented by a margin, numbered from 1. */
  .ProseMirror :is(ul, ol) {
    margin: 0 0 0 1.5em;
    padding: 0;
  }

  /* In the Block's color, as the export writes it, and underlined. */
  .ProseMirror a {
    color: inherit;
  }

  /* A Merge Tag, one unit showing its name, in the text's own color. */
  .ProseMirror [data-merge-tag] {
    background: var(--mq-color-accent-soft);
    border-radius: var(--mq-radius-small);
    box-shadow: inset 0 0 0 1px var(--mq-color-outline-hover);
    padding: 0 var(--mq-space-1);
  }

  /*
   * Hidden, but still inline, so a screen reader reads {{name}} with no space
   * added inside the braces, as it would around a block.
   */
  .ProseMirror .merge-tag-hidden {
    font-size: 0;
  }
`;

/** The open Merge Tag picker, with where it goes in the Block. */
export interface ShownMergeTagPicker extends MergeTagPickerState {
  /** The line the `{{` is on, from the Block's top left, in CSS pixels. */
  anchor: { bottom: number; left: number; top: number };
}

const hiddenText = (text: string) => {
  const span = document.createElement("span");
  span.className = "merge-tag-hidden";
  span.textContent = text;
  return span;
};

/**
 * A Merge Tag on the Canvas, showing its label from the Host app's list, or else
 * its name. A screen reader reads `{{name}}`, which its tooltip shows too. The
 * schema's own DOM, with the name, is what's copied.
 */
const mergeTagView =
  (tags: () => readonly MergeTag[]): NodeViewConstructor =>
  (node) => {
    const name = node.attrs.name as string;
    const label = tags().find((tag) => tag.name === name)?.label;
    const dom = document.createElement("span");
    dom.dataset.mergeTag = name;
    dom.dataset.tooltip = `{{${name}}}`;
    if (label) {
      const shown = document.createElement("span");
      shown.setAttribute("aria-hidden", "true");
      shown.textContent = label;
      dom.append(hiddenText(`{{${name}}}`), shown);
    } else {
      dom.append(hiddenText("{{"), name, hiddenText("}}"));
    }
    return { dom };
  };

export interface TextBlockView {
  element: HTMLElement;
  /**
   * Shows `content` without reporting a change, and puts the cursor after the
   * text that changed.
   */
  setContent: (content: RichTextDocument) => void;
  /**
   * The email's language, on each paragraph. The text box around them keeps the
   * editor's, as its name is the editor's own.
   */
  setLang: (lang: string) => void;
  focus: () => void;
  formats: () => TextFormats;
  toggleMark: (mark: ToggleableMark) => void;
  toggleList: (type: ListType) => void;
  insertLineBreak: () => void;
  /**
   * Links the selected text. With none, changes the link the cursor is in, or
   * else adds the URL as the linked text.
   */
  setLink: (href: string) => void;
  removeLink: () => void;
  /** Types `{{` at the cursor, which opens the Merge Tag picker. */
  startMergeTag: () => void;
  /** The open Merge Tag picker, or undefined while it's closed. */
  mergeTagPicker: () => ShownMergeTagPicker | undefined;
  /** Highlights the next tag in the open picker, or the one before. */
  moveInMergeTagPicker: (step: -1 | 1) => void;
  /** Puts in the highlighted tag, or the one at `index`. */
  pickMergeTag: (index?: number) => void;
  closeMergeTagPicker: () => void;
  /** Shows the tags with the Host app's labels again, after its list changed. */
  showMergeTags: () => void;
  destroy: () => void;
}

/**
 * Formatting is its own undo step, unlike the typing around it. A line break
 * and a List count as formatting, as they're added from the format bar too.
 */
const changesFormatting = (transaction: Transaction) =>
  transaction.getMeta(LIST_FORMATTING) === true ||
  transaction.steps.some(
    (step) =>
      step instanceof AddMarkStep ||
      step instanceof RemoveMarkStep ||
      (step instanceof ReplaceStep &&
        step.slice.content.firstChild?.type.name === "hardBreak")
  );

/** Marks what `setContent` shows, as on undo, which isn't the user's to report. */
const FROM_SET_CONTENT = "mailquilt:fromSetContent";

/**
 * Where the cursor belongs once `current` has become `next`, or undefined if
 * they match. Removing the "l" typed in "Hell|lo" could be read as a change at
 * several points, so the cursor's own position chooses between them.
 */
const cursorAfterChange = (
  current: ProseMirrorNode,
  next: ProseMirrorNode,
  cursor: number
) => {
  const start = current.content.findDiffStart(next.content);
  const end = next.content.findDiffEnd(current.content);
  if (start === null || !end) {
    return;
  }
  const moved = cursor + next.content.size - current.content.size;
  return Math.max(
    Math.min(start, end.a),
    Math.min(moved, Math.max(start, end.a))
  );
};

/**
 * A text's paragraphs, each as its text, so that a change of structure alone,
 * such as a List turned on or off, reads as no change.
 */
const paragraphsOf = (doc: ProseMirrorNode) =>
  doc.textBetween(0, doc.content.size, "\u2029");

/** Marks a focus change: true when the text gains focus, false when it loses it. */
const FOCUSED = "mailquilt:focused";

/**
 * Pasted or dropped text with each tab as a space, and no bold for a Block that
 * can't have it. The canvas would show a tab at a tab stop, which no email
 * client can draw, and the export as one space.
 */
const asPasted = (fragment: Fragment, bold?: MarkType): Fragment =>
  Fragment.from(
    fragment.content.map((node) => {
      if (!node.isLeaf) {
        return node.copy(asPasted(node.content, bold));
      }
      const marks = bold ? bold.removeFromSet(node.marks) : node.marks;
      const text = node.text ?? "";
      return node.isText && text.includes("\t")
        ? node.type.schema.text(text.replaceAll("\t", " "), marks)
        : node.mark(marks);
    })
  );

interface TextBlockViewHost {
  /** False for text that's bold already, where the mark would change nothing. */
  canBold: boolean;
  content: RichTextDocument;
  /** What a screen reader calls the text box. */
  label: string;
  /** The Host app's Merge Tags, for the picker and the labels shown. */
  mergeTags: () => readonly MergeTag[];
  onChange: (content: RichTextDocument) => void;
  onFocus: () => void;
  /**
   * Called for each key the text's own keys, or ProseMirror's base keys,
   * answered, which the key map then leaves alone.
   */
  onKeyAnswered: (event: KeyboardEvent) => void;
  /**
   * Asked first of each key while the Merge Tag picker is open, and whether it
   * answered the key.
   */
  onPickerKey: (event: KeyboardEvent) => boolean;
  /** Called after anything that may change what `formats` returns. */
  onStateChange: () => void;
  /** Called when the next change shouldn't merge with the last as typing. */
  onTypingBreak: () => void;
  /** What the Block's type of text can hold. */
  schema: TextSchema;
}

/**
 * Owns the DOM and ProseMirror view of one Block's text. Lit only puts
 * `element` on the canvas, so the view survives re-renders. The editor keeps
 * the one undo history, so ProseMirror's isn't loaded.
 */
export const createTextBlockView = ({
  canBold,
  content,
  label,
  mergeTags,
  onChange,
  onFocus,
  onKeyAnswered,
  onPickerKey,
  onStateChange,
  onTypingBreak,
  schema,
}: TextBlockViewHost): TextBlockView => {
  const element = document.createElement("div");
  // Unknown until set, as in the export of an email with no language.
  let lang = "";
  const commands = createTextCommands(schema, { canBold });
  const textKeys = proseMirrorKeys();
  const answerTextKey = keydownHandler(
    Object.fromEntries(
      textKeys.map(([key, action]) => [key, commands.forKey[action]])
    )
  );
  // The keys the key map leaves to ProseMirror, such as select all.
  const answerBaseKey = keydownHandler(
    Object.fromEntries(
      Object.entries(baseKeymap).filter(
        ([key]) => !textKeys.some(([named]) => named === key)
      )
    )
  );

  const view = new EditorView(element, {
    attributes: {
      "aria-label": label,
      "aria-multiline": "true",
      "data-place": place("text"),
      role: "textbox",
      tabindex: "0",
    },
    clipboardParser: pastedHtmlParser(schema),
    // On each paragraph, a List's items' too.
    decorations: ({ doc }) => {
      const paragraphs: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (!node.isTextblock) {
          return true;
        }
        paragraphs.push(Decoration.node(pos, pos + node.nodeSize, { lang }));
        return false;
      });
      return DecorationSet.create(doc, paragraphs);
    },
    dispatchTransaction(this: EditorView, transaction: Transaction) {
      // The editor can still call a view it has taken down.
      if (this.isDestroyed) {
        return;
      }
      const before = this.state;
      // With what plugins add to it.
      const { state: after } = before.applyTransaction(transaction);
      this.updateState(after);
      // Turning bold on at the cursor changes the next text but not the email.
      if (transaction.storedMarksSet && !transaction.docChanged) {
        onTypingBreak();
      }
      onStateChange();
      if (!before.selection.eq(after.selection) && !transaction.docChanged) {
        onTypingBreak();
      }
      const focused = transaction.getMeta(FOCUSED) as boolean | undefined;
      if (focused === true) {
        onFocus();
      } else if (focused === false) {
        onTypingBreak();
      }
      if (transaction.getMeta(FROM_SET_CONTENT) || before.doc.eq(after.doc)) {
        return;
      }
      // ProseMirror marks a paste, cut or drop, which are never typing.
      const isTyping =
        transaction.getMeta("uiEvent") === undefined &&
        !changesFormatting(transaction);
      if (!isTyping) {
        onTypingBreak();
      }
      onChange(after.doc.toJSON() as RichTextDocument);
      if (!isTyping) {
        onTypingBreak();
      }
    },
    handleDOMEvents: {
      blur: ({ dispatch, state }) => {
        dispatch(state.tr.setMeta(FOCUSED, false));
        return false;
      },
      // A page's router, such as Astro's or Turbo's, follows a click on any
      // link to its own site, even inside the editor, unless it's handled.
      click: (_view, event) => {
        if ((event.target as Element).closest("a")) {
          event.preventDefault();
        }
        return false;
      },
      focus: ({ dispatch, state }) => {
        dispatch(state.tr.setMeta(FOCUSED, true));
        return false;
      },
    },
    nodeViews: { mergeTag: mergeTagView(mergeTags) },
    state: EditorState.create({
      doc: schema.nodeFromJSON(content),
      plugins: [
        new Plugin({
          props: {
            handleKeyDown: (target, event) => {
              const answered =
                (pickerOf(target.state) !== undefined && onPickerKey(event)) ||
                answerTextKey(target, event) ||
                answerBaseKey(target, event);
              if (answered) {
                onKeyAnswered(event);
              }
              return answered;
            },
          },
        }),
        mergeTagsFromText(
          schema,
          (transaction) => transaction.getMeta(FROM_SET_CONTENT) === true
        ),
        mergeTagPicker(mergeTags),
      ],
    }),
    transformPasted: (slice) =>
      new Slice(
        asPasted(slice.content, canBold ? undefined : schema.marks.bold),
        slice.openStart,
        slice.openEnd
      ),
    transformPastedHTML: withoutStyles,
  });

  /** Runs a command on the text, then puts focus back in it. */
  const run = (command: TextCommand) => {
    command(view.state, view.dispatch);
    view.focus();
  };

  return {
    closeMergeTagPicker: () => closeMergeTagPicker(view.state, view.dispatch),
    destroy: () => view.destroy(),
    element,
    focus: () => view.focus(),
    formats: () => commands.formats(view.state),
    insertLineBreak: () => run(commands.insertLineBreak),
    mergeTagPicker: () => {
      const picker = pickerOf(view.state);
      if (!picker) {
        return;
      }
      // From the Block, which the element sits in, as a host page may scale
      // what's on screen.
      const at = view.coordsAtPos(picker.from);
      const box = element.getBoundingClientRect();
      const scaleX = scaleOf(box.width, element.offsetWidth);
      const scaleY = scaleOf(box.height, element.offsetHeight);
      return {
        ...picker,
        anchor: {
          bottom: (at.bottom - box.top) / scaleY + element.offsetTop,
          left: (at.left - box.left) / scaleX + element.offsetLeft,
          top: (at.top - box.top) / scaleY + element.offsetTop,
        },
      };
    },
    moveInMergeTagPicker: (step) =>
      moveInMergeTagPicker(step)(view.state, view.dispatch),
    pickMergeTag: (index) => run(pickMergeTag(index)),
    removeLink: () => run(commands.removeLink),
    setContent: (next) => {
      const { doc, selection } = view.state;
      const nextDoc = schema.nodeFromJSON(next);
      const cursor = cursorAfterChange(doc, nextDoc, selection.head);
      if (cursor === undefined) {
        return;
      }
      // Undoing a format change leaves every position where it was.
      const keepsSelection =
        doc.content.size === nextDoc.content.size &&
        doc.textContent === nextDoc.textContent;
      // Undoing a List keeps the selection on the same text, which the List's
      // structure has moved.
      const keepsText = paragraphsOf(doc) === paragraphsOf(nextDoc);
      const tr = view.state.tr.replaceWith(
        0,
        doc.content.size,
        nextDoc.content
      );
      const onSameText = (pos: number) =>
        atParagraphOffset(tr.doc, paragraphOffset(doc, pos));
      if (keepsSelection) {
        tr.setSelection(selection.getBookmark().resolve(tr.doc));
      } else if (keepsText) {
        tr.setSelection(
          TextSelection.create(
            tr.doc,
            onSameText(selection.anchor),
            onSameText(selection.head)
          )
        );
      } else {
        // The position can fall between paragraphs, which can't hold a cursor.
        tr.setSelection(Selection.near(tr.doc.resolve(cursor)));
      }
      view.dispatch(tr.setMeta(FROM_SET_CONTENT, true));
    },
    setLang: (next) => {
      if (next !== lang) {
        lang = next;
        // Reads the decorations again.
        view.updateState(view.state);
      }
    },
    setLink: (href) => run(commands.setLink(href)),
    // A new view for each tag redraws them all, and changes nothing else.
    showMergeTags: () =>
      view.setProps({ nodeViews: { mergeTag: mergeTagView(mergeTags) } }),
    startMergeTag: () => run(startMergeTag),
    toggleList: (type) => run(commands.toggleList(type)),
    toggleMark: (mark) => run(commands.toggleMark(mark)),
  };
};
