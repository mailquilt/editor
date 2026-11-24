import type { BlocksDocument } from "@mailquilt/core";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  announcement,
  blockGroup,
  blockProps,
  blocks,
  blockTypes,
  blockWith,
  canvas,
  currentValue,
  moveCursorToLineEnd,
  openBlocks,
  openEmail,
  pasteHtml,
  selectRowButton,
  serveImages,
  setValue,
  structure,
  TALL_VIEWPORT,
  test,
  textOf,
  undoByKey,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

test.beforeEach(({ context }) => serveImages(context));

/** The Button's settings, which only the copy's JSON carries, not its HTML. */
const BUTTON = {
  backgroundColor: "#ff0000",
  color: "#00ff00",
  href: "https://example.com/buy",
  label: "Buy",
};

const emailTools = (page: Page) =>
  canvas(page).getByRole("group", { name: "Email tools" });

/** A Text Block by where it is, as its name says. */
const textBlockAt = (page: Page, where: string) =>
  canvas(page).getByRole("group", {
    exact: true,
    name: `Text Block, ${where}`,
  });

/**
 * Fires a clipboard event at an element, as the browser does for its keys and
 * its Edit menu, with `formats` and `files` on it, and returns what's on it
 * after. Tests copy and paste through events, as tests running at the same
 * time could share the system's clipboard.
 */
const fire = (
  target: Locator,
  type: "copy" | "cut" | "paste",
  {
    files = [],
    formats = {},
  }: {
    files?: { name: string; type: string }[];
    formats?: Record<string, string>;
  } = {}
) =>
  target.evaluate(
    (element, data) => {
      const clipboardData = new DataTransfer();
      for (const [format, value] of Object.entries(data.formats)) {
        clipboardData.setData(format, value);
      }
      for (const file of data.files) {
        clipboardData.items.add(
          new File(["x"], file.name, { type: file.type })
        );
      }
      // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
      const event = new Event(data.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(event, "clipboardData", { value: clipboardData });
      element.dispatchEvent(event);
      return {
        "text/html": clipboardData.getData("text/html"),
        "text/plain": clipboardData.getData("text/plain"),
      };
    },
    { files, formats, type }
  );

/** Copies what has focus, and pastes it where `target` has focus. */
const copyFrom = async (source: Locator) => {
  await source.focus();
  return await fire(source, "copy");
};

const pasteAt = async (target: Locator, formats: Record<string, string>) => {
  await target.focus();
  await fire(target, "paste", { formats });
};

/** The JSON in a copy's HTML, as a Mail Quilt editor reads it. */
const copiedJson = (page: Page, html: string) =>
  page.evaluate((copied) => {
    const holder = document.createElement("template");
    holder.innerHTML = copied;
    return JSON.parse(
      holder.content.querySelector<HTMLElement>("[data-mail-quilt]")?.dataset
        .mailQuilt ?? "null"
    ) as unknown;
  }, html);

test.describe("through the system's clipboard", () => {
  // The one test that uses the system's clipboard, as tests running at the
  // same time could share it. Browsers clean pasted HTML differently, so this
  // checks that the copy's JSON survives in each.
  test("Ctrl/⌘+C and Ctrl/⌘+V copy a Block and a Row from one page to another, with every setting", async ({
    context,
    page,
  }) => {
    await openBlocks(page, ["button"]);
    await canvas(page).evaluate((element, props) => {
      const mailQuilt = element as MailQuilt;
      const email = structuredClone(mailQuilt.value);
      const block = email?.rows[0]?.columns[0]?.blocks[0];
      if (email && block) {
        block.props = props;
        mailQuilt.value = email;
      }
    }, BUTTON);
    const other = await context.newPage();
    await openEmail(other, [[["A"]]]);

    await blockGroup(page, "Button").focus();
    await page.keyboard.press("ControlOrMeta+c");
    await blockWith(other, "A").focus();
    await other.keyboard.press("ControlOrMeta+v");

    const [, pastedBlock] = await blocks(other);
    expect(pastedBlock).toMatchObject({ props: BUTTON, type: "button" });

    await selectRowButton(page, 1).focus();
    await page.keyboard.press("ControlOrMeta+c");
    await selectRowButton(other, 1).focus();
    await other.keyboard.press("ControlOrMeta+v");

    const { rows } = await currentValue(other);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.columns[0]?.blocks[0]).toMatchObject({
      props: BUTTON,
      type: "button",
    });
  });
});

test.describe("copying", () => {
  test("a Row writes its text, and simple HTML holding the Row as JSON, and says where it is", async ({
    page,
  }) => {
    await page.goto("/");
    const row: BlocksDocument["rows"][number] = {
      columns: [
        {
          blocks: [
            {
              id: "text",
              props: {
                content: {
                  content: [
                    {
                      content: [
                        { marks: [{ type: "bold" }], text: "Hi", type: "text" },
                        { text: " ", type: "text" },
                        { attrs: { name: "first_name" }, type: "mergeTag" },
                      ],
                      type: "paragraph",
                    },
                    {
                      content: [
                        {
                          content: [
                            {
                              content: [{ text: "One", type: "text" }],
                              type: "paragraph",
                            },
                          ],
                          type: "listItem",
                        },
                      ],
                      type: "bulletList",
                    },
                  ],
                  type: "doc",
                },
              },
              type: "text",
            },
          ],
          id: "column-0",
          props: {},
          width: 50,
        },
        {
          blocks: [
            {
              id: "image",
              props: {
                alt: "Logo",
                href: "https://example.com",
                src: "https://cdn.example/photo.png",
              },
              type: "image",
            },
            { id: "button", props: BUTTON, type: "button" },
            {
              id: "social",
              props: {
                links: [
                  { network: "facebook", url: "https://facebook.com/shop" },
                  { network: "x" },
                ],
              },
              type: "social",
            },
          ],
          id: "column-1",
          props: {},
          width: 50,
        },
      ],
      id: "row-0",
      props: {},
    };
    await setValue(page, {
      kind: "blocks",
      rows: [row],
      settings: {
        backgroundColor: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        width: 600,
      },
      version: 4,
    });

    const copied = await copyFrom(selectRowButton(page, 1));

    expect(copied["text/plain"]).toBe(
      "Hi {{first_name}}\n\nOne\n\nLogo\n\nBuy\n\nFacebook: https://facebook.com/shop"
    );
    const html = copied["text/html"];
    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain("<ul><li><p>One</p></li></ul>");
    expect(html).toContain(
      '<a href="https://example.com"><img src="https://cdn.example/photo.png" alt="Logo"></a>'
    );
    expect(html).toContain('<a href="https://example.com/buy">Buy</a>');
    expect(html).toContain(
      '<p><a href="https://facebook.com/shop">Facebook</a></p>'
    );
    expect(await copiedJson(page, html)).toStrictEqual({ row, version: 4 });
    await expect(announcement(page)).toHaveText("Row copied, position 1 of 1.");
  });

  test("an Image's URL isn't loaded by the copy, as a Merge Tag in it would be read as a path on the host page", async ({
    page,
  }) => {
    await openBlocks(page, ["image"]);
    await canvas(page).evaluate((element) => {
      const mailQuilt = element as MailQuilt;
      const email = structuredClone(mailQuilt.value);
      const block = email?.rows[0]?.columns[0]?.blocks[0];
      if (email && block) {
        block.props = { alt: "Logo", src: "{{logo_url}}" };
        mailQuilt.value = email;
      }
    });
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));

    const copied = await copyFrom(blockGroup(page, "Image"));

    expect(copied["text/html"]).toContain(
      '<img src="{{logo_url}}" alt="Logo">'
    );
    expect(requested.filter((url) => url.includes("logo_url"))).toStrictEqual(
      []
    );
  });

  test("a Block pasted into text gives its text, as any pasted HTML does", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    const copied = await copyFrom(blockWith(page, "A"));
    await textOf(page, "B").click();
    await moveCursorToLineEnd(page);

    await pasteHtml(textOf(page, "B"), copied["text/html"]);

    expect(await structure(page)).toStrictEqual([[["A", "BA"]]]);
  });
});

test.describe("pasting a copied Block", () => {
  test("puts it after the selected Block, with new IDs, focus on it, and as one undo step, and says where", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    const copied = await copyFrom(blockWith(page, "A"));

    await pasteAt(blockWith(page, "A").first(), copied);

    expect(await structure(page)).toStrictEqual([[["A", "A", "B"]]]);
    const pastedIn = await blocks(page);
    const ids = pastedIn.map(({ id }) => id);
    expect(new Set(ids).size).toBe(3);
    await expect(
      textBlockAt(page, "Row 1, Column 1, position 2 of 3")
    ).toBeFocused();
    await expect(announcement(page)).toHaveText(
      "Block pasted, Row 1, Column 1, position 2 of 3."
    );

    await undoByKey(page);
    expect(await structure(page)).toStrictEqual([[["A", "B"]]]);
  });

  test("puts it in a new Row after the selected Row, or in a new Row at the end with nothing selected", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    const copied = await copyFrom(blockWith(page, "B"));

    await pasteAt(selectRowButton(page, 1), copied);
    expect(await structure(page)).toStrictEqual([[["A"]], [["B"]], [["B"]]]);

    await openEmail(page, [[["A"]], [["C"]]]);
    await pasteAt(emailTools(page), copied);
    expect(await structure(page)).toStrictEqual([[["A"]], [["C"]], [["B"]]]);
  });
});

test.describe("pasting a copied Row", () => {
  test("puts it after the selected Block's Row, or the selected Row, or else at the end, with its Columns' widths", async ({
    page,
  }) => {
    await openEmail(page, [[["A"], ["B"]], [["C"]], [["D"]]]);
    const copied = await copyFrom(selectRowButton(page, 1));

    await pasteAt(blockWith(page, "C"), copied);
    expect(await structure(page)).toStrictEqual([
      [["A"], ["B"]],
      [["C"]],
      [["A"], ["B"]],
      [["D"]],
    ]);

    await pasteAt(selectRowButton(page, 1), copied);
    expect(await structure(page)).toStrictEqual([
      [["A"], ["B"]],
      [["A"], ["B"]],
      [["C"]],
      [["A"], ["B"]],
      [["D"]],
    ]);
    await expect(selectRowButton(page, 2)).toBeFocused();
    await expect(announcement(page)).toHaveText("Row pasted, position 2 of 5.");
    const { rows } = await currentValue(page);
    expect(rows[1]?.columns.map(({ width }) => width)).toStrictEqual([50, 50]);

    await openEmail(page, [[["D"]]]);
    await pasteAt(emailTools(page), copied);
    expect(await structure(page)).toStrictEqual([[["D"]], [["A"], ["B"]]]);
  });
});

test.describe("pasting from outside", () => {
  test("text or HTML becomes a Text Block after the selected Block, read through the text's schema", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);

    await pasteAt(blockWith(page, "A"), {
      "text/html": `<p><b style="color: red">Hi</b> {{name}}</p><script>alert(1)</script>`,
      "text/plain": "Hi {{name}}",
    });

    const [, pasted] = await blocks(page);
    expect(pasted).toMatchObject({
      props: {
        content: {
          content: [
            {
              content: [
                { marks: [{ type: "bold" }], text: "Hi", type: "text" },
                { text: " ", type: "text" },
                { attrs: { name: "name" }, type: "mergeTag" },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
      },
      type: "text",
    });
    await expect(announcement(page)).toHaveText(
      "Block pasted, Row 1, Column 1, position 2 of 2."
    );
  });

  test("an image file adds an Image Block after the selected Block, uploaded through uploadImage, and is refused without it", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    await canvas(page).evaluate((element) => {
      (element as MailQuilt).uploadImage = () =>
        Promise.resolve({ url: "https://cdn.example/uploaded.png" });
    });

    await blockWith(page, "A").focus();
    await fire(blockWith(page, "A"), "paste", {
      files: [{ name: "shot.png", type: "image/png" }],
    });

    expect(await blockTypes(page)).toStrictEqual(["text", "image"]);
    await expect
      .poll(() => blockProps(page, 1))
      .toStrictEqual({ src: "https://cdn.example/uploaded.png" });

    await canvas(page).evaluate((element) => {
      (element as MailQuilt).uploadImage = undefined;
    });
    await blockWith(page, "A").focus();
    await fire(blockWith(page, "A"), "paste", {
      files: [{ name: "shot.png", type: "image/png" }],
    });
    expect(await blockTypes(page)).toStrictEqual(["text", "image"]);
    await expect(announcement(page)).toHaveText(
      "Can't paste. This editor can't upload images."
    );
  });

  test("a copy from a newer version is refused, and says why", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]]]);
    const json = JSON.stringify({
      block: { id: "x", props: { label: "Buy" }, type: "button" },
      version: 5,
    }).replaceAll('"', "&quot;");

    await pasteAt(blockWith(page, "A"), {
      "text/html": `<div data-mail-quilt="${json}"><p>Buy</p></div>`,
      "text/plain": "Buy",
    });

    expect(await structure(page)).toStrictEqual([[["A"]]]);
    await expect(announcement(page)).toHaveText(
      "Can't paste. It was copied from a newer version of the editor."
    );
  });
});

test.describe("cutting", () => {
  test("a Block copies it, then deletes it, moving focus to the next Block, and says where it was", async ({
    page,
  }) => {
    await openEmail(page, [[["A", "B"]]]);
    await blockWith(page, "A").focus();

    const cut = await fire(blockWith(page, "A"), "cut");

    expect(cut["text/plain"]).toBe("A");
    expect(await structure(page)).toStrictEqual([[["B"]]]);
    await expect(blockWith(page, "B")).toBeFocused();
    await expect(announcement(page)).toHaveText(
      "Block cut, Row 1, Column 1, position 1 of 2."
    );
  });

  test("in a Row's toolbar copies the Row, then deletes it, moving focus to the next Row's toolbar", async ({
    page,
  }) => {
    await openEmail(page, [[["A"]], [["B"]]]);
    await selectRowButton(page, 1).focus();

    const cut = await fire(selectRowButton(page, 1), "cut");

    expect(cut["text/plain"]).toBe("A");
    expect(await structure(page)).toStrictEqual([[["B"]]]);
    await expect(selectRowButton(page, 1)).toBeFocused();
    await expect(announcement(page)).toHaveText("Row cut, position 1 of 2.");
  });
});
