import { describe, expect, it } from "vitest";

import { scaleOf } from "../src/geometry.js";

describe("how much the host page scales a length", () => {
  it("is how much longer it is on screen than laid out", () => {
    expect(scaleOf(150, 100)).toBe(1.5);
  });

  it("is none for a length rounded on screen, up to a pixel off", () => {
    expect(scaleOf(100.9, 100)).toBe(1);
  });
});
