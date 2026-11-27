import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import {
  announcement,
  boxOf,
  canvas,
  changesSince,
  emailWith,
  hoverRow,
  letGo,
  moveTo,
  openEmail,
  pickUp,
  rowFrame,
  rowTag,
  rowTools,
  selectRow,
  setValue,
  settle,
  structure,
  test,
  textOf,
  tooltip,
  undoByKey,
  violations,
} from "./helpers.js";

/** Wide enough for the Rows list to start expanded, beside the email and More. */
const WIDE = 1400;

test.use({ viewport: { height: 1600, width: WIDE + 40 } });

const editorOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

const rowsList = (page: Page) => canvas(page).getByTestId("rows-list");

/** A Row in the Rows list, by its name, such as "Row 2 of 3: Text". */
const listRow = (page: Page, name: string) =>
  rowsList(page).getByRole("button", { exact: true, name });

const listRows = (page: Page) => rowsList(page).getByTestId("rows-item");

const toggle = (page: Page, name: "Collapse" | "Expand") =>
  rowsList(page).getByRole("button", { name: `${name} the Rows list` });

const open = async (page: Page, rows: string[][][], width = WIDE) => {
  await openEmail(page, rows);
  await editorOf(page, width);
  // The list takes its shape a frame after the editor's width changes.
  await expect(listRows(page).first()).toBeVisible();
  await settle(page);
};

test.describe("the Rows list", () => {
  test("names each Row with its Position and what it holds, and marks the selected one", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"], ["C"]]]);
    const email = emailWith([[["A"]], [["B"], ["C"]]]);
    await setValue(page, {
      ...email,
      rows: email.rows.map((row, index) =>
        index === 1 ? { ...row, props: { showOn: "desktop" } } : row
      ),
    });

    await expect(listRows(page)).toHaveCount(2);
    await expect(listRow(page, "Row 1 of 2: Text")).toBeVisible();
    await expect(
      listRow(page, "Row 2 of 2: Text, Text. Desktop only")
    ).toBeVisible();

    await selectRow(page, 2);
    await expect(
      listRow(page, "Row 2 of 2: Text, Text. Desktop only")
    ).toHaveAttribute("aria-current", "true");
    // A Block's Row is the current one too.
    await textOf(page, "A").click();
    await expect(listRow(page, "Row 1 of 2: Text")).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("selecting a Row selects it on the Canvas, scrolls there and shows its settings, and focus stays in the list", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1100, width: WIDE + 40 });
    const rows = Array.from({ length: 12 }, (_, index) => [[`Row${index}`]]);
    await open(page, rows);
    await expect(rowFrame(page, 12)).not.toBeInViewport();

    await listRow(page, "Row 12 of 12: Text").click();

    await expect(rowTools(page, 12)).toBeVisible();
    await expect(rowFrame(page, 12)).toBeInViewport();
    await expect(listRow(page, "Row 12 of 12: Text")).toBeFocused();

    // From the keyboard: the arrow keys go along the Rows, and Enter selects.
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await expect(listRow(page, "Row 2 of 12: Text")).toBeFocused();
    await expect(rowTools(page, 12)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(rowTools(page, 2)).toBeVisible();
    await expect(listRow(page, "Row 2 of 12: Text")).toBeFocused();
  });

  test("Alt+↓ and Alt+↑ move the Row with focus, as one undo step each, and say where, with focus on it still", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]], [["C"]]]);
    const expectChanges = await changesSince(page);
    await listRow(page, "Row 1 of 3: Text").focus();

    await page.keyboard.press("Alt+ArrowDown");

    await expect(structure(page)).resolves.toEqual([[["B"]], [["A"]], [["C"]]]);
    await expectChanges(1);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 2 of 3."
    );
    await expect(listRow(page, "Row 2 of 3: Text")).toBeFocused();
    // Selected, so the Selection bar shows what moved.
    await expect(rowTools(page, 2)).toBeVisible();
    // Shown, with the keys that move it.
    await expect(tooltip(page)).toHaveText(/^Row 2 of 3 \(.+ to move\)$/u);

    await page.keyboard.press("Alt+ArrowUp");
    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]], [["C"]]]);
    await page.keyboard.press("Alt+ArrowUp");
    await expect(announcement(page)).toHaveText("The Row can't move up.");

    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["B"]], [["A"]], [["C"]]]);

    // / opens the Add panel, and Escape goes to the selected Row's chip, as
    // from anywhere.
    await listRow(page, "Row 2 of 3: Text").focus();
    await page.keyboard.press("/");
    await expect(canvas(page).getByTestId("add-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(canvas(page).getByTestId("add-panel")).toBeHidden();
    await expect(
      rowTools(page, 2).getByRole("button", { name: /^Row 2/u })
    ).toBeFocused();
  });

  test("dragging a Row moves it, as one undo step, and says where", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]], [["C"]]]);
    const expectChanges = await changesSince(page);

    await pickUp(page, listRow(page, "Row 1 of 3: Text"));
    const last = await boxOf(listRow(page, "Row 3 of 3: Text"));
    await moveTo(page, { x: last.x + last.width / 2, y: last.y + last.height });
    await expect(rowsList(page).getByTestId("rows-drop")).toBeVisible();
    await letGo(page);

    await expect(structure(page)).resolves.toEqual([[["B"]], [["C"]], [["A"]]]);
    await expectChanges(1);
    await expect(announcement(page)).toHaveText(
      "Row moved to position 3 of 3."
    );
    await expect(rowsList(page).getByTestId("rows-drop")).toBeHidden();

    await undoByKey(page);
    await expect(structure(page)).resolves.toEqual([[["A"]], [["B"]], [["C"]]]);

    // A Row dragged by its tag on the email lands in the list too.
    await hoverRow(page, 3);
    await pickUp(page, rowTag(page, 3));
    const first = await boxOf(listRow(page, "Row 1 of 3: Text"));
    await moveTo(page, { x: first.x + first.width / 2, y: first.y + 2 });
    await letGo(page);
    await expect(structure(page)).resolves.toEqual([[["C"]], [["A"]], [["B"]]]);
  });

  test("its + adds an empty Row below the current one, which is selected, and Escape closes it, back on the +", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]]]);
    const add = rowsList(page).getByRole("button", { name: "Add a Row" });
    const layouts = canvas(page).getByTestId("rows-add");

    await add.focus();
    await page.keyboard.press("Enter");
    await expect(layouts).toContainText("Adds at the end");
    await expect(
      layouts.getByRole("button", { name: "Add 100 Row" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(layouts).toBeHidden();
    await expect(add).toBeFocused();

    await selectRow(page, 1);
    await add.click();
    await expect(layouts).toContainText("Adds below Row 1");
    await layouts.getByRole("button", { name: "Add 50/50 Row" }).click();
    const columns = await canvas(page).evaluate(
      (element) => (element as MailQuilt).value?.rows[1]?.columns.length
    );

    expect(columns).toBe(2);
    await expect(layouts).toBeHidden();
    await expect(rowTools(page, 2)).toBeVisible();
    await expect(listRows(page)).toHaveCount(3);
  });

  test("collapses and expands, and keeps that as the editor's width changes", async ({
    page,
  }) => {
    await open(page, [[["A"]], [["B"]]]);

    await toggle(page, "Collapse").click();
    await expect(toggle(page, "Expand")).toBeFocused();
    // Each Row is its number.
    const collapsed = await boxOf(rowsList(page));
    expect(collapsed.width).toBeLessThan(60);
    await editorOf(page, 1500);
    await expect(toggle(page, "Expand")).toBeVisible();

    // Collapsed, a Row's number selects it.
    await listRow(page, "Row 2 of 2: Text").click();
    await expect(rowTools(page, 2)).toBeVisible();

    await toggle(page, "Expand").click();
    await editorOf(page, 1000);
    await expect(toggle(page, "Collapse")).toBeVisible();
  });

  test("starts collapsed where it doesn't fit beside the email with More docked", async ({
    page,
  }) => {
    await open(page, [[["A"]]], 1100);
    await expect(toggle(page, "Expand")).toBeVisible();
  });

  test("a Row's picture is as tall as its Row, scaled, on a page that scales the editor too", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await canvas(page).evaluate((element) => {
      element.style.transform = "scale(0.5)";
      element.style.transformOrigin = "0 0";
    });
    // Drawn while the page scales it.
    await setValue(page, emailWith([[["B", "C", "D"]]]));
    await settle(page);

    const [card, expected] = await canvas(page).evaluate((element) => {
      const picture = element.shadowRoot?.querySelector<HTMLElement>(
        "[data-place=rowPicture]"
      );
      const scale = Number(getComputedStyle(picture as Element).scale);
      return [
        picture?.parentElement?.offsetHeight ?? 0,
        (picture?.offsetHeight ?? 0) * scale,
      ];
    });
    expect(card).toBeGreaterThan(20);
    expect(Math.abs(card - expected)).toBeLessThan(1);
  });

  test("a drag near the end of a long list scrolls it", async ({ page }) => {
    await page.setViewportSize({ height: 700, width: WIDE + 40 });
    const rows = Array.from({ length: 30 }, (_, index) => [[`Row${index}`]]);
    await open(page, rows);
    await canvas(page).evaluate((element) => element.scrollIntoView());
    await settle(page);
    const scroller = rowsList(page).getByTestId("rows-items").locator("..");
    const box = await boxOf(scroller);
    const visibleBottom = Math.min(box.y + box.height, 700);

    await pickUp(page, listRow(page, "Row 1 of 30: Text"));
    await moveTo(page, { x: box.x + box.width / 2, y: visibleBottom - 4 });
    await page.waitForTimeout(300);

    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await letGo(page);
  });

  test("a Row's picture shows what's typed in its text", async ({ page }) => {
    await open(page, [[["A"]]]);
    await textOf(page, "A").click();
    await page.keyboard.press("End");

    await page.keyboard.type(" and more");

    await expect(listRows(page).first()).toContainText("A and more");
  });
});

test.describe("an email with no Rows", () => {
  test("says so in the Rows list, and the email's layouts add a Row, which is selected", async ({
    page,
  }) => {
    await open(page, [[["A"]]]);
    await setValue(page, { ...emailWith([]), rows: [] });

    await expect(rowsList(page)).toContainText("No Rows yet");
    const layouts = canvas(page).getByTestId("start-row");
    // One stop for Tab, where / opens the Add panel, and Escape closes it.
    await layouts.getByRole("button", { name: "Add 100 Row" }).focus();
    await page.keyboard.press("/");
    await expect(canvas(page).getByTestId("add-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(canvas(page).getByTestId("add-panel")).toBeHidden();

    await layouts.getByRole("button", { name: "Add 33/67 Row" }).click();

    await expect(rowTools(page, 1)).toBeVisible();
    await expect(listRows(page)).toHaveCount(1);
  });
});

test.describe("automated accessibility checks of the Rows list", () => {
  test.use({ reducedMotion: "reduce" });

  for (const theme of ["light", "dark"] as const) {
    test(`pass expanded, with its + open, and collapsed, in the ${theme} theme`, async ({
      page,
    }) => {
      await open(page, [[["A"]], [["B"], ["C"]]]);
      await canvas(page).evaluate((element, chosen) => {
        (element as MailQuilt).theme = chosen;
      }, theme);
      await selectRow(page, 2);
      expect(await violations(page)).toEqual([]);

      await rowsList(page).getByRole("button", { name: "Add a Row" }).click();
      await expect(canvas(page).getByTestId("rows-add")).toBeVisible();
      expect(await violations(page)).toEqual([]);

      await toggle(page, "Collapse").click();
      expect(await violations(page)).toEqual([]);
    });
  }
});
