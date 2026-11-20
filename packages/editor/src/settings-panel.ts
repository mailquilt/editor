import type { ApplyResult, Command } from "@mailquilt/core";
import { hexColor } from "@mailquilt/core/internal";
import type { SettingsField } from "@mailquilt/core/internal";
import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";

import { ICONS } from "./icons.js";

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
}

/**
 * What's typed in a field. A number field the browser can't read, such as
 * "1e", has empty text and `badInput`.
 */
interface Typed {
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

export interface SettingsPanelEvents {
  draftOf: (key: string) => FieldDraft | undefined;
  /** Each change to what's typed, before it's committed. */
  onInput: (
    section: SettingsSection,
    field: SettingsField,
    typed: Typed
  ) => void;
  onCommit: (
    section: SettingsSection,
    field: SettingsField,
    typed: Typed
  ) => void;
}

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

  /*
   * White fields with an edge at 3:1 or more, so an empty one still reads as a
   * field.
   */
  .settings input,
  .settings select {
    background-color: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    box-shadow: 0 1px 2px rgb(22 24 29 / 4%);
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

  /* Not :focus-visible, which browsers leave off a select pressed with a mouse. */
  .settings input:focus,
  .settings select:focus {
    border-color: transparent;
    box-shadow: 0 0 0 4px var(--mq-color-accent-soft);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -1px;
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

  .settings input[type="color"]::-webkit-color-swatch {
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
  }

  .settings input[type="color"]::-moz-color-swatch {
    border: 0;
    border-radius: var(--mq-radius-small);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
  }
`;

const NO_COLOR = "#ffffff";

/** Short controls sit beside their label. Text that runs long gets the row. */
const INLINE_TYPES = new Set<string>(["color", "number", "select"]);

const draftKey = ({ id, targetId }: SettingsSection, { key }: SettingsField) =>
  `${id}:${targetId}:${key}`;

/** What a field shows when nothing different has been typed into it. */
const fieldText = (
  { default: fallback, key }: SettingsField,
  values: Record<string, unknown>
) => String(values[key] ?? fallback ?? "");

/** What a control holds. */
const typedIn = (control: HTMLInputElement | HTMLSelectElement): Typed => ({
  badInput: "validity" in control && control.validity.badInput,
  text: control.value,
});

/** What typed text means. Empty asks for the property to be removed. */
const fieldValue = (field: SettingsField, typed: Typed) => {
  if (typed.badInput) {
    return Number.NaN;
  }
  const text = typed.text.trim();
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

const renderField = (
  section: SettingsSection,
  field: SettingsField,
  events: SettingsPanelEvents
) => {
  const id = `settings-${section.id}-${field.key}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const key = draftKey(section, field);
  const draft = events.draftOf(key);
  const refusals = draft?.refusals ?? 0;
  const refused = refusals > 0;
  const text = fieldText(field, section.values);
  const describedBy = [
    field.description ? descriptionId : "",
    refused ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");
  const onInput = ({ currentTarget }: Event) =>
    events.onInput(section, field, typedIn(currentTarget as HTMLInputElement));
  const onCommit = ({ currentTarget }: Event) =>
    events.onCommit(
      section,
      field,
      typedIn(currentTarget as HTMLInputElement | HTMLSelectElement)
    );

  const textControl = (
    type: string,
    limits?: { max?: number; min: number }
  ) => html`
    <input
      aria-describedby=${describedBy || nothing}
      aria-invalid=${refused ? "true" : "false"}
      autocomplete="off"
      data-draft-key=${key}
      ?disabled=${field.disabled ?? false}
      id=${id}
      max=${limits?.max ?? nothing}
      min=${limits?.min ?? nothing}
      placeholder=${field.type === "color" ? "None" : nothing}
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
              aria-label=${`${field.label} picker`}
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
            <span aria-hidden="true" class="unit">${field.unit}</span>
          </div>
        `;
      }
      case "select": {
        // A saved email can have what the list doesn't.
        const options = field.options.some(
          ({ value }) => String(value) === text
        )
          ? field.options
          : [...field.options, { label: text, value: text }];
        return html`
          <div class="select-field">
            <select
              aria-describedby=${describedBy || nothing}
              id=${id}
              @change=${onCommit}
            >
              ${options.map(
                ({ label, value }) => html`
                  <option
                    .selected=${live(String(value) === text)}
                    .value=${String(value)}
                  >
                    ${label}
                  </option>
                `
              )}
            </select>
            ${ICONS.chevronDown}
          </div>
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
        ${field.label}${
          field.type === "number"
            ? html`<span class="visually-hidden"> (${field.unit})</span>`
            : nothing
        }
      </label>
      ${control()}
      ${
        field.description
          ? html`
              <p class="description" id=${descriptionId}>
                ${field.description}
              </p>
            `
          : nothing
      }
      ${
        refused
          ? keyed(
              refusals,
              html`
                <p class="error" id=${errorId} role="alert">
                  ${field.invalidMessage}
                </p>
              `
            )
          : nothing
      }
    </div>
  `;
};

/** The one settings panel: every control in it comes from fields that are data. */
export const renderSettingsPanel = (
  section: SettingsSection,
  events: SettingsPanelEvents
) => html`
  <div class="settings" data-place="settings">
    <div class="section">
      <fieldset>
        <legend>${section.legend}</legend>
        ${section.fields.map((field) => renderField(section, field, events))}
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
}

/** Text in the settings panel that isn't the document's value. */
export const createSettingsDrafts = (host: DraftsHost) => {
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
    retry: boolean
  ) => {
    const key = draftKey(section, field);
    const value = fieldValue(field, typed);
    host.onEnter(value);
    const result = host.apply(section.command({ [field.key]: value }));
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
      host.requestUpdate();
    }
  };

  const events: SettingsPanelEvents = {
    draftOf: (key) => drafts.get(key),
    onCommit: (section, field, typed) => commit(section, field, typed, false),
    onInput: (section, field, typed) => {
      const key = draftKey(section, field);
      const refusals = drafts.get(key)?.refusals ?? 0;
      // What isn't a number reads as empty, as if an empty field were unchanged.
      if (
        typed.text === fieldText(field, section.values) &&
        !refusals &&
        !typed.badInput
      ) {
        drafts.delete(key);
        // Typed again, which the browser doesn't report as a change.
        host.onEnter(fieldValue(field, typed));
      } else {
        drafts.set(key, { ...typed, refusals });
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
    host.requestUpdate();
  };

  return { clear: () => drafts.clear(), discard, draftKeyOf, events };
};
