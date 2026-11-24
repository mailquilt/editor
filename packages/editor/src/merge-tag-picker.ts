import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { findPlace, place } from "./editor-places.js";
import { PICKER_ID, pickerOptionId } from "./merge-tags.js";
import type { MergeTagPickerState } from "./merge-tags.js";
import type { PanelApi } from "./panel-api.js";
import { styleProperties } from "./style-properties.js";
import type { Text } from "./text.js";

/** Between the picker and its line, below it or above it. */
export const PICKER_GAP_PX = 4;

export const mergeTagPickerStyles = css`
  /*
   * Below the line where the {{ was typed, starting under it, and moved from
   * here where there's no room (tool-fitting.ts).
   */
  .merge-tag-picker {
    display: block;
    max-height: 240px;
    max-width: min(320px, calc(100vw - 32px));
    min-width: 200px;
    overflow-y: auto;
    padding: var(--mq-space-1);
    position: absolute;
    /* Over the format bar, which it can cover while it's open. */
    z-index: calc(var(--_mq-layer-block-tools) + 1);
  }

  /* Under a field, in the flow, so nothing around it can cut it off. */
  .field-merge-tag-picker {
    display: block;
    max-height: 200px;
    overflow-y: auto;
    padding: var(--mq-space-1);
    /* So the highlighted tag's place is measured from the list. */
    position: relative;
  }

  .merge-tag-options {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .merge-tag-options li {
    border-radius: var(--mq-radius-small);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px var(--mq-space-2);
  }

  .merge-tag-options li:hover {
    background: var(--mq-color-surface-hover);
  }

  /* Its edge is at 3:1, as a pressed button's is, so it isn't told by color alone. */
  .merge-tag-options li[aria-selected="true"] {
    background: var(--mq-color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--mq-color-accent-strong);
  }

  .merge-tag-options .merge-tag-name {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    overflow-wrap: anywhere;
  }

  @media (forced-colors: active) {
    .merge-tag-options li[aria-selected="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
`;

/** The picker's tags, in text or under a field. */
const renderOptions = (
  { highlighted, options }: Omit<MergeTagPickerState, "from">,
  pick: (index: number) => void,
  text: Text
) => html`
  <ul
    aria-label=${text("mergeTags.picker")}
    class="merge-tag-options"
    id=${PICKER_ID}
    role="listbox"
  >
    ${options.map(
      ({ label, name }, index) => html`
        <li
          aria-selected=${index === highlighted ? "true" : "false"}
          id=${pickerOptionId(index)}
          role="option"
          @click=${() => pick(index)}
        >
          <span>${label || name}</span>
          ${
            label
              ? html`<span class="merge-tag-name">{{${name}}}</span>`
              : nothing
          }
        </li>
      `
    )}
  </ul>
`;

/**
 * The open Merge Tag picker, at the cursor. Focus stays in the text, which
 * names the list and its highlighted tag, so a screen reader reads that tag as
 * the arrow keys move.
 */
export const renderMergeTagPicker = ({
  mergeTagPicker: picker,
  pickMergeTag,
  text,
}: PanelApi) => {
  if (!picker) {
    return nothing;
  }
  const { anchor } = picker;
  return html`
    <div
      class="ui bar merge-tag-picker"
      data-line-height=${anchor.bottom - anchor.top}
      data-place=${place("mergeTagPicker")}
      style=${styleProperties({
        "inset-block-start": `${anchor.bottom + PICKER_GAP_PX}px`,
        "inset-inline-start": `${anchor.left}px`,
      })}
    >
      ${renderOptions(picker, pickMergeTag, text)}
    </div>
  `;
};

/** What a field that holds text or a URL has from the Host app's Merge Tags. */
export interface FieldTags {
  /** Its attributes that name the open list and its highlighted tag. */
  activeDescendant: string | typeof nothing;
  controls: string | typeof nothing;
  /** What its description adds: that `{{` adds a Merge Tag. */
  hint: string;
  /** The open list, under it. */
  list: TemplateResult | typeof nothing;
}

/** A field's, while the Host app gives no `mergeTags`, or one that takes none. */
export const NO_FIELD_TAGS: FieldTags = {
  activeDescendant: nothing,
  controls: nothing,
  hint: "",
  list: nothing,
};

/**
 * The Merge Tags of a field that holds text or a URL, by its `id`. Focus stays
 * in the field, so a press on the list keeps it there, and the field names the
 * list and its highlighted tag.
 */
export const fieldTags =
  ({ fieldMergeTags, text }: PanelApi) =>
  (fieldId: string): FieldTags => {
    if (!fieldMergeTags) {
      return NO_FIELD_TAGS;
    }
    const { pick, shown } = fieldMergeTags;
    const hint = text("mergeTags.hint");
    if (shown?.fieldId !== fieldId) {
      return { ...NO_FIELD_TAGS, hint };
    }
    return {
      activeDescendant: pickerOptionId(shown.highlighted),
      controls: PICKER_ID,
      hint,
      list: html`
        <div
          class="ui bar field-merge-tag-picker"
          data-place=${place("fieldMergeTagPicker")}
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
        >
          ${renderOptions(shown, pick, text)}
        </div>
      `,
    };
  };

/**
 * Scrolls the open picker to its highlighted tag, after an update. Only the
 * list scrolls, not the page around it, except that a list under a field is
 * scrolled into view, as it can open below what the Side panel shows.
 */
export const showHighlightedTag = (root: ParentNode) => {
  const underField = findPlace(root, "fieldMergeTagPicker");
  underField?.scrollIntoView({ block: "nearest" });
  const list = findPlace(root, "mergeTagPicker") ?? underField;
  const tag = list?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!(list && tag)) {
    return;
  }
  const { offsetHeight, offsetTop } = tag;
  if (offsetTop < list.scrollTop) {
    list.scrollTop = offsetTop;
  } else if (offsetTop + offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = offsetTop + offsetHeight - list.clientHeight;
  }
};
