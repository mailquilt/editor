import { isAllowedLinkHref } from "@mailquilt/core/internal";

/** Dot-separated names ending in one that starts with a letter, as `northbound.co`. */
const DOMAIN = String.raw`(?:[\p{L}\p{N}-]+\.)+\p{L}[\p{L}\p{N}-]+`;

/** A domain, then maybe a port, a path, a query or a fragment. */
const ADDRESS = new RegExp(
  String.raw`^${DOMAIN}(?::\d{1,5})?(?:[/?#]\S*)?$`,
  "u"
);

const EMAIL = new RegExp(String.raw`^[^\s@:/?#]+@${DOMAIN}$`, "u");

/**
 * What a link field saves for the text typed in it, already trimmed: an
 * address typed without a scheme gets `https://`, and an email address gets
 * `mailto:`. Anything else is saved as it's typed, for core's rule for links to
 * take or refuse.
 */
export const linkToSave = (typed: string) => {
  if (isAllowedLinkHref(typed)) {
    return typed;
  }
  if (EMAIL.test(typed)) {
    return `mailto:${typed}`;
  }
  return ADDRESS.test(typed) ? `https://${typed}` : typed;
};

/**
 * The link a link field will save for what's typed in it, when that isn't what
 * it shows: a scheme is filled in.
 */
export const linkFilledIn = (typed: string | undefined) => {
  const text = typed?.trim() ?? "";
  const href = linkToSave(text);
  return href === text ? undefined : href;
};
