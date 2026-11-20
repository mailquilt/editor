import { noChange } from "lit";
import { Directive, directive } from "lit/directive.js";
import type { AttributePart } from "lit/directive.js";

/** CSS properties by name, such as `background-color` or `--_mq-email-width`. */
type StyleProperties = Readonly<Record<string, string | undefined>>;

class StylePropertiesDirective extends Directive {
  #names = new Set<string>();

  // oxlint-disable-next-line class-methods-use-this -- Lit's Directive declares render, which update stands in for here.
  render(_properties: StyleProperties) {
    return noChange;
  }

  override update(part: AttributePart, [properties]: [StyleProperties]) {
    const { style } = part.element;
    for (const name of this.#names) {
      if (properties[name] === undefined) {
        style.removeProperty(name);
      }
    }
    this.#names.clear();
    for (const [name, value] of Object.entries(properties)) {
      if (value !== undefined) {
        style.setProperty(name, value);
        this.#names.add(name);
      }
    }
    return noChange;
  }
}

/**
 * Sets an element's inline styles through its `style` object, and never writes
 * its `style` attribute, which a Content Security Policy without
 * `'unsafe-inline'` in `style-src` blocks. Lit's `styleMap` writes the
 * attribute on the first render. A property that's undefined isn't set. Goes in
 * the `style` attribute, as the only thing there. (ADR 0006)
 */
export const styleProperties = directive(StylePropertiesDirective);
