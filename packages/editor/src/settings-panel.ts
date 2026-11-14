import { hexColor } from "@mailquilt/core";
import type { ApplyResult, Command, SettingsField } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";

import { isComposing } from "./block-keyboard.js";

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

/** Text in a field that isn't the document's value. */
interface FieldDraft {
  text: string;
  /**
   * How many times a person's tries to commit it were refused, or 0. Each one
   * counts, so the same refusal again is a new alert and is read out.
   */
  refusals: number;
}

export interface SettingsPanelEvents {
  draftOf: (key: string) => FieldDraft | undefined;
  onInput: (
    section: SettingsSection,
    field: SettingsField,
    control: HTMLInputElement
  ) => void;
  onCommit: (
    section: SettingsSection,
    field: SettingsField,
    control: HTMLInputElement | HTMLSelectElement
  ) => void;
  onKeydown: (event: KeyboardEvent) => void;
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

  /* White fields with a defined edge, so an empty one still reads as a field. */
  .settings input,
  .settings select {
    background-color: var(--mq-color-surface);
    border: 1px solid
      color-mix(
        in srgb,
        var(--mq-color-border-strong) 45%,
        var(--mq-color-border)
      );
    border-radius: 8px;
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
    border-color: var(--mq-color-border-strong);
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

  /* A mask, so the arrow is in the theme's muted text color. */
  .settings .select-field::after {
    background-color: var(--mq-color-text-muted);
    content: "";
    height: 16px;
    inset-block: 0;
    inset-inline-end: 8px;
    margin-block: auto;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23000' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 24 24'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E")
      center / 16px no-repeat;
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
    border-radius: 6px;
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
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
  }

  .settings input[type="color"]::-moz-color-swatch {
    border: 0;
    border-radius: 5px;
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

// A focused number field would step with the wheel, though it has no arrows,
// while the person only meant to scroll the panel.
const leaveOnWheel = ({ currentTarget }: Event) =>
  (currentTarget as HTMLInputElement).blur();

/** What a control's text means. Empty asks for the property to be removed. */
const fieldValue = (
  field: SettingsField,
  control: HTMLInputElement | HTMLSelectElement
) => {
  if ("validity" in control && control.validity.badInput) {
    return Number.NaN;
  }
  const text = control.value.trim();
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
    events.onInput(section, field, currentTarget as HTMLInputElement);
  const onCommit = ({ currentTarget }: Event) =>
    events.onCommit(
      section,
      field,
      currentTarget as HTMLInputElement | HTMLSelectElement
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
      @wheel=${type === "number" ? leaveOnWheel : nothing}
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
  <div class="settings" @keydown=${events.onKeydown}>
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
  /** The control that holds the draft. */
  controlOf: (key: string) => HTMLInputElement | null;
  /** Each value a person enters, before it's applied. */
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
    control: HTMLInputElement | HTMLSelectElement,
    retry: boolean
  ) => {
    const key = draftKey(section, field);
    const value = fieldValue(field, control);
    host.onEnter(value);
    const result = host.apply(section.command({ [field.key]: value }));
    if (result?.ok || result?.unchanged) {
      drafts.delete(key);
    } else {
      const refusals = drafts.get(key)?.refusals ?? 0;
      drafts.set(key, {
        refusals: retry ? refusals : refusals + 1,
        text: control.value,
      });
    }
    if (result?.ok) {
      // A change to one field can make what another was refused for fine.
      for (const other of section.fields) {
        const otherKey = draftKey(section, other);
        const otherControl = host.controlOf(otherKey);
        if (otherControl && drafts.get(otherKey)?.refusals) {
          commit(section, other, otherControl, true);
        }
      }
    } else {
      host.requestUpdate();
    }
  };

  const events: SettingsPanelEvents = {
    draftOf: (key) => drafts.get(key),
    onCommit: (section, field, control) =>
      commit(section, field, control, false),
    onInput: (section, field, control) => {
      const key = draftKey(section, field);
      const refusals = drafts.get(key)?.refusals ?? 0;
      const text = control.value;
      // What isn't a number reads as empty, as if an empty field were unchanged.
      if (
        text === fieldText(field, section.values) &&
        !refusals &&
        !control.validity.badInput
      ) {
        drafts.delete(key);
      } else {
        drafts.set(key, { refusals, text });
      }
    },
    /** Escape takes back what was typed in a settings field. */
    onKeydown: (event) => {
      const key = draftKeyOf(event);
      if (key !== undefined && event.key === "Escape" && !isComposing(event)) {
        event.preventDefault();
        event.stopPropagation();
        drafts.delete(key);
        // Its value already reads as empty, so rendering wouldn't clear it.
        const control = event.target as HTMLInputElement;
        if (control.validity.badInput) {
          control.value = "";
        }
        host.requestUpdate();
      }
    },
  };

  return { clear: () => drafts.clear(), draftKeyOf, events };
};
