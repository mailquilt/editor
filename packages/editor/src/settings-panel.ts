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
    gap: var(--mq-space-5);
  }

  .settings fieldset {
    border: 0;
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-3);
    margin: 0;
    min-width: 0;
    padding: 0;
  }

  .settings legend {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-block-end: var(--mq-space-2);
    padding: 0;
    text-transform: uppercase;
  }

  .settings .field {
    display: flex;
    flex-direction: column;
    gap: var(--mq-space-1);
  }

  .settings .field p {
    font-size: var(--mq-font-size-small);
    margin: 0;
  }

  .settings .description {
    color: var(--mq-color-text-muted);
  }

  .settings .error {
    color: var(--mq-color-danger);
  }

  .settings label {
    display: block;
    font-weight: 500;
  }

  .settings input,
  .settings select {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border-strong);
    border-radius: var(--mq-radius-small);
    min-height: 32px;
    min-width: 0;
    padding: 0 var(--mq-space-2);
    width: 100%;
  }

  .settings input:disabled {
    background: var(--mq-color-surface-hover);
    color: var(--mq-color-text-muted);
  }

  .settings [aria-invalid="true"] {
    border-color: var(--mq-color-danger);
  }

  /* Not :focus-visible, which browsers leave off a select pressed with a mouse. */
  .settings input:focus,
  .settings select:focus {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 1px;
  }

  .settings .color {
    display: flex;
    gap: var(--mq-space-1);
  }

  .settings input[type="color"] {
    flex: none;
    padding: 2px;
    width: 36px;
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
      case "number": {
        return textControl("number", field);
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
        ${field.type === "number" ? `${field.label} (${field.unit})` : field.label}
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
        <fieldset>
          <legend>${section.legend}</legend>
          ${section.fields.map((field) => renderField(section, field, events))}
        </fieldset>
      `
    )}
  </div>
`;
