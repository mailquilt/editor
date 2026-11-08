import type { Command, SettingsField } from "@mailquilt/core";
import { css, html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";

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
export interface FieldDraft {
  text: string;
  /** The last try to commit it was refused. */
  refused: boolean;
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

  /* One group of fields, set off from the next by a rule. */
  .settings .section {
    border-bottom: 1px solid var(--mq-color-border);
    padding: var(--mq-space-4);
  }

  .settings .section:last-child {
    border-bottom: 0;
  }

  .settings fieldset {
    border: 0;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-4);
    margin: 0;
    min-width: 0;
    padding: 0;
  }

  /* Floated, so the legend lays out in the fieldset like any other heading. */
  .settings legend {
    float: left;
    font-weight: 600;
    padding: 0;
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

  .settings label {
    color: var(--mq-color-text-muted);
    display: block;
    font-size: var(--mq-font-size-small);
    font-weight: 500;
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

  .settings input,
  .settings select {
    background-color: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    color: var(--mq-color-text);
    height: 32px;
    min-width: 0;
    padding: 0 10px;
    transition:
      border-color 120ms,
      box-shadow 120ms;
    width: 100%;
  }

  .settings input:hover:not(:disabled),
  .settings select:hover {
    border-color: var(--mq-color-text-muted);
  }

  .settings input::placeholder {
    color: var(--mq-color-text-muted);
  }

  .settings input:disabled {
    background-color: var(--mq-color-surface-muted);
    border-color: var(--mq-color-border);
    color: var(--mq-color-text-muted);
    cursor: not-allowed;
  }

  .settings select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.75' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-position: right 8px center;
    background-repeat: no-repeat;
    cursor: pointer;
    padding-inline-end: 30px;
  }

  .settings [aria-invalid="true"] {
    border-color: var(--mq-color-danger);
  }

  /* Not :focus-visible, which browsers leave off a select pressed with a mouse. */
  .settings input:focus,
  .settings select:focus {
    border-color: var(--mq-color-accent);
    box-shadow: 0 0 0 3px var(--mq-color-accent-soft);
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

  .settings .color {
    display: flex;
    gap: 6px;
  }

  .settings input[type="color"] {
    cursor: pointer;
    flex: none;
    padding: 3px;
    width: 32px;
  }

  .settings input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .settings input[type="color"]::-webkit-color-swatch {
    border: 1px solid rgb(0 0 0 / 10%);
    border-radius: 3px;
  }

  .settings input[type="color"]::-moz-color-swatch {
    border: 1px solid rgb(0 0 0 / 10%);
    border-radius: 3px;
  }
`;

const NO_COLOR = "#ffffff";

/** A color input only takes #rrggbb, and the text field shows what was saved. */
const hexColor = (color: string) => {
  if (/^#[\da-f]{3}$/iu.test(color)) {
    return color.replaceAll(/[\da-f]/giu, "$&$&").toLowerCase();
  }
  if (color.startsWith("#")) {
    return color.toLowerCase();
  }
  const channels = color.match(/\d{1,3}/gu)?.slice(0, 3);
  return channels
    ? `#${channels
        .map((channel) =>
          Math.min(Number(channel), 255).toString(16).padStart(2, "0")
        )
        .join("")}`
    : NO_COLOR;
};

export const draftKey = (
  { id, targetId }: SettingsSection,
  { key }: SettingsField
) => `${id}:${targetId}:${key}`;

/** What a field shows when nothing different has been typed into it. */
export const fieldText = (
  { default: fallback, key }: SettingsField,
  values: Record<string, unknown>
) => String(values[key] ?? fallback ?? "");

/** What a control's text means. Empty asks for the property to be removed. */
export const fieldValue = (
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
  const refused = draft?.refused ?? false;
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
              aria-label=${`${field.label} picker`}
              type="color"
              .value=${live(hexColor(text || (section.unsetColor ?? "")))}
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
        `;
      }
      default: {
        return textControl("text");
      }
    }
  };

  return html`
    <div class="field">
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
          ? html`
              <p class="error" id=${errorId} role="alert">
                ${field.invalidMessage}
              </p>
            `
          : nothing
      }
    </div>
  `;
};

/** The one settings panel: every control in it comes from fields that are data. */
export const renderSettingsPanel = (
  sections: SettingsSection[],
  events: SettingsPanelEvents
) => html`
  <div
    aria-label="Settings"
    class="settings"
    role="group"
    @keydown=${events.onKeydown}
  >
    ${repeat(
      sections,
      // Keyed, so that a field with focus survives the others coming and going.
      ({ id }) => id,
      (section) => html`
        <div class="section">
          <fieldset>
            <legend>${section.legend}</legend>
            ${section.fields.map((field) => renderField(section, field, events))}
          </fieldset>
        </div>
      `
    )}
  </div>
`;
