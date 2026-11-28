import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const video = (props: Record<string, unknown>) => ({
  props,
  type: "video" as const,
});

const LINKED = {
  alt: "Roaster tipping beans",
  thumbnail: "https://i.ytimg.com/vi/q8Ln2kXa/maxresdefault.jpg",
  url: "https://www.youtube.com/watch?v=q8Ln2kXa&t=1",
};

describe("a Video Block", () => {
  it("matches the saved HTML for the line below, the drawn copy and neither", async () => {
    await expect(
      renderEmail(
        emailWith(
          video(LINKED),
          video({
            ...LINKED,
            borderRadius: 8,
            borderWidth: 1,
            color: "#9a4a1c",
            label: "Tea & <coffee>",
          }),
          video({
            ...LINKED,
            play: "on",
            playThumbnail: "https://cdn.example.com/q8Ln2kXa-play.jpg",
          }),
          video({ ...LINKED, play: "none" })
        )
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/video.html");
  });

  it("leaves nothing in the email until it has a link and a thumbnail", async () => {
    const html = await renderEmail(
      emailWith(
        video({}),
        video({ thumbnail: LINKED.thumbnail }),
        video({ url: LINKED.url })
      )
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
  });

  // MJML loads a font only where it finds its name in the HTML it renders, and
  // the line is written after, so a Video's line alone must still load its font.
  it("loads the web font its line is drawn in, when no other Block uses it", async () => {
    const email = emailWith(video(LINKED));
    email.version = 4;
    email.settings.fontFamily = "'Inter', Arial, sans-serif";
    email.settings.fonts = [
      {
        name: "Inter",
        url: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
      },
    ];

    await expect(renderEmail(email)).resolves.toContain(
      '<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" type="text/css">'
    );
  });
});
