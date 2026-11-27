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
});
