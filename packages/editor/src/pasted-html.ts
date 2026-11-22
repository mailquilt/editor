import { DOMParser } from "prosemirror-model";
import type { ParseOptions, Schema } from "prosemirror-model";

/*
 * ProseMirror reads pasted or dropped HTML into a document of its own, which
 * has the page's Content Security Policy. Without `'unsafe-inline'` in
 * `style-src`, Chromium and WebKit block that HTML's `style` attributes, and
 * Chromium its `<style>` elements, and report each one, so Google Docs' text
 * came in all bold and lost its italic and underline. So the HTML reaches
 * ProseMirror with neither, and its styles are given back through the CSSOM,
 * which the policy allows, before its parse rules read them. (ADR 0006)
 */

/** Holds a `style` attribute's CSS until it's given back. */
const STYLE = "data-mailquilt-style";
/** On an empty `<template>`, holds a `<style>` element's CSS until it's given back. */
const STYLE_SHEET = "data-mailquilt-style-sheet";

/**
 * Elements whose content the HTML parser reads as text, to their end tag.
 * Scripts are off in ProseMirror's document, so `<noscript>` isn't one.
 */
const TEXT_ONLY = new Set([
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

const isSpace = (char: string) =>
  char === " " ||
  char === "\t" ||
  char === "\n" ||
  char === "\f" ||
  char === "\r";

/** Ends a tag's name, or an attribute's. */
const endsName = (char: string) =>
  isSpace(char) || char === "/" || char === ">";

const isLetter = (char: string) => /^[A-Za-z]$/u.test(char);

/** HTML's names ignore the case of ASCII letters only. */
const asciiLowerCase = (text: string) =>
  text.replaceAll(/[A-Z]/gu, (letter) => letter.toLowerCase());

const asAttributeValue = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Reads a tag from its name at `from`, as the HTML spec's tokenizer does: its
 * name, the index just past it, and where each attribute named `style` starts.
 * One the HTML ends inside runs to the end, as the parser drops it.
 */
const readTag = (html: string, from: number) => {
  let at = from;
  while (at < html.length && !endsName(html.charAt(at))) {
    at += 1;
  }
  const name = asciiLowerCase(html.slice(from, at));
  const styles: number[] = [];
  while (at < html.length) {
    const char = html.charAt(at);
    if (char === ">") {
      return { end: at + 1, name, styles };
    }
    if (isSpace(char) || char === "/") {
      at += 1;
    } else {
      // An attribute's name, whose first character can be anything, even "=".
      const start = at;
      at += 1;
      while (
        at < html.length &&
        !endsName(html.charAt(at)) &&
        html.charAt(at) !== "="
      ) {
        at += 1;
      }
      if (asciiLowerCase(html.slice(start, at)) === "style") {
        styles.push(start);
      }
      while (isSpace(html.charAt(at))) {
        at += 1;
      }
      if (html.charAt(at) === "=") {
        at += 1;
        while (isSpace(html.charAt(at))) {
          at += 1;
        }
        const quote = html.charAt(at);
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, at + 1);
          at = close === -1 ? html.length : close + 1;
        } else {
          while (
            at < html.length &&
            !isSpace(html.charAt(at)) &&
            html.charAt(at) !== ">"
          ) {
            at += 1;
          }
        }
      }
    }
  }
  return { end: html.length, name, styles };
};

/** Where a text-only element's content ends: at its end tag, or the end. */
const textEnd = (html: string, from: number, name: string) => {
  if (name === "plaintext") {
    return html.length;
  }
  let at = html.indexOf("</", from);
  while (at !== -1) {
    const after = html.charAt(at + 2 + name.length);
    if (
      asciiLowerCase(html.slice(at + 2, at + 2 + name.length)) === name &&
      (isSpace(after) || after === "/" || after === ">")
    ) {
      return at;
    }
    at = html.indexOf("</", at + 2);
  }
  return html.length;
};

/** Where a comment starting at `from` ends, just past its `-->`. */
const commentEnd = (html: string, from: number) => {
  for (const ended of ["<!-->", "<!--->"]) {
    if (html.startsWith(ended, from)) {
      return from + ended.length;
    }
  }
  const close = /--!?>/gu;
  close.lastIndex = from + "<!--".length;
  const found = close.exec(html);
  return found ? found.index + found[0].length : html.length;
};

/**
 * Pasted HTML with each `style` attribute and `<style>` element moved where the
 * policy doesn't look, read once as the HTML spec's tokenizer reads it, so
 * nothing else changes. For ProseMirror's `transformPastedHTML`.
 */
export const withoutStyles = (html: string) => {
  let moved = "";
  let at = html.indexOf("<");
  let copied = 0;
  while (at !== -1) {
    const next = html.charAt(at + 1);
    let end = at + 1;
    if (html.startsWith("<!--", at)) {
      end = commentEnd(html, at);
    } else if (next === "/" && isLetter(html.charAt(at + 2))) {
      // An end tag, whose attributes do nothing.
      ({ end } = readTag(html, at + 2));
    } else if (next === "!" || next === "?" || next === "/") {
      // A doctype, or what the parser reads as a comment, to its ">".
      const close = html.indexOf(">", at);
      end = close === -1 ? html.length : close + 1;
    } else if (isLetter(next)) {
      const tag = readTag(html, at + 1);
      end = TEXT_ONLY.has(tag.name)
        ? textEnd(html, tag.end, tag.name)
        : tag.end;
      if (tag.name === "style") {
        const css = html.slice(tag.end, end);
        moved += `${html.slice(copied, at)}<template ${STYLE_SHEET}="${asAttributeValue(css)}"></template>`;
        // Past its end tag, if it has one.
        end = end < html.length ? readTag(html, end + 2).end : end;
        copied = end;
      } else {
        for (const style of tag.styles) {
          moved += `${html.slice(copied, style)}${STYLE}`;
          copied = style + "style".length;
        }
      }
    }
    at = html.indexOf("<", end);
  }
  return moved + html.slice(copied);
};

/**
 * Gives `withoutStyles`' styles back, as ProseMirror applies them: each
 * element's own, then each style sheet's rules after them, in order.
 */
const restoreStyles = (dom: Node) => {
  if (!(dom instanceof Element)) {
    return;
  }
  for (const element of dom.querySelectorAll<HTMLElement>(`[${STYLE}]`)) {
    element.style.cssText = element.getAttribute(STYLE) ?? "";
    element.removeAttribute(STYLE);
  }
  for (const holder of dom.querySelectorAll(`[${STYLE_SHEET}]`)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(holder.getAttribute(STYLE_SHEET) ?? "");
    holder.remove();
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule) {
        for (const element of dom.querySelectorAll<HTMLElement>(
          rule.selectorText
        )) {
          element.style.cssText += rule.style.cssText;
        }
      }
    }
  }
};

/** The schema's parser, reading what `withoutStyles` took out as styles again. */
class PastedHtmlParser extends DOMParser {
  override parse(dom: Node, options?: ParseOptions) {
    restoreStyles(dom);
    return super.parse(dom, options);
  }

  override parseSlice(dom: Node, options?: ParseOptions) {
    restoreStyles(dom);
    return super.parseSlice(dom, options);
  }
}

/** For ProseMirror's `clipboardParser`, with `withoutStyles`. */
export const pastedHtmlParser = (schema: Schema) =>
  new PastedHtmlParser(schema, DOMParser.fromSchema(schema).rules);
