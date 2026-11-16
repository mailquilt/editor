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
 * value, and names the tags.
 */
export const fillMergeTags = (html, values) => {
  const missing = new Set();
  const filled = html.replaceAll(MERGE_TAG, (tag, name) => {
    const key = name.trim();
    if (!Object.hasOwn(values, key)) {
      missing.add(tag);
      return tag;
    }
    return escapeHtml(values[key]);
  });
  if (missing.size > 0) {
    throw new Error(`No value for ${[...missing].join(", ")}`);
  }
  return filled;
};
