/** A Merge Tag, such as `{{first_name}}`, as the editor finds them. */
const MERGE_TAG = /\{\{(?<name>[^{}]+)\}\}/gu;

/** So a value can't add markup, or end the link or image URL it's in. */
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Fills each Merge Tag in an email's HTML with its value from `values`, keyed
 * by the tag's name, such as `{ first_name: "Ada" }`. Throws if a tag has no
 * value, and names the tags. A value of `undefined` or `null` counts as none, so
 * give `""` to fill a tag with nothing.
 */
export const fillMergeTags = (html, values) => {
  const missing = new Set();
  const filled = html.replaceAll(MERGE_TAG, (tag, name) => {
    const key = name.trim();
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    if (value === undefined || value === null) {
      missing.add(tag);
      return tag;
    }
    return escapeHtml(value);
  });
  if (missing.size > 0) {
    throw new Error(`No value for ${[...missing].join(", ")}`);
  }
  return filled;
};
