import { afterEach, describe, expect, it, vi } from "vitest";

import { usableFonts } from "../src/web-fonts.js";

const INTER = {
  fallback: "Arial, Helvetica, sans-serif",
  name: "Inter",
  url: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
};

describe(usableFonts, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps each font the email can store, in the Host app's order", () => {
    const fraunces = {
      fallback: "Georgia, serif",
      name: "Fraunces",
      url: "https://fonts.googleapis.com/css2?family=Fraunces",
    };

    expect(usableFonts([fraunces, INTER])).toStrictEqual([fraunces, INTER]);
  });

  // Core's checks of a name and a URL have their own table; one case of each
  // shows they're used here.
  it.each([
    ["a URL core refuses", { ...INTER, url: "http://example.com/inter.css" }],
    ["a name core refuses", { ...INTER, name: "Inter, Arial" }],
    ["a fallback that isn't a font family", { ...INTER, fallback: "a;b" }],
    ["a name an earlier font has", { ...INTER, name: "inter" }],
  ])("leaves out a font with %s, and says so on the console", (_name, font) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(usableFonts([INTER, font])).toStrictEqual([INTER]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("left out a font in fonts")
    );
  });
});
