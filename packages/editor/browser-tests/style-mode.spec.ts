import type { BlocksDocument } from "@mailquilt/core";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  canvas,
  change,
  currentValue,
  emailWith,
  EXPORT_VIEWPORT,
  openExport,
  openStyle,
  pickStyleColor,
  setting,
  setValue,
  styleSetting,
  stylePanel,
  TALL_VIEWPORT,
  test,
  undo,
  undoByKey,
  violations,
} from "./helpers.js";

const paragraph = (text: string, marks?: unknown[]) => ({
  content: [{ content: [{ marks, text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/**
 * Every kind of Block Email style reaches: a Heading, Text with a link and a
 * Button, in a Row of the email's color, and Text in a Row of its own color.
 */
const styledEmail = (): BlocksDocument =>
  ({
    kind: "blocks",
    rows: [
      {
        columns: [
          {
            blocks: [
              {
                id: "heading",
                props: { content: paragraph("Spring"), level: 2 },
                type: "heading",
              },
              {
                id: "text",
                props: {
                  content: paragraph("Read on", [
                    { attrs: { href: "https://shop.example" }, type: "link" },
                  ]),
                },
                type: "text",
              },
              {
                id: "button",
                props: { href: "https://shop.example", label: "Shop" },
                type: "button",
              },
            ],
            id: "column-a",
            props: {},
            width: 100,
          },
        ],
        id: "row-a",
        props: {},
      },
      {
        columns: [
          {
            blocks: [
              { id: "own", props: { content: paragraph("Own") }, type: "text" },
            ],
            id: "column-b",
            props: {},
            width: 100,
          },
        ],
        id: "row-b",
        props: { backgroundColor: "#00ff00" },
      },
    ],
    settings: {
      backgroundColor: "#eeeeee",
      fontFamily: "Arial, Helvetica, sans-serif",
      style: {
        buttonBackgroundColor: "#112233",
        buttonBorderRadius: 12,
        emailBackgroundColor: "#fbf7f1",
        heading2FontSize: 30,
        headingFontFamily: "Georgia, serif",
        linkColor: "#b5652b",
        textColor: "#2b1d14",
        textFontSize: 18,
      },
      width: 600,
    },
    version: 4,
  }) as BlocksDocument;

const read = (locator: Locator, names: readonly string[]) =>
  locator.evaluate(
    (element, properties) =>
      Object.fromEntries(
        properties.map((name) => [
          name,
          getComputedStyle(element).getPropertyValue(name),
        ])
      ),
    names
  );

/** What Email style changes, read from what's drawn. */
const lookOf = async (root: Locator | Page) => {
  // Where the Row's color shows: around its Blocks, inside its padding.
  const behind = (text: string) =>
    root.getByText(text, { exact: true }).evaluate((element) => {
      let at: Element | null = element;
      while (at) {
        const { backgroundColor } = getComputedStyle(at);
        if (backgroundColor !== "rgba(0, 0, 0, 0)") {
          return backgroundColor;
        }
        at = at.parentElement;
      }
      return "";
    });
  return {
    button: await read(root.getByText("Shop", { exact: true }), [
      "background-color",
      "border-top-left-radius",
      "font-size",
    ]),
    heading: await read(root.getByText("Spring", { exact: true }), [
      "color",
      "font-family",
      "font-size",
    ]),
    link: await read(root.getByRole("link", { name: "Read on" }), ["color"]),
    ownRow: await behind("Own"),
    row: await behind("Spring"),
    text: await read(root.getByText("Read on", { exact: true }).locator(".."), [
      "color",
      "font-size",
    ]),
  };
};

test("the Canvas draws each Email style field as the export does", async ({
  page,
}) => {
  await page.goto("/");
  await setValue(page, styledEmail());
  await expect(canvas(page).getByText("Spring")).toBeVisible();

  const onCanvas = await lookOf(canvas(page).getByTestId("email"));
  const { opened } = await openExport(page, EXPORT_VIEWPORT);
  const exported = await lookOf(opened);
  await opened.close();

  expect(onCanvas).toEqual(exported);
  // So the export did take each field, and the two don't match by default.
  expect(exported).toEqual({
    button: {
      "background-color": "rgb(17, 34, 51)",
      "border-top-left-radius": "12px",
      "font-size": "18px",
    },
    heading: {
      color: "rgb(43, 29, 20)",
      "font-family": "Georgia, serif",
      "font-size": "30px",
    },
    link: { color: "rgb(181, 101, 43)" },
    ownRow: "rgb(0, 255, 0)",
    row: "rgb(251, 247, 241)",
    text: { color: "rgb(43, 29, 20)", "font-size": "18px" },
  });
});

/** The email's Email style, as saved. */
const styleOf = async (page: Page) => {
  const { settings } = await currentValue(page);
  return settings.style;
};

/** The Text color in the Email style, as saved. */
const textColorOf = async (page: Page) => {
  const style = await styleOf(page);
  return style?.textColor;
};

/** The first Block's props, as saved. */
const firstBlockProps = async (page: Page) => {
  const { rows } = await currentValue(page);
  return rows[0]?.columns[0]?.blocks[0]?.props;
};

/** An email of a Heading 1 at 36px of its own, a Heading 1 and a Button. */
const emailWithOwnHeading = (): BlocksDocument =>
  ({
    ...emailWith([]),
    rows: [
      {
        columns: [
          {
            blocks: [
              {
                id: "own",
                props: { content: paragraph("Own"), fontSize: 36, level: 1 },
                type: "heading",
              },
              {
                id: "shared",
                props: { content: paragraph("Shared"), level: 1 },
                type: "heading",
              },
              { id: "button", props: { label: "Shop" }, type: "button" },
            ],
            id: "column",
            props: {},
            width: 100,
          },
        ],
        id: "row",
        props: {},
      },
    ],
  }) as BlocksDocument;

const openStyled = async (page: Page, email = emailWithOwnHeading()) => {
  await page.goto("/");
  await setValue(page, email);
  return await openStyle(page);
};

const fontSizeOf = (page: Page, text: string) =>
  canvas(page)
    .getByTestId("email")
    .getByText(text, { exact: true })
    .evaluate((element) => getComputedStyle(element).fontSize);

const buttonFace = (page: Page) =>
  canvas(page).getByTestId("email").getByText("Shop", { exact: true });

test.describe("the Style Mode", () => {
  test("sets a color and clears it back to the built-in look, each as one undo step, with the Canvas following", async ({
    page,
  }) => {
    await openStyled(page);

    await pickStyleColor(page, "Buttons", "#112233");

    expect(await styleOf(page)).toStrictEqual({
      buttonBackgroundColor: "#112233",
    });
    await expect(buttonFace(page)).toHaveCSS(
      "background-color",
      "rgb(17, 34, 51)"
    );
    // Escape put focus back on the setting, which now says its value.
    await expect(styleSetting(page, "Buttons")).toBeFocused();
    await expect(styleSetting(page, "Buttons")).toHaveAccessibleName(
      "Buttons #112233"
    );

    await styleSetting(page, "Buttons").click();
    await stylePanel(page)
      .getByRole("button", { name: "Use the default (#2563EB)" })
      .click();

    expect(await styleOf(page)).toBeUndefined();
    await expect(buttonFace(page)).toHaveCSS(
      "background-color",
      "rgb(37, 99, 235)"
    );
    await expect(styleSetting(page, "Buttons")).toHaveAccessibleName(
      "Buttons Default #2563EB"
    );
    await undo(page);
    expect(await styleOf(page)).toStrictEqual({
      buttonBackgroundColor: "#112233",
    });
    await undo(page);
    expect(await styleOf(page)).toBeUndefined();
  });

  test("a color dragged across the shade is one undo step, and the arrow keys change it", async ({
    page,
  }) => {
    await page.setViewportSize(TALL_VIEWPORT);
    await openStyled(page);
    await styleSetting(page, "Text").click();
    const shade = stylePanel(page).getByRole("slider", { name: "Text shade" });
    const box = await shade.boundingBox();
    if (!box) {
      throw new Error("No shade");
    }

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 5,
    });
    await page.mouse.up();

    const dragged = await textColorOf(page);
    expect(dragged).toMatch(/^#[\da-f]{6}$/u);
    await expect(shade).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowUp");
    expect(await textColorOf(page)).not.toBe(dragged);
    // The keys after the drag are a step of their own.
    await stylePanel(page).getByLabel("Hex").focus();
    await undoByKey(page);
    expect(await textColorOf(page)).toBe(dragged);
    await undoByKey(page);
    expect(await styleOf(page)).toBeUndefined();
  });

  test("refuses a color it can't take, and says why", async ({ page }) => {
    await openStyled(page);
    await styleSetting(page, "Buttons").click();
    const hex = stylePanel(page).getByLabel("Hex");

    await change(hex, "rgba(0, 0, 0, 0.5)");

    await expect(stylePanel(page).getByRole("alert")).toHaveText(
      "Use a solid color such as #ff0000, or rgb(255, 0, 0)."
    );
    await expect(hex).toHaveAttribute("aria-invalid", "true");
    expect(await styleOf(page)).toBeUndefined();
  });

  test("sets a size and clears it, and a Block's own size stays", async ({
    page,
  }) => {
    await openStyled(page);

    await styleSetting(page, "Heading 1").click();
    const size = stylePanel(page).getByLabel("Heading 1 size (px)");
    await expect(size).toBeFocused();
    await change(size, "40");

    expect(await styleOf(page)).toStrictEqual({ heading1FontSize: 40 });
    expect(await fontSizeOf(page, "Shared")).toBe("40px");
    expect(await fontSizeOf(page, "Own")).toBe("36px");

    await stylePanel(page)
      .getByRole("button", { name: "Use the default (32px)" })
      .click();
    expect(await styleOf(page)).toBeUndefined();
    expect(await fontSizeOf(page, "Shared")).toBe("32px");
    await expect(styleSetting(page, "Heading 1")).toBeFocused();
  });

  test("picks a font from the keyboard, and the Headings' default is the body font", async ({
    page,
  }) => {
    await openStyled(page);
    await styleSetting(page, "Headings").focus();
    await page.keyboard.press("Enter");
    const search = stylePanel(page).getByRole("combobox", {
      name: "Search fonts",
    });
    await expect(search).toBeFocused();

    await search.fill("geo");
    await page.keyboard.press("Enter");

    expect(await styleOf(page)).toStrictEqual({
      headingFontFamily: "Georgia, 'Times New Roman', serif",
    });
    await expect(styleSetting(page, "Headings")).toBeFocused();
    await expect(
      canvas(page).getByTestId("email").getByText("Shared", { exact: true })
    ).toHaveCSS("font-family", /^Georgia/u);

    await page.keyboard.press("Enter");
    // "Same as body", the default, is first, above the font that's chosen.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    expect(await styleOf(page)).toBeUndefined();
  });

  test("offers a saved font that isn't on the list, and closes a list with Escape", async ({
    page,
  }) => {
    const value = emailWithOwnHeading();
    value.settings.fontFamily = "Papyrus, fantasy";
    await openStyled(page, value);
    await expect(styleSetting(page, "Body")).toHaveAccessibleName(
      "Body Papyrus"
    );

    await styleSetting(page, "Body").click();
    await expect(
      stylePanel(page).getByRole("option", { selected: true })
    ).toHaveAccessibleName("Papyrus");
    await page.keyboard.press("Escape");

    await expect(stylePanel(page).getByRole("listbox")).toHaveCount(0);
    await expect(styleSetting(page, "Body")).toBeFocused();
  });

  test("sets Button corners, and clears them", async ({ page }) => {
    await openStyled(page);

    await stylePanel(page).getByRole("radio", { name: "Rounded" }).check();

    expect(await styleOf(page)).toStrictEqual({ buttonBorderRadius: 8 });
    await expect(buttonFace(page)).toHaveCSS("border-top-left-radius", "8px");
    await stylePanel(page)
      .getByRole("button", { name: "Use the default (3px)" })
      .click();
    expect(await styleOf(page)).toBeUndefined();
    await expect(buttonFace(page)).toHaveCSS("border-top-left-radius", "3px");
  });

  test("in Edit, a Block's settings show the Email style's value where it sets none, as the Canvas draws it", async ({
    page,
  }) => {
    await openStyled(page);
    await styleSetting(page, "Heading 1").click();
    await change(stylePanel(page).getByLabel("Heading 1 size (px)"), "40");
    await pickStyleColor(page, "Text", "#112233");

    await canvas(page).getByRole("tab", { exact: true, name: "Edit" }).click();
    await canvas(page)
      .getByTestId("email")
      .getByText("Shared", { exact: true })
      .click();

    await expect(await setting(page, "Font size (px)")).toHaveValue("40");
    await expect(await setting(page, "Color")).toHaveValue("#112233");
  });

  test("marks on the Canvas what a hovered setting changes, and what keeps its own", async ({
    page,
  }) => {
    await openStyled(page);

    await styleSetting(page, "Heading 1").hover();

    const tags = canvas(page).getByTestId("style-tag");
    await expect(tags).toHaveText(["Keeps its own · 36px", "Heading 1 · 32px"]);
    await page.mouse.move(0, 0);
    await expect(tags).toHaveCount(0);
  });

  test("shows the email only to look at: a press selects a Block, which says what it keeps as its own", async ({
    page,
  }) => {
    await openStyled(page);

    // The email takes no presses, so this one is the workspace's, as a
    // person's is.
    const own = await canvas(page)
      .getByTestId("email")
      .getByText("Own", { exact: true })
      .boundingBox();
    await page.mouse.click((own?.x ?? 0) + 5, (own?.y ?? 0) + 5);
    await page.keyboard.type("typed");

    // Only to look at, the email isn't offered to assistive technology, so
    // what's selected is found by how it's marked.
    await expect(
      canvas(page).getByTestId("email").locator('[aria-current="true"]')
    ).toContainText("Own");
    await expect(
      canvas(page).getByTestId("email").getByText("Own", { exact: true })
    ).toBeVisible();
    expect(await firstBlockProps(page)).toMatchObject({
      content: paragraph("Own"),
    });
    await expect(
      stylePanel(page).getByText("This Heading is 36px")
    ).toBeVisible();
    await expect(
      stylePanel(page).getByText("Every other Heading 1 is 32px.")
    ).toBeVisible();

    await stylePanel(page)
      .getByRole("button", { name: "Make every Heading 1 36px" })
      .click();
    expect(await styleOf(page)).toStrictEqual({ heading1FontSize: 36 });
    expect(await firstBlockProps(page)).not.toHaveProperty("fontSize");
    await expect(styleSetting(page, "Heading 1")).toBeFocused();

    // Both changes are one step.
    await undo(page);
    expect(await styleOf(page)).toBeUndefined();
    expect(await firstBlockProps(page)).toHaveProperty("fontSize", 36);

    await canvas(page)
      .getByTestId("workspace")
      .click({ position: { x: 5, y: 5 } });
    await expect(
      stylePanel(page).getByText("This Heading is 36px")
    ).toHaveCount(0);
  });

  test("docks beside the email where both fit, and floats over the Canvas where they don't", async ({
    page,
  }) => {
    await openStyled(page);
    const email = canvas(page).getByTestId("email");
    const docked = await stylePanel(page).boundingBox();
    const shown = await email.boundingBox();
    expect((shown?.x ?? 0) + (shown?.width ?? 0)).toBeLessThanOrEqual(
      docked?.x ?? 0
    );

    await page.setViewportSize({ height: 800, width: 960 });
    await expect(stylePanel(page)).toHaveClass(/floating/u);
    // The email keeps its width, rather than squeezed beside the panel.
    await expect(email).toHaveCSS("width", "600px");
  });

  test("meets WCAG 2.2 AA with each kind of popover open, in both themes", async ({
    page,
  }) => {
    await openStyled(page);
    for (const theme of ["light", "dark"]) {
      await canvas(page).evaluate((element, chosen) => {
        element.setAttribute("theme", chosen);
      }, theme);
      for (const name of ["Buttons", "Heading 1", "Headings"]) {
        await styleSetting(page, name).click();
        expect(await violations(page)).toStrictEqual([]);
        await page.keyboard.press("Escape");
      }
    }
  });
});
