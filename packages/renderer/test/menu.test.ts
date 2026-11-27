import { describe, expect, it } from "vitest";

import { renderEmail } from "../src/index.js";
import { emailWith, readable } from "./email-with.js";

const menu = (props: Record<string, unknown>) => ({
  props,
  type: "menu" as const,
});

describe("a Menu Block", () => {
  it("matches the saved HTML for its alignment, color, size, gap and padding", async () => {
    await expect(
      renderEmail(
        emailWith(
          menu({
            links: [
              { label: "Shop", url: "https://northbound.co/shop" },
              { label: "Journal" },
              { url: "https://northbound.co/about" },
              { label: "Tea & <coffee>", url: "{{site_url}}/tea?a=1&b=2" },
            ],
          }),
          menu({
            align: "right",
            color: "#3b2a20",
            fontSize: 13,
            gap: 40,
            links: [
              { label: "Shop", url: "https://northbound.co/shop" },
              {
                label: "Subscriptions",
                url: "https://northbound.co/subscribe",
              },
            ],
            paddingLeft: 8,
            phone: { fontSize: 12, paddingLeft: 30 },
          })
        )
      ).then(readable)
    ).resolves.toMatchFileSnapshot("expected/menu.html");
  });

  it("leaves nothing in the email until a link has a label and a URL", async () => {
    const html = await renderEmail(
      emailWith(
        menu({ links: [] }),
        menu({ links: [{ label: "Shop" }, { url: "https://a.co" }] })
      )
    );

    expect(html).not.toContain("<a ");
  });
});
