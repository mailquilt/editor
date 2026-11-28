import { describe, expect, it } from "vitest";

import { checkZoom, kilobytes, withSamples } from "../src/check-mode.js";

const WIDTH = 600;
const GMAIL_CUT_OFF_BYTES = 102 * 1024;

describe(checkZoom, () => {
  it("draws nothing smaller where there's no room to measure or room to spare", () => {
    expect(checkZoom(0, WIDTH)).toBe(1);
    expect(checkZoom(2000, WIDTH)).toBe(1);
  });

  it("scales both side by side, down to 80% of their size", () => {
    expect(checkZoom(788, WIDTH)).toBeCloseTo(0.8, 5);
  });

  it("puts the phone below under 80%, and scales the inbox to the room", () => {
    expect(checkZoom(787, WIDTH)).toBe(1);
    expect(checkZoom(500, WIDTH)).toBeCloseTo(500 / 640, 5);
  });
});

describe(kilobytes, () => {
  it("shows an email over Gmail's cut-off as more than 102 KB, and one under as less", () => {
    expect(kilobytes(GMAIL_CUT_OFF_BYTES + 1)).toBeGreaterThan(102);
    expect(kilobytes(GMAIL_CUT_OFF_BYTES)).toBe(102);
    expect(kilobytes(GMAIL_CUT_OFF_BYTES - 400)).toBeLessThan(102);
  });
});

describe(withSamples, () => {
  const tags = [{ name: "first_name", sample: "Ana" }];

  it("fills a tag in the export, and leaves one its markup cuts in two as written", () => {
    expect(withSamples("Hi {{first_name}}", tags, true)).toBe("Hi Ana");
    expect(withSamples("<strong>Hi {{first</strong>_name}}", tags, true)).toBe(
      "<strong>Hi {{first</strong>_name}}"
    );
  });
});
