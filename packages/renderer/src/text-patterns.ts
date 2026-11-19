import { MERGE_TAG } from "@mailquilt/core/internal";

// The patterns that read an email's text, each built from the parts above it.
// Each is a regex as written, in `String.raw`, so `\s` reads as it would in a
// regex literal.

const TAG = MERGE_TAG.source;

/** A space HTML doesn't collapse, or a Merge Tag, which may have one. */
export const KEPT_SPACE_OR_MERGE_TAG = new RegExp(
  String.raw`${TAG}|[^\S\t\n\f\r ]`,
  "gu"
);

/** A space, or a Merge Tag, which may have spaces of its own. */
export const SPACE_OR_MERGE_TAG = new RegExp(`${TAG}| `, "gu");

/**
 * Put before a character class: a whole Merge Tag, spaces and all, or one of
 * those characters that doesn't start one, so a word or URL never cuts a tag.
 */
const TAG_OR = `${TAG}|(?!${TAG})`;

/**
 * A word, with any Merge Tag in it whole, or the whitespace between words, which
 * has nothing to break after.
 */
export const WORD_OR_SPACE = new RegExp(String.raw`(?:${TAG_OR}\S)+|\s+`, "gu");

/** A Merge Tag, or a character a long word may break after. */
export const TAG_OR_BREAK = new RegExp(
  String.raw`${TAG}|[.\-?=&_]|\/(?!\/)`,
  "gu"
);

/**
 * Scripts written without spaces between words, such as Japanese, and their
 * full-width punctuation and letters, which end a URL or address rather than
 * join it, as in `info@example.comまで`. A URL copied from a browser has any
 * such letters in its path percent-encoded.
 */
const WITHOUT_SPACES = String.raw`\u3000-\u303F\uFF00-\uFFEF\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}`;

/**
 * What follows a URL's `https://` or `www.`, with any Merge Tag in it whole, and
 * without the punctuation or closing bracket that may end a sentence after it.
 * One of those scripts' letters or punctuation ends it.
 */
const URL_REST = String.raw`(?:${TAG_OR}[^\s<>"${WITHOUT_SPACES}])*(?:${TAG_OR}[^\s<>".,;:!?)'\]${WITHOUT_SPACES}])`;

/** A letter or digit in any other script, which `\w` limits to ASCII. */
const LETTER = String.raw`(?![${WITHOUT_SPACES}])[\p{L}\p{M}\p{N}]`;

/** A part of a domain, which starts and ends with a letter or digit. */
const DOMAIN_PART = `${LETTER}(?:(?:${LETTER}|-)*${LETTER})?`;

/**
 * An email address, in any language. It may have an apostrophe, as in
 * o'brien@example.com, and a dot only between characters. It never starts right
 * after a character it may hold, a Merge Tag, a path or an @, nor ends right
 * before a letter, `_`, `-`, an @ or another part of its domain, so it's never a
 * part of something longer. A long word without an @ is read once, not once for
 * each character.
 */
const EMAIL_ADDRESS = String.raw`(?<!${LETTER}|[_'./+}@-])(?:${LETTER}|_)(?:${LETTER}|[_'+-])*(?:\.(?:${LETTER}|[_'+-])+)*@${DOMAIN_PART}(?:\.${DOMAIN_PART})+(?!${LETTER}|[_@-]|\.${LETTER})`;

/**
 * A URL or email address written as text, or a Merge Tag, which is tried first
 * so that one written inside a tag, such as its default, stays part of it. The
 * letters of the scheme and `www.` may be capitals, spelled out because the u
 * flag's i would also take ſ as s. An address is tried before `www.`, so one
 * starting with it is still an address.
 */
export const ADDRESS_IN_TEXT = new RegExp(
  String.raw`${TAG}|(?<url>[Hh][Tt]{2}[Pp][Ss]?://${URL_REST})|(?<email>${EMAIL_ADDRESS})|(?<www>(?<!${LETTER}|[_./-])[Ww]{3}\.${URL_REST})`,
  "gu"
);
