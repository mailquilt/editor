import { describe, expect, it } from "vitest";

import { linkFilledIn, linkToSave } from "../src/links.js";

describe("the link a link field saves", () => {
  it("adds https:// to an address typed without a scheme", () => {
    expect(linkToSave("northbound.co/guji?u=1#top")).toBe(
      "https://northbound.co/guji?u=1#top"
    );
  });

  it("adds https:// to an address with a port", () => {
    expect(linkToSave("shop.example.com:8080")).toBe(
      "https://shop.example.com:8080"
    );
  });

  it("adds mailto: to an email address", () => {
    expect(linkToSave("ana@northbound.co")).toBe("mailto:ana@northbound.co");
  });

  it("keeps a Merge Tag as it's typed", () => {
    expect(linkToSave("{{cta_url}}")).toBe("{{cta_url}}");
  });

  it("keeps an address with a Merge Tag in its path", () => {
    expect(linkToSave("northbound.co/{{product}}")).toBe(
      "https://northbound.co/{{product}}"
    );
  });

  it.each(["https://northbound.co", "HTTP://northbound.co", "tel:+15551234"])(
    "keeps %s, which has a scheme",
    (href) => {
      expect(linkToSave(href)).toBe(href);
    }
  );

  // Left for core to refuse, with the field's error.
  it.each([
    // oxlint-disable-next-line eslint/no-script-url -- This is what core refuses.
    ["a scheme core doesn't take", "javascript:alert(1)"],
    ["what isn't an address", "northbound guji"],
    ["a word with no domain", "guji"],
    ["a protocol-relative URL", "//northbound.co"],
  ])("keeps %s as it's typed", (_, typed) => {
    expect(linkToSave(typed)).toBe(typed);
  });
});

describe("the link a link field says it will save", () => {
  it.each([
    ["a bare domain", " northbound.co ", "https://northbound.co"],
    ["an email address", "ana@northbound.co", "mailto:ana@northbound.co"],
  ])("fills in %s", (_, typed, href) => {
    expect(linkFilledIn(typed)).toBe(href);
  });

  it.each([
    ["nothing typed", undefined],
    ["a link as it is", "https://northbound.co"],
  ])("says nothing for %s", (_, typed) => {
    expect(linkFilledIn(typed)).toBeUndefined();
  });
});
