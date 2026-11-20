import { describe, expect, it } from "vitest";

import { withoutStyles } from "../src/pasted-html.js";

describe("pasted HTML without styles", () => {
  it.each([
    [
      "in double quotes",
      `<b style="font-weight:normal">x</b>`,
      `<b data-mailquilt-style="font-weight:normal">x</b>`,
    ],
    [
      "in single quotes, after a value without quotes",
      `<p class=MsoNormal style='font-style:italic'>x</p>`,
      `<p class=MsoNormal data-mailquilt-style='font-style:italic'>x</p>`,
    ],
    [
      "in capitals, after a slash, with spaces around its =",
      `<B/STYLE = "x">y</B>`,
      `<B/data-mailquilt-style = "x">y</B>`,
    ],
    [
      "right after a value in quotes",
      `<span class="a"style="x">y</span>`,
      `<span class="a"data-mailquilt-style="x">y</span>`,
    ],
    [
      "after a start tag that has a > in quotes",
      `<a title=">"><b style="x">y</b></a>`,
      `<a title=">"><b data-mailquilt-style="x">y</b></a>`,
    ],
    [
      "after an end tag that has a > in quotes",
      `</p title=">"><b style="x">y</b>`,
      `</p title=">"><b data-mailquilt-style="x">y</b>`,
    ],
  ])("moves a style attribute %s", (_case, html, moved) => {
    expect(withoutStyles(html)).toBe(moved);
  });

  it.each([
    ["the text", `<p>Set style="x" on it</p>`],
    ["a value in quotes", `<b title="a style=b">x</b>`],
    ["a value without quotes that has a quote", `<p title=it's>style="x"</p>`],
    ["another attribute's name", `<b data-style="x" styles="y">z</b>`],
    ["a comment", `<!-- <b style="x"> --><p>y</p>`],
    ["a comment that has a <style>", `<!-- <style> --><p>Hello</p>`],
    ["a comment that ends early", `<!--><b>x</b>`],
    ["the text of a <textarea>", `<textarea><b style="x"></textarea>`],
    ["the text of a <script>", `<script>"<b style='x'>"</script>`],
  ])("leaves %s as it is", (_case, html) => {
    expect(withoutStyles(html)).toBe(html);
  });

  it("moves a <style> element's CSS into an empty <template>, and keeps what follows", () => {
    expect(
      withoutStyles(
        `<style media="all"><!-- p > b { content: "&</b>" } --></style ><p>x</p>`
      )
    ).toBe(
      `<template data-mailquilt-style-sheet="&lt;!-- p &gt; b { content: &quot;&amp;&lt;/b&gt;&quot; } --&gt;"></template><p>x</p>`
    );
  });

  it("moves a <style> element without its end tag, to the end of the HTML", () => {
    expect(withoutStyles(`<p>x</p><style>b { color: red }`)).toBe(
      `<p>x</p><template data-mailquilt-style-sheet="b { color: red }"></template>`
    );
  });
});
