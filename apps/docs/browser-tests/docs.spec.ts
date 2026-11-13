import { BLOCK_TYPES, loadDocument } from "@mailquilt/core";
import { expect, test } from "@playwright/test";

/** For tests of the site's content, which is the same in every browser. */
const SAME_IN_EVERY_BROWSER = "Checks content, so Chromium alone runs it.";

test("the landing page's editor is live, and shows the email it would save", async ({
  page,
}) => {
  await page.goto("/");
  const text = page.getByRole("textbox", { name: "Text Block" }).first();
  const json = page.getByLabel("The email as JSON");
  const html = page.getByLabel("The email as HTML");
  await expect(html).toContainText("{{first_name}}");

  await text.click();
  await page.keyboard.type("Typed on the landing page. ");

  await expect(json).toContainText("Typed on the landing page.");
  await page.getByRole("button", { name: "Export it again" }).click();
  await expect(html).toContainText("Typed on the landing page.");
});

test("the landing page's editor shows a tooltip beside its button", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator("mail-quilt");
  const undo = editor.getByRole("button", { name: "Undo" });

  await undo.hover();
  const tooltip = editor.getByRole("tooltip");
  await expect(tooltip).toBeVisible();

  const button = await undo.boundingBox();
  const tip = await tooltip.boundingBox();
  // The editor places its tooltips against the window, so a CSS transform on
  // anything around it would send them somewhere else on the page.
  const gap = (button?.y ?? 0) - ((tip?.y ?? 0) + (tip?.height ?? 0));
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(16);
});

test("the landing page's editor stays inside its frame as the email grows", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator("mail-quilt");
  const frame = page.locator("[data-home-editor]");
  await expect(editor.getByRole("textbox").first()).toBeVisible();

  // Enough empty Rows to make the email taller than the editor starts out.
  await editor.evaluate((element) => {
    const mailQuilt = element as HTMLElement & {
      value: { rows: unknown[] } | undefined;
    };
    const email = mailQuilt.value;
    if (email) {
      for (let added = 0; added < 4; added += 1) {
        email.rows.push({
          columns: [
            { blocks: [], id: `grown-${added}`, props: {}, width: 100 },
          ],
          id: `grown-row-${added}`,
          props: {},
        });
      }
      mailQuilt.value = { ...email };
    }
  });

  const inner = await editor.boundingBox();
  const outer = await frame.boundingBox();
  expect(inner?.height).toBeGreaterThan(600);
  // Firefox can lay the frame out a fraction of a pixel taller.
  expect(outer?.height).toBeCloseTo(inner?.height ?? 0, 0);
});

test("the landing page recolors its editor with the swatch chosen", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator("mail-quilt");
  await expect(editor.getByRole("textbox").first()).toBeVisible();
  const swatches = page.locator("[data-home-themes] button");

  await swatches.nth(1).click();

  const accent = await swatches.nth(1).getAttribute("data-accent");
  await expect(swatches.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(swatches.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() =>
      editor.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--mq-color-accent").trim()
      )
    )
    .toBe(accent);
});

test("each example shows its whole email, with nothing to scroll inside it", async ({
  page,
}) => {
  await page.goto("/examples");
  const frame = page.locator("iframe[data-example]").first();
  await frame.scrollIntoViewIfNeeded();

  await expect
    .poll(() =>
      frame.evaluate((element) => {
        const iframe = element as HTMLIFrameElement;
        const root = iframe.contentDocument?.documentElement;
        return root && iframe.contentDocument?.URL === "about:srcdoc"
          ? Math.abs(root.scrollHeight - iframe.clientHeight)
          : Number.POSITIVE_INFINITY;
      })
    )
    .toBeLessThanOrEqual(1);
});

test("the landing page's editor starts when arriving from another page", async ({
  page,
}) => {
  await page.goto("/why");

  // The logo links home, and Blume swaps the page in without a reload.
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Mail Quilt" })
    .click();

  await expect(
    page.getByRole("textbox", { name: "Text Block" }).first()
  ).toBeVisible();
});

test("in a narrow window, the landing page shows a picture of the editor", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 390 });
  await page.goto("/");

  await expect(
    page.getByRole("img", { name: /Mail Quilt editor/u })
  ).toBeVisible();
  await expect(page.locator("mail-quilt")).toHaveCount(0);
  await expect(
    page.getByText("This is the editor, one of the four packages", {
      exact: false,
    })
  ).toBeHidden();
});

test("the landing page shows one package at a time, chosen by its tab", async ({
  page,
}) => {
  await page.goto("/");
  // The code beside it has tabs of its own.
  const panels = page.locator(".home-panels").getByRole("tabpanel");

  await expect(panels).toHaveCount(1);
  await expect(panels).toContainText("@mailquilt/editor");

  await page.getByRole("tab", { name: "core" }).click();
  await expect(panels).toContainText("@mailquilt/core");
  // On the bottom row, down goes nowhere.
  await page.keyboard.press("ArrowDown");
  await expect(panels).toContainText("@mailquilt/core");
  await page.keyboard.press("End");
  await expect(panels).toContainText("@mailquilt/renderer");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the landing page still says what every package is for", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
    await page.goto("/");

    for (const name of ["editor", "react", "core", "renderer"]) {
      // oxlint-disable-next-line no-await-in-loop -- One package at a time.
      await expect(
        page.getByRole("heading", { name: `@mailquilt/${name}` })
      ).toBeVisible();
    }
  });
});

test("the document format reference's example is an email core loads", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/docs/document-format");
  const example = await page
    .getByTestId("example-email")
    .locator("pre code")
    .textContent();

  const loaded = loadDocument(JSON.parse(example ?? ""));

  expect(loaded).toMatchObject({ ok: true });
  const used = new Set(
    loaded.ok
      ? loaded.document.rows.flatMap(({ columns }) =>
          columns.flatMap(({ blocks }) => blocks.map(({ type }) => type))
        )
      : []
  );
  // So a new type of Block fails here until the example has one.
  expect(used).toStrictEqual(new Set(BLOCK_TYPES.map(({ type }) => type)));
});

/** A path to a page rather than a file, without a trailing slash. */
const pagePath = (path: string) =>
  /\.\w+$/u.test(path) ? undefined : path.replace(/(?<=.)\/$/u, "");

test("every page's links and assets resolve", async ({
  baseURL,
  browserName,
  context,
  request,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  const { origin } = new URL(baseURL as string);
  const failedAssets: string[] = [];
  context.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url.pathname}`);
    }
  });

  /** Opens a page in a tab of its own, and returns the paths it links to on this site. */
  const linksFrom = async (path: string) => {
    const tab = await context.newPage();
    await tab.goto(path);
    const hrefs = await tab
      .locator("a[href]")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href)
      );
    await tab.close();
    return hrefs
      .map((href) => new URL(href))
      .filter((url) => url.origin === origin)
      .map((url) => url.pathname);
  };

  // The landing page links to every section, and the docs' sidebar to every
  // docs page, so between them every page is opened and its assets checked.
  const fromHomeAndDocs = await Promise.all(["/", "/docs"].map(linksFrom));
  const fromStart = fromHomeAndDocs.flat();
  const pages = [...new Set(fromStart.flatMap((path) => pagePath(path) ?? []))];
  const fromPages = await Promise.all(pages.map(linksFrom));
  const linked = [...new Set([...fromStart, ...fromPages.flat()])];
  const statuses = await Promise.all(
    linked.map(async (path) => {
      const response = await request.get(path);
      return { path, status: response.status() };
    })
  );

  expect(statuses.filter(({ status }) => status >= 400)).toStrictEqual([]);
  expect(failedAssets).toStrictEqual([]);
  // So a crawl that finds nothing can't pass.
  expect(pages).toStrictEqual(
    expect.arrayContaining([
      "/docs",
      "/docs/quick-start",
      "/docs/shell",
      "/docs/packages",
      "/docs/theme-tokens",
      "/docs/keyboard",
      "/docs/render-on-a-server",
      "/docs/change-emails-in-code",
      "/docs/document-format",
      "/docs/email-clients",
      "/playground",
      "/examples",
      "/compare",
      "/why",
      "/roadmap",
    ])
  );
});

const collapse = (text: string) => text.replaceAll(/\s+/gu, " ").trim();

test("the theme tokens page lists every token, with its default", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", SAME_IN_EVERY_BROWSER);
  await page.goto("/playground");
  await expect(page.getByRole("textbox", { name: "Text Block" })).toBeVisible();
  /** The editor's own tokens, from its stylesheet: name, then default. */
  const tokens = await page.locator("mail-quilt").evaluate((host) => {
    const root = host.shadowRoot as ShadowRoot;
    const sheets = [
      ...root.adoptedStyleSheets,
      ...[...root.querySelectorAll("style")].flatMap(({ sheet }) =>
        sheet ? [sheet] : []
      ),
    ];
    return sheets.flatMap((sheet) =>
      [...sheet.cssRules].flatMap((rule) =>
        rule instanceof CSSStyleRule && rule.selectorText === ":host"
          ? [...rule.style]
              .filter((name) => name.startsWith("--mq-"))
              .map((name) => [name, rule.style.getPropertyValue(name)])
          : []
      )
    );
  });

  await page.goto("/docs/theme-tokens");
  const rows = page.getByRole("main").getByRole("row");

  // So a stylesheet the test can't read can't pass.
  expect(tokens.length).toBeGreaterThan(20);
  for (const [name, value] of tokens) {
    const row = rows.filter({
      has: page.getByRole("cell", { exact: true, name }),
    });
    // oxlint-disable-next-line no-await-in-loop -- One token at a time.
    await expect(row).toHaveCount(1);
    // oxlint-disable-next-line no-await-in-loop -- See above.
    expect(collapse((await row.textContent()) ?? "")).toContain(
      collapse(value ?? "")
    );
  }
  await expect(rows).toHaveCount(tokens.length + 4);
});
