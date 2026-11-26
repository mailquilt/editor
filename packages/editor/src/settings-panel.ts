import type { ApplyResult, Command } from "@mailquilt/core";
import { hexColor } from "@mailquilt/core/internal";
import type { SettingsField } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";

import { place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import { NO_FIELD_TAGS } from "./merge-tag-picker.js";
import type { FieldTags } from "./merge-tag-picker.js";
import { placeIn } from "./positions.js";
import type { StringId } from "./strings.js";
import type { Text, TextValues } from "./text.js";

/** One group of controls, and what its fields change. */
export interface SettingsSection {
  /** Unique in the panel. Part of the controls' IDs. */
  id: string;
  legend: string;
  /** Keeps a refused value with what it was typed for. */
  targetId: string;
  fields: readonly SettingsField[];
  values: Record<string, unknown>;
  /** What a color picker shows with no color set: what's behind it. */
  unsetColor?: string;
  command: (changes: Record<string, unknown>) => Command;
  /**
   * More for some fields, by key: a control beside the field, and what went
   * wrong with it that isn't a refusal of what was typed, such as an upload.
   */
  extras?: Readonly<
    Record<string, { control?: TemplateResult; error?: string | undefined }>
  >;
}

/**
 * What's typed in a field. A number field the browser can't read, such as
 * "1e", has empty text and `badInput`.
 */
export interface Typed {
  text: string;
  badInput: boolean;
}

/** Text in a field that isn't the document's value. */
interface FieldDraft extends Typed {
  /**
   * How many times a person's tries to commit it were refused, or 0. Each one
   * counts, so the same refusal again is a new alert and is read out.
   */
  refusals: number;
}

/**
 * What's typed in the settings fields and isn't the email's value, and what the
 * fields report as it's typed and committed.
 */
export interface SettingsDrafts {
  draftOf: (key: string) => FieldDraft | undefined;
  /** Forgets what was typed in fields that are no longer shown. */
  drop: (section: SettingsSection, fields: readonly SettingsField[]) => void;
  /**
   * Each change to what's typed, before it's committed. In a list field, it's
   * typed in the text of the item whose key is `item`.
   */
  onInput: (
    section: SettingsSection,
    field: SettingsField,
    typed: Typed,
    item?: string
  ) => void;
  onCommit: (
    section: SettingsSection,
    field: SettingsField,
    typed: Typed,
    item?: string
  ) => void;
  /**
   * Adds, moves or removes an item of a list field. With `followFocus`, as from
   * the keyboard or a button that has focus, focus goes with the change, and a
   * new item's text takes focus either way.
   */
  changeList: (
    section: SettingsSection,
    field: ListField,
    change: ListChange,
    followFocus: boolean
  ) => void;
}

/** A field whose value is a list of items, each with its own text. */
export type ListField = Extract<SettingsField, { type: "list" }>;

type ListItem = Readonly<Record<string, unknown>>;

/** What a person does to a list field's items, each found by its key. */
export type ListChange =
  | { type: "add"; item: string }
  | { type: "move"; item: string; step: -1 | 1 }
  | { type: "remove"; item: string };

/** Where focus goes in a list field: the way to add an item, or a part of one. */
export type ListFocus =
  | { control: "add" }
  | { control: "moveDown" | "moveUp" | "remove" | "text"; item: string };

/** The `id` of a field's control, or of a list field's items. */
const fieldId = (
  { id }: Pick<SettingsSection, "id">,
  { key }: Pick<SettingsField, "key">
) => `settings-${id}-${key}`;

const itemsOf = (field: ListField, values: Record<string, unknown>) =>
  (values[field.key] as readonly ListItem[] | undefined) ?? [];

/**
 * One of a field's texts, which core names by ID. Each ID core gives is one of
 * the editor's, which a test checks.
 */
export const fieldWords = (id: string, textOf: Text, values?: TextValues) =>
  textOf(id as StringId, values);

/** A field's help, each sentence a text of its own, then the Merge Tag hint. */
const descriptionOf = (
  ids: readonly (string | undefined)[],
  hint: string,
  textOf: Text
) =>
  [...ids.map((id) => id && fieldWords(id, textOf)), hint]
    .filter(Boolean)
    .join(" ");

/** What a person calls an item, by its key. */
const itemLabel = (field: ListField, item: string, textOf: Text) => {
  const option = field.options.find(({ value }) => value === item);
  return option ? fieldWords(option.labelId, textOf) : item;
};

/**
 * A list field's items after a change, what a screen reader is told of it, and
 * where focus goes: to a new item's text, with the item that moved, or after a
 * removal to the Remove button that took its place, else the way to add one.
 */
export const changeList = (
  field: ListField,
  items: readonly ListItem[],
  change: ListChange,
  textOf: Text
): { focus: ListFocus; items: readonly ListItem[]; said: string } => {
  const index = items.findIndex(
    (entry) => entry[field.itemKey] === change.item
  );
  const name = itemLabel(field, change.item, textOf);
  switch (change.type) {
    case "add": {
      const next = [...items, { [field.itemKey]: change.item }];
      return {
        focus: { control: "text", item: change.item },
        items: next,
        said: textOf("said.itemAdded", {
          name,
          ...placeIn(next.length - 1, next.length),
        }),
      };
    }
    case "move": {
      const to = index + change.step;
      return {
        focus: {
          control: change.step < 0 ? "moveUp" : "moveDown",
          item: change.item,
        },
        items: items.toSpliced(index, 1).toSpliced(to, 0, items[index] ?? {}),
        said: textOf("said.itemMoved", {
          name,
          ...placeIn(to, items.length),
        }),
      };
    }
    default: {
      const neighbour = items[index + 1] ?? items[index - 1];
      return {
        focus: neighbour
          ? { control: "remove", item: String(neighbour[field.itemKey]) }
          : { control: "add" },
        items: items.toSpliced(index, 1),
        said: textOf("said.itemRemoved", { name }),
      };
    }
  }
};

export const settingsPanelStyles = css`
  .settings {
    display: flex;
    flex-direction: column;
  }

  .settings .section {
    padding: var(--mq-space-4) var(--mq-space-4) 20px;
  }

  .settings fieldset {
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    min-width: 0;
    padding: 0;
  }

  /* Floated, so the legend lays out in the fieldset like any other heading. */
  .settings legend {
    float: left;
    font-size: var(--mq-font-size);
    font-weight: 600;
    letter-spacing: -0.005em;
    padding: 0 0 2px;
    width: 100%;
  }

  .settings legend + * {
    clear: both;
  }

  .settings .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* The label on the left and the control on the right, as a settings row. */
  .settings .field.inline {
    align-items: center;
    display: grid;
    gap: 6px var(--mq-space-3);
    grid-template-columns: minmax(0, 1fr) 136px;
  }

  .settings .field.inline > p {
    grid-column: 1 / -1;
  }

  .settings label {
    color: var(--mq-color-text-muted);
    display: block;
    font-size: var(--mq-font-size);
  }

  .settings .field p {
    font-size: var(--mq-font-size-small);
    line-height: 1.4;
    margin: 0;
  }

  .settings .description {
    color: var(--mq-color-text-muted);
  }

  .settings .error {
    color: var(--mq-color-danger);
  }

  /* A list field's name reads as any field's label. */
  .settings .list-label {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size);
  }

  .settings .list-items {
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Each item a card: its name and its tools, then its text. */
  .settings .list-item {
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius-small);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 10px 10px;
  }

  .settings .list-item-head {
    align-items: center;
    display: flex;
    gap: var(--mq-space-2);
    justify-content: space-between;
  }

  .settings .list-item label {
    color: var(--mq-color-text);
    font-weight: 500;
  }

  .settings .list-item-tools {
    display: flex;
    gap: 2px;
  }

  /* A field with a control beside it, which takes what room is left. */
  .settings .with-control {
    display: flex;
    gap: var(--mq-space-2);
  }

  .settings .with-control > :first-child {
    flex: 1;
  }

  .settings .with-control .text-button {
    height: 32px;
    white-space: nowrap;
  }

  /*
   * White fields with an edge at 3:1 or more, so an empty one still reads as a
   * field.
   */
  .settings input,
  .settings select {
    background-color: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow-small);
    color: var(--mq-color-text);
    height: 32px;
    min-width: 0;
    padding: 0 10px;
    transition:
      border-color 120ms,
      box-shadow 120ms;
    width: 100%;
  }

  .settings input:hover:not(:disabled, :focus),
  .settings select:hover:not(:focus) {
    border-color: var(--mq-color-text-muted);
  }

  .settings input::placeholder {
    color: var(--mq-color-text-muted);
    opacity: 1;
  }

  .settings input:disabled {
    background-color: var(--mq-color-surface-muted);
    border-color: var(--mq-color-border);
    box-shadow: none;
    color: var(--mq-color-text-muted);
    cursor: not-allowed;
  }

  .settings select {
    appearance: none;
    cursor: pointer;
    padding-inline-end: 32px;
    text-overflow: ellipsis;
  }

  .settings .select-field {
    position: relative;
  }

  /*
   * An icon in the page, not an image, so a Content Security Policy's
   * img-src can't hide it.
   */
  .settings .select-field .icon {
    color: var(--mq-color-text-muted);
    height: 16px;
    inset-block: 0;
    inset-inline-end: 8px;
    margin-block: auto;
    pointer-events: none;
    position: absolute;
    width: 16px;
  }

  .settings [aria-invalid="true"] {
    border-color: var(--mq-color-danger);
  }

  /* Not :focus-visible, which Firefox leaves off a select pressed with a mouse. */
  .settings input:focus,
  .settings select:focus {
    border-color: transparent;
    box-shadow: 0 0 0 4px var(--mq-color-accent-soft);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -1px;
  }

  /* A switch: a track, with a knob at its end while it's on. */
  .settings input[role="switch"] {
    appearance: none;
    background-color: var(--mq-color-border-strong);
    border: 0;
    border-radius: 10px;
    box-shadow: none;
    cursor: pointer;
    height: 20px;
    justify-self: end;
    margin: 0;
    padding: 0;
    position: relative;
    transition: background-color 120ms;
    width: 36px;
  }

  .settings input[role="switch"]::before {
    background-color: var(--mq-color-on-accent);
    border-radius: 50%;
    box-shadow: var(--mq-shadow-small);
    content: "";
    height: 16px;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    position: absolute;
    transition: transform 120ms;
    width: 16px;
  }

  .settings input[role="switch"]:checked {
    background-color: var(--mq-color-accent);
  }

  .settings input[role="switch"]:checked::before {
    transform: translateX(16px);
  }

  .settings input[role="switch"]:focus {
    outline-offset: 2px;
  }

  /*
   * Forced colors drop the track's and the knob's backgrounds, so an edge and
   * the knob are drawn in the system's colors, which stay where it is.
   */
  @media (forced-colors: active) {
    .settings input[role="switch"] {
      border: 1px solid CanvasText;
    }

    .settings input[role="switch"]::before {
      background-color: CanvasText;
      forced-color-adjust: none;
      inset-block-start: 1px;
      inset-inline-start: 1px;
    }

    .settings input[role="switch"]:checked {
      background-color: Highlight;
      forced-color-adjust: none;
    }

    .settings input[role="switch"]:checked::before {
      background-color: HighlightText;
    }
  }

  .settings .unit-field {
    position: relative;
  }

  .settings .unit-field input {
    -moz-appearance: textfield;
    padding-inline-end: 34px;
  }

  .settings .unit-field input::-webkit-inner-spin-button,
  .settings .unit-field input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .settings .unit {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    inset-block: 0;
    inset-inline-end: 10px;
    line-height: 32px;
    pointer-events: none;
    position: absolute;
  }

  /* The swatch sits inside the start of the field, as one control. */
  .settings .color {
    position: relative;
  }

  .settings .color input[type="text"] {
    padding-inline-start: 38px;
  }

  .settings input[type="color"] {
    background: none;
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: none;
    cursor: pointer;
    height: 24px;
    inset-block-start: 4px;
    inset-inline-start: 5px;
    padding: 0;
    position: absolute;
    width: 26px;
    z-index: 1;
  }

  .settings input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  /*
   * An edge on the swatch, over the color it shows, from the theme. Two rules,
   * as one naming a pseudo-element a browser doesn't know is dropped.
   */
  .settings input[type="color"]::-webkit-color-swatch {
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
  }

  .settings input[type="color"]::-moz-color-swatch {
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: var(--_mq-swatch-edge);
  }
`;

const NO_COLOR = "#ffffff";

/** Short controls sit beside their label. Text that runs long gets the row. */
const INLINE_TYPES = new Set<string>(["color", "number", "select", "toggle"]);

/** Where what's typed in a field is kept: by its section, target and field. */
export const draftKey = (
  { id, targetId }: Pick<SettingsSection, "id" | "targetId">,
  { key }: Pick<SettingsField, "key">,
  item?: string
) =>
  item === undefined
    ? `${id}:${targetId}:${key}`
    : `${id}:${targetId}:${key}:${item}`;

/** A list field's item, by its key. */
const itemOf = (
  field: ListField,
  values: Record<string, unknown>,
  item: string
) => itemsOf(field, values).find((entry) => entry[field.itemKey] === item);

/**
 * What a field shows when nothing different has been typed into it, or in a
 * list field, an item's text.
 */
export const fieldText = (
  field: SettingsField,
  values: Record<string, unknown>,
  item?: string
) =>
  field.type === "list"
    ? String(itemOf(field, values, item ?? "")?.[field.itemField.key] ?? "")
    : String(values[field.key] ?? field.default ?? "");

/** What a control holds. */
export const typedIn = (
  control: HTMLInputElement | HTMLSelectElement
): Typed => ({
  badInput: control.validity.badInput,
  text: control.value,
});

/** What typed text means. Empty asks for the property to be removed. */
export const fieldValue = (field: SettingsField, typed: Typed) => {
  if (typed.badInput) {
    return Number.NaN;
  }
  const text = typed.text.trim();
  if (field.type === "toggle") {
    return text === "true";
  }
  if (!text) {
    return null;
  }
  if (field.type === "select") {
    // A control's value is text, whatever type the property has. A saved email
    // can have what the list doesn't.
    return (
      field.options.find(({ value }) => String(value) === text)?.value ?? text
    );
  }
  return field.type === "number" ? Number(text) : text;
};

/**
 * The change that typed text makes: the field's value, or in a list field, the
 * whole list with one item's text set, or taken away when it's empty.
 */
const changeOf = (
  field: SettingsField,
  values: Record<string, unknown>,
  typed: Typed,
  item?: string
) => {
  if (field.type !== "list") {
    return { [field.key]: fieldValue(field, typed) };
  }
  const text = fieldValue(field.itemField, typed);
  const { key } = field.itemField;
  return {
    [field.key]: itemsOf(field, values).map((entry) => {
      if (entry[field.itemKey] !== item) {
        return entry;
      }
      const rest = Object.fromEntries(
        Object.entries(entry).filter(([name]) => name !== key)
      );
      return text === null ? rest : { ...rest, [key]: text };
    }),
  };
};

/** The buttons on a list field's item, with what each does. */
const ITEM_TOOLS = [
  {
    action: "moveUp",
    icon: ICONS.up,
    label: "settings.moveUp",
    step: -1,
  },
  {
    action: "moveDown",
    icon: ICONS.down,
    label: "settings.moveDown",
    step: 1,
  },
  {
    action: "remove",
    icon: ICONS.delete,
    label: "settings.remove",
    step: 0,
  },
] as const;

/**
 * A list field: its items in order, each with its text and a toolbar to move or
 * remove it, then a way to add an item for an option not yet used. Each item's
 * parts are kept by its key, so what's typed in one stays with it through a
 * move, or the removal of another.
 */
const renderListField = (
  section: SettingsSection,
  field: ListField,
  drafts: SettingsDrafts,
  tagsOf: (fieldId: string) => FieldTags,
  textOf: Text
) => {
  const id = fieldId(section, field);
  const descriptionId = `${id}-description`;
  const items = itemsOf(field, section.values);
  const used = new Set(items.map((entry) => entry[field.itemKey]));
  const unused = field.options.filter(({ value }) => !used.has(value));
  const { hint } = tagsOf(id);
  const description = descriptionOf(
    [field.descriptionId, field.itemField.descriptionId],
    hint,
    textOf
  );
  const label = fieldWords(field.labelId, textOf);
  // A pressed button has focus when nothing else in the editor did, and then
  // focus goes with the change, as it does from the keyboard.
  const change = (listChange: ListChange) => (event: MouseEvent) =>
    drafts.changeList(
      section,
      field,
      listChange,
      event.detail === 0 || (event.currentTarget as Element).matches(":focus")
    );

  const renderItem = (entry: ListItem, index: number) => {
    const item = String(entry[field.itemKey]);
    const name = itemLabel(field, item, textOf);
    const inputId = `${id}-${item}`;
    const errorId = `${inputId}-error`;
    const tags = tagsOf(inputId);
    const key = draftKey(section, field, item);
    const draft = drafts.draftOf(key);
    const refusals = draft?.refusals ?? 0;
    const enabled = {
      moveDown: index < items.length - 1,
      moveUp: index > 0,
      remove: true,
    };
    // The toolbar's one Tab stop is its first button that works.
    const stop = ITEM_TOOLS.find(({ action }) => enabled[action])?.action;
    return html`
      <li class="list-item" data-item-key=${item}>
        <div class="list-item-head">
          <label for=${inputId}>${name}</label>
          <div
            aria-label=${name}
            class="list-item-tools"
            data-place=${place("listItemTools")}
            role="toolbar"
          >
            ${ITEM_TOOLS.map(
              ({ action, icon, label: toolLabel, step }) => html`
                <button
                  aria-label=${textOf(toolLabel, { name })}
                  class=${action === "remove" ? "icon-button danger" : "icon-button"}
                  data-action=${action}
                  data-tooltip=${textOf(toolLabel, { name })}
                  ?disabled=${!enabled[action]}
                  tabindex=${action === stop ? "0" : "-1"}
                  type="button"
                  @click=${change(
                    step === 0
                      ? { item, type: "remove" }
                      : { item, step, type: "move" }
                  )}
                >
                  ${icon}
                </button>
              `
            )}
          </div>
        </div>
        <!-- Named as one text, so a translation can put the item's name where
          its language needs it. -->
        <input
          aria-activedescendant=${tags.activeDescendant}
          aria-controls=${tags.controls}
          aria-describedby=${[description ? descriptionId : "", refusals ? errorId : ""].filter(Boolean).join(" ") || nothing}
          aria-invalid=${refusals ? "true" : "false"}
          aria-label=${textOf("settings.listItem", {
            label: fieldWords(field.itemField.labelId, textOf),
            name,
          })}
          autocomplete="off"
          data-draft-key=${key}
          ?data-merge-tags=${tags.takesTags}
          data-place=${draft ? place("settingsDraft") : nothing}
          id=${inputId}
          spellcheck="false"
          type="text"
          .value=${live(draft?.text ?? fieldText(field, section.values, item))}
          @change=${({ currentTarget }: Event) =>
            drafts.onCommit(
              section,
              field,
              typedIn(currentTarget as HTMLInputElement),
              item
            )}
          @input=${({ currentTarget }: Event) =>
            drafts.onInput(
              section,
              field,
              typedIn(currentTarget as HTMLInputElement),
              item
            )}
        />
        ${tags.list}
        ${
          refusals
            ? keyed(
                refusals,
                html`
                  <p class="error" id=${errorId} role="alert">
                    ${fieldWords(field.itemField.invalidMessageId, textOf)}
                  </p>
                `
              )
            : nothing
        }
      </li>
    `;
  };

  // Named with aria-label, as a group named by aria-labelledby here crashed
  // Firefox's page once a field after it changed. Its visible name is hidden
  // from screen readers, so it isn't read twice.
  return html`
    <div aria-label=${label} class="field list-field" id=${id} role="group">
      <span aria-hidden="true" class="list-label">${label}</span>
      ${
        description
          ? html`<p class="description" id=${descriptionId}>${description}</p>`
          : nothing
      }
      ${
        items.length > 0
          ? html`
              <ul class="list-items">
                ${repeat(items, (entry) => entry[field.itemKey], renderItem)}
              </ul>
            `
          : nothing
      }
      ${
        unused.length > 0
          ? html`
              <div class="with-control">
                <div class="select-field">
                  <select aria-label=${fieldWords(field.chooseLabelId, textOf)}>
                    ${unused.map(
                      ({ labelId, value }) =>
                        html`<option .value=${value}>
                          ${fieldWords(labelId, textOf)}
                        </option>`
                    )}
                  </select>
                  ${ICONS.chevronDown}
                </div>
                <button
                  class="text-button"
                  data-place=${place("controls")}
                  type="button"
                  @click=${(event: MouseEvent) => {
                    const select = (
                      event.currentTarget as Element
                    ).previousElementSibling?.querySelector("select");
                    if (select) {
                      change({ item: select.value, type: "add" })(event);
                    }
                  }}
                >
                  ${textOf("settings.add")}
                </button>
              </div>
            `
          : html`<p class="description">
              ${fieldWords(field.allAddedId, textOf)}
            </p>`
      }
    </div>
  `;
};

const renderField = (
  section: SettingsSection,
  field: SettingsField,
  drafts: SettingsDrafts,
  tagsOf: (fieldId: string) => FieldTags,
  textOf: Text
) => {
  if (field.type === "list") {
    return renderListField(section, field, drafts, tagsOf, textOf);
  }
  const label = fieldWords(field.labelId, textOf);
  const id = fieldId(section, field);
  // Every field that holds text, or a URL, takes Merge Tags.
  const tags =
    field.type === "text" && !field.disabled ? tagsOf(id) : NO_FIELD_TAGS;
  const description = descriptionOf([field.descriptionId], tags.hint, textOf);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const extra = section.extras?.[field.key];
  const extraErrorId = `${id}-extra-error`;
  const key = draftKey(section, field);
  const draft = drafts.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const refused = refusals > 0;
  const text = fieldText(field, section.values);
  const describedBy = [
    description ? descriptionId : "",
    refused ? errorId : "",
    extra?.error ? extraErrorId : "",
  ]
    .filter(Boolean)
    .join(" ");
  const onInput = ({ currentTarget }: Event) =>
    drafts.onInput(section, field, typedIn(currentTarget as HTMLInputElement));
  const onCommit = ({ currentTarget }: Event) =>
    drafts.onCommit(
      section,
      field,
      typedIn(currentTarget as HTMLInputElement | HTMLSelectElement)
    );

  const textControl = (
    type: string,
    limits?: { max?: number; min: number }
  ) => html`
    <input
      aria-activedescendant=${tags.activeDescendant}
      aria-controls=${tags.controls}
      aria-describedby=${describedBy || nothing}
      aria-invalid=${refused ? "true" : "false"}
      autocomplete="off"
      data-draft-key=${key}
      ?data-merge-tags=${tags.takesTags}
      data-place=${draft ? place("settingsDraft") : nothing}
      ?disabled=${field.disabled ?? false}
      id=${id}
      max=${limits?.max ?? nothing}
      min=${limits?.min ?? nothing}
      placeholder=${field.type === "color" ? textOf("settings.none") : nothing}
      spellcheck="false"
      step=${limits ? "1" : nothing}
      type=${type}
      .value=${live(draft?.text ?? text)}
      @change=${onCommit}
      @input=${onInput}
    />
  `;

  const control = () => {
    switch (field.type) {
      case "color": {
        return html`
          <div class="color">
            <input
              aria-describedby=${describedBy || nothing}
              aria-label=${textOf("settings.picker", { label })}
              ?disabled=${field.disabled ?? false}
              type="color"
              .value=${live(
                hexColor(text || (section.unsetColor ?? "")) ?? NO_COLOR
              )}
              @change=${onCommit}
            />
            ${textControl("text")}
          </div>
        `;
      }
      // The unit shows inside the field, and is part of its name.
      case "number": {
        return html`
          <div class="unit-field">
            ${textControl("number", field)}
            <span aria-hidden="true" class="unit">
              ${textOf(`unit.${field.unit}`)}
            </span>
          </div>
        `;
      }
      case "select": {
        // A saved email can have what the list doesn't.
        const options = field.options.some(
          ({ value }) => String(value) === text
        )
          ? field.options.map(({ labelId, value }) => ({
              label: fieldWords(labelId, textOf),
              value,
            }))
          : [
              ...field.options.map(({ labelId, value }) => ({
                label: fieldWords(labelId, textOf),
                value,
              })),
              { label: text, value: text },
            ];
        return html`
          <div class="select-field">
            <select
              aria-describedby=${describedBy || nothing}
              id=${id}
              @change=${onCommit}
            >
              ${options.map(
                ({ label: optionLabel, value }) => html`
                  <option
                    .selected=${live(String(value) === text)}
                    .value=${String(value)}
                  >
                    ${optionLabel}
                  </option>
                `
              )}
            </select>
            ${ICONS.chevronDown}
          </div>
        `;
      }
      // Its text is "true" or "false", as `fieldText` gives for a yes or no.
      case "toggle": {
        return html`
          <input
            aria-describedby=${describedBy || nothing}
            ?disabled=${field.disabled ?? false}
            id=${id}
            role="switch"
            type="checkbox"
            .checked=${live(text === "true")}
            @change=${({ currentTarget }: Event) =>
              drafts.onCommit(section, field, {
                badInput: false,
                text: String((currentTarget as HTMLInputElement).checked),
              })}
          />
        `;
      }
      default: {
        return textControl("text");
      }
    }
  };

  return html`
    <div class=${INLINE_TYPES.has(field.type) ? "field inline" : "field"}>
      <label for=${id}>
        ${label}${
          field.type === "number"
            ? html`<span class="visually-hidden">
                ${textOf("settings.unit", {
                  unit: textOf(`unit.${field.unit}`),
                })}</span
              >`
            : nothing
        }
      </label>
      ${
        extra?.control
          ? html`<div class="with-control">${control()}${extra.control}</div>`
          : control()
      }
      ${tags.list}
      ${
        description
          ? html`<p class="description" id=${descriptionId}>${description}</p>`
          : nothing
      }
      ${
        refused
          ? keyed(
              refusals,
              html`
                <p class="error" id=${errorId} role="alert">
                  ${fieldWords(
                    field.invalidMessageId,
                    textOf,
                    field.type === "number"
                      ? { max: field.max, min: field.min }
                      : undefined
                  )}
                </p>
              `
            )
          : nothing
      }
      ${
        extra?.error
          ? html`<p class="error" id=${extraErrorId}>${extra.error}</p>`
          : nothing
      }
    </div>
  `;
};

/**
 * The one settings panel: every control in it comes from fields that are data.
 * It shows `shown` of the section's fields, or else all of them, and a change
 * to one retries what was refused in any of them.
 */
export const renderSettingsPanel = (
  section: SettingsSection,
  drafts: SettingsDrafts,
  tagsOf: (fieldId: string) => FieldTags,
  textOf: Text,
  shown: readonly SettingsField[] = section.fields
) => html`
  <div class="settings" data-place=${place("settings")}>
    <div class="section">
      <fieldset>
        <legend>${section.legend}</legend>
        ${shown.map((field) =>
          renderField(section, field, drafts, tagsOf, textOf)
        )}
      </fieldset>
    </div>
  </div>
`;

interface DraftsHost {
  /** Applies what a person typed, which can be refused. */
  apply: (command: Command) => ApplyResult | undefined;
  /** Each value a person enters, before it's applied, or types in again. */
  onEnter: (value: unknown) => void;
  requestUpdate: () => void;
  /** Tells a screen reader of a change to a list field. */
  say: (words: string) => void;
  text: Text;
  /** Once the next update has rendered it, in the list field with that `id`. */
  focusInList: (listId: string, at: ListFocus) => void;
}

/** Text in the settings panel that isn't the document's value. */
export const createSettingsDrafts = ({
  apply,
  focusInList,
  onEnter,
  requestUpdate,
  say,
  text,
}: DraftsHost) => {
  const drafts = new Map<string, FieldDraft>();

  /** The settings field the key was pressed in, while it holds a draft. */
  const draftKeyOf = ({ target }: KeyboardEvent) => {
    const key = (target as HTMLElement).dataset.draftKey;
    return key !== undefined && drafts.has(key) ? key : undefined;
  };

  /**
   * Each commit is one undo step. What can't be accepted stays to be fixed. A
   * retry the person didn't ask for doesn't say again what they've been told.
   */
  const commit = (
    section: SettingsSection,
    field: SettingsField,
    typed: Typed,
    retry: boolean,
    item?: string
  ) => {
    const key = draftKey(section, field, item);
    onEnter(fieldValue(field.type === "list" ? field.itemField : field, typed));
    const result = apply(
      section.command(changeOf(field, section.values, typed, item))
    );
    if (result?.ok || result?.code === "unchanged") {
      drafts.delete(key);
    } else {
      const refusals = drafts.get(key)?.refusals ?? 0;
      drafts.set(key, {
        ...typed,
        refusals: retry ? refusals : refusals + 1,
      });
    }
    if (result?.ok) {
      // A change to one field can make what another was refused for fine.
      for (const other of section.fields) {
        const draft = drafts.get(draftKey(section, other));
        if (draft?.refusals) {
          commit(section, other, draft, true);
        }
      }
    } else {
      requestUpdate();
    }
  };

  const fields: SettingsDrafts = {
    changeList: (section, field, change, followFocus) => {
      const { focus, items, said } = changeList(
        field,
        itemsOf(field, section.values),
        change,
        text
      );
      if (!apply(section.command({ [field.key]: items }))?.ok) {
        return;
      }
      if (change.type === "remove") {
        drafts.delete(draftKey(section, field, change.item));
      }
      if (followFocus || change.type === "add") {
        focusInList(fieldId(section, field), focus);
      }
      say(said);
    },
    draftOf: (key) => drafts.get(key),
    drop: (section, dropped) => {
      for (const field of dropped) {
        drafts.delete(draftKey(section, field));
      }
    },
    onCommit: (section, field, typed, item) =>
      commit(section, field, typed, false, item),
    onInput: (section, field, typed, item) => {
      const key = draftKey(section, field, item);
      const held = drafts.has(key);
      const refusals = drafts.get(key)?.refusals ?? 0;
      // What isn't a number reads as empty, as if an empty field were unchanged.
      if (
        typed.text === fieldText(field, section.values, item) &&
        !refusals &&
        !typed.badInput
      ) {
        drafts.delete(key);
        // Typed again, which the browser doesn't report as a change.
        onEnter(
          fieldValue(field.type === "list" ? field.itemField : field, typed)
        );
      } else {
        drafts.set(key, { ...typed, refusals });
      }
      // The field is a place of its own while it holds a draft.
      if (drafts.has(key) !== held) {
        requestUpdate();
      }
    },
  };

  /** Takes back what was typed in the settings field the key was pressed in. */
  const discard = (event: KeyboardEvent) => {
    const key = draftKeyOf(event);
    if (key === undefined) {
      return;
    }
    drafts.delete(key);
    // Its value already reads as empty, so rendering wouldn't clear it.
    const control = event.target as HTMLInputElement;
    if (control.validity.badInput) {
      control.value = "";
    }
    requestUpdate();
  };

  return {
    clear: () => drafts.clear(),
    discard,
    fields,
    /** Takes back what was typed in one field, for a value set another way. */
    forget: (key: string) => {
      drafts.delete(key);
    },
  };
};
