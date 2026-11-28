import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  blockWith,
  boxOf,
  canvas,
  centerOf,
  checkPanel,
  currentValue,
  dropIndicator,
  handleOf,
  layoutTile,
  letGo,
  moveTo,
  openCheck,
  openAddPanel,
  openStyle,
  openTestPage,
  pasteHtml,
  pickUp,
  setValue,
  styleSetting,
  stylePanel,
  TALL_VIEWPORT,
  test,
  textBlock,
  tooltip,
  undoButton,
} from "./helpers.js";

test.use({ viewport: TALL_VIEWPORT });

/** Two Columns, with a Row background and Block settings that aren't defaults. */
const STYLED_EMAIL = {
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "text-one",
              props: {
                color: "#b91c1c",
                content: {
                  content: [
                    {
                      content: [{ text: "One", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "doc",
                },
                fontSize: 20,
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
              id: "button",
              props: { backgroundColor: "#0f766e", label: "Buy" },
              type: "button",
            },
          ],
          id: "column-1",
          props: {},
          width: 50,
        },
      ],
      id: "row-0",
      props: { backgroundColor: "#e0f2fe" },
    },
  ],
  settings: {
    backgroundColor: "#fef3c7",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 4,
};

/**
 * Opens the test page under `style-src 'self'`, with no `'unsafe-inline'`, and
 * `img-src 'self'`, with no `data:`, and records everything the policy blocks,
 * from the page's first script on.
 */
const openUnderStrictPolicy = async (page: Page) => {
  await page.route("/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      headers: {
        ...response.headers(),
        "content-security-policy": "style-src 'self'; img-src 'self'",
      },
      response,
    });
  });
  await page.addInitScript(() => {
    const blocked: string[] = [];
    Object.assign(window, { blockedByPolicy: blocked });
    document.addEventListener(
      "securitypolicyviolation",
      ({ effectiveDirective, target }) => {
        // In the editor, the target is <mail-quilt>, from outside its shadow root.
        blocked.push(
          `${effectiveDirective} in <${(target as Element).localName}>`
        );
      },
      { capture: true }
    );
  });
  await openTestPage(page);
};

const openStyledEmail = async (page: Page) => {
  await setValue(page, STYLED_EMAIL);
  await expect(textBlock(page)).toHaveText("One");
};

/**
 * Everything the policy has blocked so far. The browser reports each one a
 * task later, in order, so this blocks one more style of its own and waits for
 * it.
 */
const blockedByPolicy = async (page: Page) => {
  const marker = await page.evaluateHandle(() => {
    const element = document.createElement("output");
    document.body.append(element);
    element.setAttribute("style", "color: red");
    return element;
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (Reflect.get(window, "blockedByPolicy") as string[]).at(-1)
      )
    )
    .toBe("style-src-attr in <output>");
  await marker.evaluate((element) => element.remove());
  return page.evaluate(() =>
    (Reflect.get(window, "blockedByPolicy") as string[]).slice(0, -1)
  );
};

test("under a strict policy, the canvas shows the email with its settings, and nothing is blocked", async ({
  page,
}) => {
  await openUnderStrictPolicy(page);

  // As first shown, before any change could set its styles again.
  const email = canvas(page).getByTestId("email");
  await expect(email).toHaveCSS("width", "600px");
  await expect(email).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(email).toHaveCSS("font-family", /^Arial/u);

  await openStyledEmail(page);
  await expect(email).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await expect(canvas(page).getByTestId("row")).toHaveCSS(
    "background-color",
    "rgb(224, 242, 254)"
  );
  const columns = canvas(page).getByTestId("column");
  await expect(columns).toHaveCount(2);
  for (const column of await columns.all()) {
    await expect(column).toHaveCSS("width", "300px");
  }
  await expect(blockWith(page, "One")).toHaveCSS("color", "rgb(185, 28, 28)");
  await expect(blockWith(page, "One")).toHaveCSS("font-size", "20px");
  await expect(canvas(page).getByTestId("button-face")).toHaveCSS(
    "background-color",
    "rgb(15, 118, 110)"
  );
  // Its pictures of the layouts set inline styles too, which nothing may block.
  await openAddPanel(page);
  await expect(layoutTile(page, "50/50")).toBeVisible();
  // Style's swatches, a color's shade and each font's own face set inline
  // styles too.
  await openStyle(page);
  await styleSetting(page, "Buttons").click();
  await expect(
    stylePanel(page).getByRole("slider", { name: "Buttons shade" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await styleSetting(page, "Headings").click();
  await expect(
    stylePanel(page).getByRole("option", { name: "Georgia" })
  ).toBeVisible();

  expect(await blockedByPolicy(page)).toStrictEqual([]);
});

test("under a strict policy, a drag shows its Block and the drop line, a tooltip shows by its button, and nothing is blocked", async ({
  page,
}) => {
  await openUnderStrictPolicy(page);
  await openStyledEmail(page);

  await pickUp(page, handleOf(page, "One"));
  const lifted = canvas(page).locator('[role="group"][data-drag-ghost]');
  await expect(lifted).toHaveCSS("color", "rgb(185, 28, 28)");
  // Over the top of the Button, to land above it.
  const target = await boxOf(canvas(page).getByTestId("button-face"));
  await moveTo(page, { x: target.x + target.width / 2, y: target.y + 2 });
  const line = dropIndicator(page);
  await expect(line).toBeVisible();
  const shown = await boxOf(line);
  expect(Math.abs(shown.y - target.y)).toBeLessThan(24);
  expect(shown.width).toBeGreaterThan(200);
  await letGo(page);

  const { rows } = await currentValue(page);
  const [row] = rows;
  expect(
    row?.columns.map(({ blocks }) => blocks.map(({ id }) => id))
  ).toStrictEqual([[], ["text-one", "button"]]);

  await undoButton(page).hover();
  await expect(tooltip(page)).toBeVisible();
  const tip = await centerOf(tooltip(page));
  const button = await centerOf(undoButton(page));
  expect(Math.abs(tip.x - button.x)).toBeLessThan(2);

  expect(await blockedByPolicy(page)).toStrictEqual([]);
});

test("under a strict policy, text pasted from Google Docs or Word keeps its bold, italic and underline, and nothing is blocked", async ({
  page,
}) => {
  await openUnderStrictPolicy(page);
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");

  // Google Docs wraps what it copies in a <b> that isn't bold, and formats with
  // inline styles. Word formats with a style sheet too, and quotes in its own way.
  await pasteHtml(
    textBlock(page),
    `<html><head><style><!-- span.Emphasis { font-style: italic } --></style></head><body><b style="font-weight:normal"><p class=MsoNormal><span style='font-weight:700'>bold</span><span class=Emphasis>italic</span><span style="text-decoration:underline">under</span><span>plain</span></p></b></body></html>`
  );

  await expect(textBlock(page)).toHaveText("bolditalicunderplain");
  const { rows } = await currentValue(page);
  const props = rows[0]?.columns[0]?.blocks[0]?.props as {
    content: { content: { content: unknown[] }[] };
  };
  expect(props.content.content[0]?.content).toStrictEqual([
    { marks: [{ type: "bold" }], text: "bold", type: "text" },
    { marks: [{ type: "italic" }], text: "italic", type: "text" },
    { marks: [{ type: "underline" }], text: "under", type: "text" },
    { text: "plain", type: "text" },
  ]);
  expect(await blockedByPolicy(page)).toStrictEqual([]);
});

test("under a strict policy, the inbox's first words skip what only phones show", async ({
  page,
}) => {
  await openUnderStrictPolicy(page);
  const email = structuredClone(STYLED_EMAIL);
  const [first] = email.rows[0]?.columns[0]?.blocks ?? [];
  (first as { props: object }).props = {
    ...first?.props,
    showOn: "phone",
  };
  await setValue(page, email);
  await openCheck(page);

  await expect(checkPanel(page)).toContainText("“Buy");
  await expect(checkPanel(page)).not.toContainText("“One");
});
