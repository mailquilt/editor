import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SOCIAL_NETWORKS } from "@mailquilt/core/internal";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
import { renderEmail } from "../src/index.js";
import { socialIconUrl } from "../src/internal.js";
import { emailWith, readable } from "./email-with.js";

const social = (props: Record<string, unknown>) => ({
  props,
  type: "social" as const,
});

describe("a Social Block", () => {
  it("matches the saved HTML for each icon style and size, with the Host app's icons", async () => {
    await expect(
      renderEmail(
        emailWith(
          social({
            links: [
              { network: "facebook", url: "https://facebook.com/shop" },
              { network: "instagram" },
              { network: "website", url: "{{site_url}}" },
            ],
          }),
          social({
            align: "center",
            iconSize: 40,
            iconStyle: "white",
            links: [
              { network: "youtube", url: "https://youtube.com/@shop" },
              { network: "x", url: "https://x.com/shop" },
            ],
          }),
          social({
            align: "right",
            iconSize: 48,
            links: [
              { network: "bluesky", url: "https://bsky.app/profile/shop" },
            ],
          })
        ),
        // Without the slash a base URL usually ends with.
        { socialIconsUrl: "https://cdn.shop.example/mail-icons" }
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/social.html");
  });

  // An empty one, as an unset environment variable gives, would be a path.
  it.each([{}, { socialIconsUrl: "" }])(
    "loads its icons from jsDelivr, at the renderer's own version, with %j",
    async (options) => {
      const html = await renderEmail(
        emailWith(
          social({ links: [{ network: "x", url: "https://x.com/shop" }] })
        ),
        options
      );

      expect(html).toContain(
        `src="https://cdn.jsdelivr.net/npm/@mailquilt/renderer@${packageJson.version}/icons/x-color.png"`
      );
    }
  );

  it("leaves nothing in the email until a link has a URL", async () => {
    const html = await renderEmail(
      emailWith(
        social({ links: [] }),
        social({ links: [{ network: "facebook" }, { network: "x" }] })
      )
    );

    expect(html).not.toContain("<img");
  });

  it("escapes its link URLs and the Host app's base URL", async () => {
    const html = await renderEmail(
      emailWith(
        social({
          links: [
            { network: "website", url: 'https://shop.example/?a=1&b="2"' },
          ],
        })
      ),
      { socialIconsUrl: 'https://cdn.shop.example/?"&/' }
    );

    expect(html).toContain(
      'href="https://shop.example/?a=1&amp;b=&quot;2&quot;"'
    );
    expect(html).toContain(
      'src="https://cdn.shop.example/?&quot;&amp;/website-color.png"'
    );
  });
});

describe("the Social icons", () => {
  // jsDelivr serves the icons from the published package, so an icon the
  // renderer names and the package leaves out would be a broken image.
  it("are each in the package's files, in both styles", () => {
    const { files } = JSON.parse(
      execFileSync("pnpm", ["pack", "--dry-run", "--json"], {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf-8",
      })
    ) as { files: { path: string }[] };
    const packed = new Set(files.map(({ path }) => path));

    const missing = (
      Object.keys(SOCIAL_NETWORKS) as (keyof typeof SOCIAL_NETWORKS)[]
    )
      .flatMap((network) =>
        (["color", "white"] as const).map((style) =>
          socialIconUrl(network, style, "icons")
        )
      )
      .filter((icon) => !packed.has(icon));

    expect(missing).toStrictEqual([]);
  });
});
