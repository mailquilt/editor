import { matching } from "./merge-tags.js";
import type { MergeTag } from "./merge-tags.js";

/**
 * The Merge Tag picker in a field that holds text or a URL: a settings field,
 * or the link field. It opens on `{{` as it does in a Block's text, and puts
 * in the text `{{name}}`, which stays plain text there. An input takes part by
 * having `data-merge-tags`, which the editor's own text inputs all have.
 */

/** The open picker under a field, as it shows. */
export interface ShownFieldPicker {
  /** The `id` of the field it's under. */
  fieldId: string;
  /** The index in `options` of the tag that Enter puts in. */
  highlighted: number;
  options: readonly MergeTag[];
}

/** The `{{` before a field's cursor, where it starts, and what's typed after it. */
interface Query {
  from: number;
  text: string;
}

const queryIn = ({ selectionEnd, selectionStart, value }: HTMLInputElement) => {
  if (selectionStart === null || selectionStart !== selectionEnd) {
    return;
  }
  const match = /\{\{(?<text>[^{}]*)$/u.exec(value.slice(0, selectionStart));
  return match
    ? { from: match.index, text: match.groups?.text ?? "" }
    : undefined;
};

/** A field that opens the picker. */
export const takesMergeTags = (
  target: EventTarget | null
): target is HTMLInputElement =>
  target instanceof HTMLInputElement && target.dataset.mergeTags !== undefined;

interface FieldMergeTagsHost {
  tags: () => readonly MergeTag[];
  requestUpdate: () => void;
}

export const createFieldMergeTags = ({
  requestUpdate,
  tags,
}: FieldMergeTagsHost) => {
  /** The field with focus that the picker follows. */
  let field: HTMLInputElement | undefined;
  let query: Query | undefined;
  /** Where the query starts that Escape closed. */
  let closedAt: number | undefined;
  let highlighted = 0;
  let shown: ShownFieldPicker | undefined;

  /** Re-renders only on a change, as this runs on every key. */
  const show = () => {
    const options =
      field && query && closedAt !== query.from
        ? matching(tags(), query.text)
        : [];
    const next =
      field && options.length > 0
        ? {
            fieldId: field.id,
            highlighted: Math.min(highlighted, options.length - 1),
            options,
          }
        : undefined;
    if (JSON.stringify(next) !== JSON.stringify(shown)) {
      shown = next;
      requestUpdate();
    }
  };

  /** Reads the field again after what was typed, or where its cursor went. */
  const follow = (input: HTMLInputElement) => {
    const next = queryIn(input);
    if (
      input !== field ||
      next?.from !== query?.from ||
      next?.text !== query?.text
    ) {
      highlighted = 0;
    }
    if (input !== field || !next) {
      closedAt = undefined;
    }
    field = input;
    query = next;
    show();
  };

  return {
    /** Closes the open picker, and leaves what's typed. */
    closeMergeTagPicker: () => {
      if (shown) {
        closedAt = query?.from;
        show();
      }
    },
    /** Whether the picker is open under `target`. */
    isOpenIn: (target: EventTarget | null) =>
      shown !== undefined && target === field,
    /** Highlights the next tag, or the one before, both ways round. */
    moveInMergeTagPicker: (step: -1 | 1) => {
      if (shown) {
        const count = shown.options.length;
        highlighted = (shown.highlighted + step + count) % count;
        show();
      }
    },
    /**
     * Typing, or a press or key that can move the cursor, in a field that takes
     * Merge Tags.
     */
    onFieldEvent: ({ target }: Event) => {
      if (takesMergeTags(target)) {
        follow(target);
      }
    },
    /** Not when the window loses focus, as focus comes back to the field. */
    onFocusout: ({ target }: FocusEvent) => {
      if (target === field && document.hasFocus()) {
        field = undefined;
        query = undefined;
        show();
      }
    },
    /**
     * Puts in the highlighted tag, or the one at `index`, as `{{name}}` in place
     * of the `{{` and what's typed after it. It's typed as a person types, so
     * the field's own undo takes it back, and it's committed as typing is.
     */
    pickMergeTag: (index?: number) => {
      const tag = shown?.options[index ?? shown.highlighted];
      // Read again, as the field's value can be replaced without typing, such
      // as by an upload that finishes.
      const typed = field && queryIn(field);
      if (!(field && typed && tag)) {
        return;
      }
      field.setSelectionRange(typed.from, field.selectionStart);
      // oxlint-disable-next-line typescript/no-deprecated -- The one way to type into a field as a person does, which every browser has.
      document.execCommand("insertText", false, `{{${tag.name}}}`);
    },
    /**
     * Shows the Host app's tags again, after its list changed. The field is
     * read again too, as without tags it ignored what was typed.
     */
    showMergeTags: () => (field ? follow(field) : show()),
    get shown() {
      return shown;
    },
  };
};

export type FieldMergeTags = ReturnType<typeof createFieldMergeTags>;
