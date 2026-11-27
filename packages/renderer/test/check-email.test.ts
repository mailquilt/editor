import { describe, expect, it } from "vitest";

import { checkEmail } from "../src/index.js";
import { emailWith } from "./email-with.js";

/** An email with one Block, with a preheader and a language, so only the Block's Problems show. */
const ready = (...blocks: Parameters<typeof emailWith>) => {
  const email = emailWith(...blocks);
  email.settings.preheader = "This week's news";
  email.settings.language = "en";
  return email;
};

/** A Text Block's props with one paragraph of `content`. */
const paragraph = (...content: Record<string, unknown>[]) => ({
  content: { content: [{ content, type: "paragraph" }], type: "doc" },
});

/** A Text Block that says "News", with `props` over its own. */
const text = (props: Record<string, unknown> = {}) => ({
  props: { ...paragraph({ text: "News", type: "text" }), ...props },
  type: "text" as const,
});

const codes = async (...args: Parameters<typeof checkEmail>) => {
  const problems = await checkEmail(...args);
  return problems.map(({ code }) => code);
};

describe(checkEmail, () => {
  it("refuses an email the renderer refuses, with the reason", async () => {
    await expect(checkEmail({ kind: "blocks" })).rejects.toThrow(
      /Expected "rows"/u
    );
  });

  it("finds an Image with no image, and where to fix it", async () => {
    await expect(
      checkEmail(ready({ props: {}, type: "image" }))
    ).resolves.toStrictEqual([
      {
        blockId: "block-0",
        code: "image-without-src",
        columnId: "column-1",
        field: "src",
        message: expect.any(String),
        rowId: "row-1",
      },
    ]);
  });

  it("finds an email with no preheader and no language, in its settings' fields", async () => {
    await expect(
      checkEmail(
        emailWith({
          props: { alt: "A", src: "https://example.com/a.png" },
          type: "image",
        })
      )
    ).resolves.toStrictEqual([
      {
        code: "empty-preheader",
        field: "preheader",
        message: expect.any(String),
      },
      { code: "no-language", field: "language", message: expect.any(String) },
    ]);
  });

  // A saved email's language isn't held to a code, and the HTML has no lang without one.
  it("finds an empty language", async () => {
    const email = ready();
    email.settings.language = "";
    await expect(codes(email)).resolves.toStrictEqual(["no-language"]);
  });

  it("finds a preheader of only spaces", async () => {
    const email = ready();
    email.settings.preheader = "  ";
    await expect(codes(email)).resolves.toStrictEqual(["empty-preheader"]);
  });

  // Gmail clips an email's HTML from 102 KB, counted in bytes, so ü counts twice.
  it.each([
    ["clipped", 53_000, ["html-too-large"]],
    ["not clipped", 40_000, []],
  ])(
    "finds HTML Gmail would cut off, and not HTML it wouldn't: %s",
    async (_, count, expected) => {
      const email = ready({
        props: {
          content: {
            content: [
              {
                content: [{ text: "ü".repeat(count), type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
        },
        type: "text",
      });
      await expect(codes(email)).resolves.toStrictEqual(expected);
    }
  );

  it("measures the HTML it's given instead of rendering the email", async () => {
    const html = "x".repeat(102 * 1024 + 1);
    await expect(codes(ready(text()), { html })).resolves.toStrictEqual([
      "html-too-large",
    ]);
  });

  it.each([
    [
      "no alt text",
      { src: "https://example.com/a.png" },
      ["image-without-alt"],
    ],
    [
      "blank alt text",
      { alt: " ", src: "https://example.com/a.png" },
      ["image-without-alt"],
    ],
    ["alt text", { alt: "Our team", src: "https://example.com/a.png" }, []],
    [
      "no alt text, marked decorative",
      { decorative: true, src: "https://example.com/a.png" },
      [],
    ],
  ])("finds an Image with %s", async (_, props, expected) => {
    await expect(codes(ready({ props, type: "image" }))).resolves.toStrictEqual(
      expected
    );
  });

  it.each([
    ["no link", {}, [["video-without-link", "url"]]],
    [
      "no thumbnail",
      { url: "https://youtu.be/a" },
      [["image-without-src", "thumbnail"]],
    ],
    [
      "no alt text",
      { thumbnail: "https://example.com/a.png", url: "https://youtu.be/a" },
      [["image-without-alt", "alt"]],
    ],
    [
      "a line that says only “Here”",
      {
        alt: "Our team",
        label: "Here",
        thumbnail: "https://example.com/a.png",
        url: "https://youtu.be/a",
      },
      [["vague-link-text", "label"]],
    ],
    [
      "a line too hard to read",
      {
        alt: "Our team",
        color: "#777777",
        thumbnail: "https://example.com/a.png",
        url: "https://youtu.be/a",
      },
      [["low-link-contrast", "color"]],
    ],
    [
      "no line, which isn't read",
      {
        alt: "Our team",
        color: "#777777",
        label: "Here",
        play: "none",
        thumbnail: "https://example.com/a.png",
        url: "https://youtu.be/a",
      },
      [],
    ],
  ])("finds a Video with %s, and the field to fix", async (_, props, found) => {
    const problems = await checkEmail(ready({ props, type: "video" }));
    expect(problems.map(({ code, field }) => [code, field])).toStrictEqual(
      found
    );
  });

  it("finds a Button with no link, and is quiet once it has one", async () => {
    const [problem] = await checkEmail(
      ready({ props: { label: "Order" }, type: "button" })
    );
    expect(problem).toMatchObject({
      code: "button-without-link",
      field: "href",
    });
    await expect(
      codes(
        ready({
          props: { href: "https://example.com", label: "Order" },
          type: "button",
        })
      )
    ).resolves.toStrictEqual([]);
  });

  describe("Merge Tags", () => {
    const MERGE_TAGS = [
      { name: "first_name" },
      { name: "unsubscribe_url", unsubscribe: true },
    ];

    it("finds a tag that isn't in the host's list, naming it and where it is", async () => {
      const email = ready(
        {
          props: paragraph({
            text: "Hi {{frist_name}} and {{first_name}}",
            type: "text",
          }),
          type: "text",
        },
        {
          props: { href: "https://example.com/{{ref}}", label: "Order" },
          type: "button",
        }
      );
      email.settings.preheader = "For {{nickname}}";
      await expect(
        checkEmail(email, { mergeTags: MERGE_TAGS })
      ).resolves.toStrictEqual([
        expect.objectContaining({
          code: "unknown-merge-tag",
          field: "preheader",
          mergeTag: "nickname",
        }),
        expect.objectContaining({
          blockId: "block-0",
          code: "unknown-merge-tag",
          field: "content",
          mergeTag: "frist_name",
        }),
        expect.objectContaining({
          blockId: "block-1",
          code: "unknown-merge-tag",
          field: "href",
          mergeTag: "ref",
        }),
        expect.objectContaining({ code: "no-unsubscribe-link" }),
      ]);
    });

    // An email written outside the editor can split a tag across runs of text
    // with different marks, which still export as one tag.
    it("reads a tag split across runs of text", async () => {
      const email = ready({
        props: paragraph(
          { text: "{{frist", type: "text" },
          { marks: [{ type: "bold" }], text: "_name}}", type: "text" }
        ),
        type: "text",
      });
      const problems = await checkEmail(email, {
        mergeTags: [{ name: "first_name" }],
      });
      expect(problems).toStrictEqual([
        expect.objectContaining({
          code: "unknown-merge-tag",
          mergeTag: "frist_name",
        }),
      ]);
    });

    // As a sending service's tags can have spaces, as in {{ first_name }}.
    it("reads a tag's name without the spaces around it", async () => {
      const email = ready({
        props: paragraph(
          { text: "Hi {{ first_name }}. ", type: "text" },
          {
            marks: [{ attrs: { href: "{{ unsubscribe_url }}" }, type: "link" }],
            text: "Unsubscribe",
            type: "text",
          }
        ),
        type: "text",
      });
      await expect(
        codes(email, { mergeTags: MERGE_TAGS })
      ).resolves.toStrictEqual([]);
    });

    // An Image with no image is left out of the email, with its link.
    it("doesn't count the link of an Image with no image", async () => {
      await expect(
        codes(
          ready({
            props: { alt: "Unsubscribe", href: "{{unsubscribe_url}}" },
            type: "image",
          }),
          { mergeTags: MERGE_TAGS }
        )
      ).resolves.toStrictEqual(["image-without-src", "no-unsubscribe-link"]);
    });

    it("doesn't read the tags of a Menu's link the email leaves out", async () => {
      await expect(
        codes(
          ready({
            props: { links: [{ url: "{{orders_ur}}" }] },
            type: "menu",
          }),
          { mergeTags: [{ name: "first_name" }] }
        )
      ).resolves.toStrictEqual([]);
    });

    // A Menu's link without a label is left out of the email.
    it("doesn't count a Menu's link without a label", async () => {
      await expect(
        codes(
          ready({
            props: { links: [{ url: "{{unsubscribe_url}}" }] },
            type: "menu",
          }),
          { mergeTags: MERGE_TAGS }
        )
      ).resolves.toStrictEqual(["no-unsubscribe-link"]);
    });

    it("doesn't read the tags of a Video's line the email doesn't show", async () => {
      await expect(
        codes(
          ready({
            props: {
              alt: "A cup",
              label: "Watch {{promo}}",
              play: "none",
              thumbnail: "https://example.com/a.png",
              url: "https://youtu.be/a",
            },
            type: "video",
          }),
          { mergeTags: [{ name: "first_name" }] }
        )
      ).resolves.toStrictEqual([]);
    });

    it("doesn't count the link of a Video without a thumbnail", async () => {
      await expect(
        codes(ready({ props: { url: "{{unsubscribe_url}}" }, type: "video" }), {
          mergeTags: MERGE_TAGS,
        })
      ).resolves.toStrictEqual(["image-without-src", "no-unsubscribe-link"]);
    });

    it("leaves tags alone without the host's list", async () => {
      await expect(
        codes(
          ready({
            props: paragraph({ text: "Hi {{frist_name}}", type: "text" }),
            type: "text",
          })
        )
      ).resolves.toStrictEqual([]);
    });

    it.each([
      [
        "a link in text",
        {
          props: paragraph({
            marks: [{ attrs: { href: "{{unsubscribe_url}}" }, type: "link" }],
            text: "Unsubscribe",
            type: "text",
          }),
          type: "text" as const,
        },
      ],
      [
        "a Button",
        {
          props: {
            href: "https://example.com/?u={{unsubscribe_url}}",
            label: "Unsubscribe",
          },
          type: "button" as const,
        },
      ],
      [
        "a Menu's link",
        {
          props: {
            links: [{ label: "Unsubscribe", url: "{{unsubscribe_url}}" }],
          },
          type: "menu" as const,
        },
      ],
      [
        "a Video",
        {
          props: {
            alt: "Unsubscribe",
            thumbnail: "https://example.com/a.png",
            url: "{{unsubscribe_url}}",
          },
          type: "video" as const,
        },
      ],
    ])(
      "is quiet about unsubscribing when %s links to the unsubscribe tag",
      async (_, block) => {
        await expect(
          codes(ready(block), { mergeTags: MERGE_TAGS })
        ).resolves.toStrictEqual([]);
      }
    );

    // A line break keeps a link open across it, but opens none of its own.
    it("doesn't count a link on a line break alone", async () => {
      const email = ready({
        props: paragraph({
          marks: [{ attrs: { href: "{{unsubscribe_url}}" }, type: "link" }],
          type: "hardBreak",
        }),
        type: "text",
      });
      await expect(
        codes(email, { mergeTags: MERGE_TAGS })
      ).resolves.toStrictEqual(["no-unsubscribe-link"]);
    });

    it("finds no unsubscribe link when the tag is only in the text", async () => {
      await expect(
        codes(
          ready({
            props: paragraph({ text: "{{unsubscribe_url}}", type: "text" }),
            type: "text",
          }),
          {
            mergeTags: MERGE_TAGS,
          }
        )
      ).resolves.toStrictEqual(["no-unsubscribe-link"]);
    });

    it("doesn't look for an unsubscribe link when no tag is marked as one", async () => {
      await expect(
        codes(ready(), { mergeTags: [{ name: "unsubscribe_url" }] })
      ).resolves.toStrictEqual([]);
    });
  });

  // Ratios on white: #767676 is 4.54:1, #777777 4.48:1 and #949494 3.03:1.
  describe("contrast", () => {
    it.each([
      [
        "a Text Block's own color",
        text({ color: "#777777" }),
        "low-text-contrast",
      ],
      [
        "a see-through color, over what's behind it",
        text({ color: "rgba(0, 0, 0, 0.5)" }),
        "low-text-contrast",
      ],
      [
        "a Button's label on its own color",
        {
          props: {
            backgroundColor: "#60a5fa",
            href: "https://example.com",
            label: "Go",
          },
          type: "button" as const,
        },
        "low-button-contrast",
      ],
      [
        "a Menu's links",
        {
          props: {
            color: "#777777",
            links: [{ label: "Shop", url: "https://example.com" }],
          },
          type: "menu" as const,
        },
        "low-link-contrast",
      ],
      [
        "a Heading under 18.67px, though it's bold",
        {
          props: {
            ...text({ color: "#949494" }).props,
            fontSize: 18,
            level: 3,
          },
          type: "heading" as const,
        },
        "low-text-contrast",
      ],
    ])("finds %s", async (_, block, code) => {
      await expect(checkEmail(ready(block))).resolves.toStrictEqual([
        expect.objectContaining({ blockId: "block-0", code, field: "color" }),
      ]);
    });

    // Half-black over white is drawn #808080, and is 3.98:1 before rounding.
    it("names the colors as they're drawn, their contrast and what's needed", async () => {
      const [problem] = await checkEmail(
        ready(text({ color: "rgba(0, 0, 0, 0.5)" }))
      );
      expect(problem?.contrast).toStrictEqual({
        background: "#ffffff",
        color: "#808080",
        ratio: expect.closeTo(3.98, 2),
        required: 4.5,
      });
    });

    it.each([
      ["4.5:1 for normal text", text({ color: "#767676" })],
      ["3:1 for text of 24px", text({ color: "#949494", fontSize: 24 })],
      [
        "3:1 for a bold Heading of 18.67px or more",
        {
          props: { ...text({ color: "#949494" }).props, level: 3 },
          type: "heading" as const,
        },
      ],
      [
        "the built-in look's Button",
        {
          props: { href: "https://example.com", label: "Go" },
          type: "button" as const,
        },
      ],
    ])("is quiet at %s", async (_, block) => {
      await expect(codes(ready(block))).resolves.toStrictEqual([]);
    });

    it.each([
      // An alpha over 1 is drawn as 1, so this is black on white.
      ["an alpha over 1", text({ color: "rgba(0, 0, 0, 2)" }), "#ffffff"],
      // Black, the built-in look, on black.
      [
        "a Block with no text in it",
        { ...text(), props: paragraph() },
        "#000000",
      ],
    ])("is quiet about %s", async (_, block, rowColor) => {
      const email = ready(block);
      (email.rows[0] as { props: Record<string, unknown> }).props = {
        backgroundColor: rowColor,
      };
      await expect(codes(email)).resolves.toStrictEqual([]);
    });

    // The renderer links an address written in text, in the link color.
    // #949494 is 3.03:1, enough for bold text of 18.67px or more.
    it.each([
      [
        "is quiet about bold text of 20px",
        [{ marks: [{ type: "bold" }], text: "News", type: "text" }],
        [],
      ],
      [
        "finds a run that isn't bold beside it",
        [
          { marks: [{ type: "bold" }], text: "News ", type: "text" },
          { text: "today", type: "text" },
        ],
        ["low-text-contrast"],
      ],
    ])("%s", async (_, content, expected) => {
      await expect(
        codes(
          ready(
            text({ ...paragraph(...content), color: "#949494", fontSize: 20 })
          )
        )
      ).resolves.toStrictEqual(expected);
    });

    // All of the text is in the link color, so the text color isn't seen.
    it("checks the text color only when some text isn't a link", async () => {
      const email = ready(
        text(
          paragraph({
            marks: [{ attrs: { href: "https://example.com" }, type: "link" }],
            text: "Menu",
            type: "text",
          })
        )
      );
      email.version = 4;
      email.settings.style = { linkColor: "#000000", textColor: "#ffffff" };
      await expect(codes(email)).resolves.toStrictEqual([]);
    });

    it("finds a link the renderer makes from an address written in text", async () => {
      const email = ready(
        text({
          ...paragraph({ text: "Write to help@example.com", type: "text" }),
        })
      );
      email.version = 4;
      email.settings.style = { linkColor: "#999999" };
      await expect(codes(email)).resolves.toStrictEqual(["low-link-contrast"]);
    });

    // The address is drawn as a link, bold if its text is, and nothing else
    // is in the text color. #949494 is 3.03:1, enough for bold text of 20px.
    it.each([
      [
        "an address alone, in a readable link color",
        { linkColor: "#000000", textColor: "#ffffff" },
        {},
        { text: "help@example.com", type: "text" },
      ],
      [
        "a bold address of 20px",
        { linkColor: "#949494" },
        { fontSize: 20 },
        { marks: [{ type: "bold" }], text: "help@example.com", type: "text" },
      ],
    ])("is quiet about %s", async (_, style, props, run) => {
      const email = ready(text({ ...paragraph(run), ...props }));
      email.version = 4;
      email.settings.style = style;
      await expect(codes(email)).resolves.toStrictEqual([]);
    });

    it("reads the Email style, and a Block's own color over it", async () => {
      const email = ready(text(), text({ color: "#000000" }));
      email.version = 4;
      email.settings.style = { textColor: "#777777" };
      await expect(checkEmail(email)).resolves.toStrictEqual([
        expect.objectContaining({
          blockId: "block-0",
          code: "low-text-contrast",
        }),
      ]);
    });

    it.each([
      [
        "the Row's own color",
        { rowColor: "#000000", style: { emailBackgroundColor: "#ffffff" } },
      ],
      [
        "the Email style's color behind the Rows",
        { style: { emailBackgroundColor: "#000000" } },
      ],
      ["the page around the email", { page: "#000000" }],
      ["the Column's own color", { columnColor: "#000000" }],
      ["the Block's own Box", { boxColor: "#000000" }],
    ])(
      "reads what's behind the text: %s",
      async (
        _,
        {
          boxColor,
          columnColor,
          page,
          rowColor,
          style,
        }: {
          boxColor?: string;
          columnColor?: string;
          page?: string;
          rowColor?: string;
          style?: Record<string, string>;
        }
      ) => {
        const email = ready(
          text(boxColor ? { boxBackgroundColor: boxColor } : {})
        );
        if (columnColor) {
          const column = email.rows[0]?.columns[0] as {
            props: Record<string, unknown>;
          };
          column.props = { backgroundColor: columnColor };
        }
        email.version = 4;
        email.settings.style = style;
        email.settings.backgroundColor = page ?? "#ffffff";
        (email.rows[0] as { props: Record<string, unknown> }).props = rowColor
          ? { backgroundColor: rowColor }
          : {};
        await expect(codes(email)).resolves.toStrictEqual([
          "low-text-contrast",
        ]);
      }
    );

    it("finds links whose color is too light, only in a Block that has links of another color", async () => {
      const linked = text({
        content: {
          content: [
            {
              content: [
                {
                  marks: [
                    { attrs: { href: "https://example.com" }, type: "link" },
                  ],
                  text: "the menu",
                  type: "text",
                },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
      });
      // A Block with its own color has its links in it, so only its text is found.
      const ownColor = {
        ...linked,
        props: { ...linked.props, color: "#777777" },
      };
      const email = ready(linked, text(), ownColor);
      email.version = 4;
      email.settings.style = { linkColor: "#999999" };
      await expect(checkEmail(email)).resolves.toStrictEqual([
        expect.objectContaining({
          blockId: "block-0",
          code: "low-link-contrast",
          field: "color",
        }),
        expect.objectContaining({
          blockId: "block-2",
          code: "low-text-contrast",
        }),
      ]);
    });
  });

  describe("link text", () => {
    const LINK = [{ attrs: { href: "https://example.com" }, type: "link" }];
    const textWith = (...content: Record<string, unknown>[]) =>
      ready({
        props: {
          content: { content: [{ content, type: "paragraph" }], type: "doc" },
        },
        type: "text",
      });

    it.each([
      [
        "a link that says only “Click here.”",
        textWith(
          { text: "See the menu: ", type: "text" },
          { marks: LINK, text: "Click here.", type: "text" }
        ),
        "content",
        "Click here.",
      ],
      // Runs with other marks are still one link.
      [
        "a link that says “read more” across runs",
        textWith(
          { marks: LINK, text: "Read ", type: "text" },
          { marks: [...LINK, { type: "bold" }], text: "more", type: "text" }
        ),
        "content",
        "Read more",
      ],
      [
        "a Menu link that says only “Learn more”",
        ready({
          props: {
            links: [
              { label: "Shop", url: "https://example.com/shop" },
              { label: "Learn more", url: "https://example.com/about" },
            ],
          },
          type: "menu",
        }),
        "links",
        "Learn more",
      ],
      [
        "a Button that says only “Here”",
        ready({
          props: { href: "https://example.com", label: " Here " },
          type: "button",
        }),
        "label",
        "Here",
      ],
    ])("finds %s", async (_, email, field, linkText) => {
      await expect(checkEmail(email)).resolves.toStrictEqual([
        expect.objectContaining({
          blockId: "block-0",
          code: "vague-link-text",
          field,
          linkText,
        }),
      ]);
    });

    it.each([
      [
        "a link that says where it goes",
        textWith({ marks: LINK, text: "Read the menu", type: "text" }),
      ],
      [
        "“click here” that isn't a link",
        textWith({ text: "Click here", type: "text" }),
      ],
      [
        "two links side by side that read “read more” only together",
        textWith(
          { marks: LINK, text: "Read", type: "text" },
          {
            marks: [
              { attrs: { href: "https://example.com/more" }, type: "link" },
            ],
            text: " more",
            type: "text",
          }
        ),
      ],
    ])("is quiet about %s", async (_, email) => {
      await expect(codes(email)).resolves.toStrictEqual([]);
    });
  });
});
