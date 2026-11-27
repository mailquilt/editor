import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const text = (words: string) => ({
  content: {
    content: [{ content: [{ text: words, type: "text" }], type: "paragraph" }],
    type: "doc",
  },
});

const FRAUNCES = {
  name: "Fraunces",
  url: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&display=swap",
};
const INTER = {
  name: "Inter",
  url: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
};

const withFonts = (...blocks: Parameters<typeof emailWith>) => {
  const email = emailWith(...blocks);
  email.version = 4;
  email.settings.fontFamily = "'Inter', Arial, Helvetica, sans-serif";
  email.settings.style = {
    headingFontFamily: "'Fraunces', Georgia, 'Times New Roman', serif",
  };
  email.settings.fonts = [FRAUNCES, INTER];
  return email;
};

describe("an email with web fonts", () => {
  it("matches the saved HTML, loading each font it uses, named with its fallbacks", async () => {
    const email = withFonts(
      { props: { ...text("The spring roast"), level: 1 }, type: "heading" },
      { props: text("Our first harvest of the year."), type: "text" },
      { props: { label: "Shop the roast" }, type: "button" }
    );

    await expect(
      renderEmail(email).then(readable)
    ).resolves.toMatchFileSnapshot("expected/web-fonts.html");
  });

  // An email saved by hand can hold a font nothing names, and the heading
  // font names one even when there's no Heading.
  it("doesn't load a font that nothing in it is drawn in", async () => {
    const email = withFonts({ props: text("Hello"), type: "text" });
    email.settings.fonts = [
      FRAUNCES,
      INTER,
      { name: "Brand Sans", url: "https://cdn.example.com/brand.css" },
    ];

    const html = await renderEmail(email);

    expect(html).toContain(INTER.url);
    expect(html).not.toContain(FRAUNCES.url);
    expect(html).not.toContain("brand.css");
  });

  // MJML would find Inter in a font-family naming Inter Tight.
  it("doesn't load a heading font in an email with no Heading, though its name is part of the body font's", async () => {
    const email = withFonts({ props: text("Hello"), type: "text" });
    const tight = {
      name: "Inter Tight",
      url: "https://fonts.googleapis.com/css2?family=Inter+Tight",
    };
    email.settings.fontFamily = "'Inter Tight', Arial, sans-serif";
    email.settings.style = { headingFontFamily: "'Inter', Arial, sans-serif" };
    email.settings.fonts = [INTER, tight];

    const html = await renderEmail(email);

    expect(html).toContain(tight.url);
    expect(html).not.toContain(INTER.url);
  });

  it("loads no font from anywhere when it has none", async () => {
    const html = await renderEmail(
      emailWith({ props: text("Hello"), type: "text" })
    );

    expect(html).not.toMatch(/<link|@import|@font-face/u);
  });
});
