import { BLOCK_TYPES, loadDocument } from "@mailquilt/core";
import { expect, test } from "@playwright/test";

const ROADMAP = "https://github.com/yourcodebuddy-in/mailquilt/issues";

test("the home page links to the Playground and the roadmap", async ({
  page,
}) => {
  await page.goto("/");
  const content = page.getByRole("main");

  await expect(
    content.getByRole("link", { name: /playground/iu }).first()
  ).toHaveAttribute("href", "/playground");
  await expect(
    content.getByRole("link", { name: /roadmap/iu }).first()
  ).toHaveAttribute("href", ROADMAP);
});

test("the document format reference's example is an email core loads", async ({
  page,
}) => {
  await page.goto("/document-format");
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

test("the email clients page says plainly that Outlook is untested", async ({
  page,
}) => {
  await page.goto("/email-clients");

  await expect(page.getByRole("main")).toContainText("Outlook is untested.");
});

/** A path to a page rather than a file, without a trailing slash. */
const pagePath = (path: string) =>
  /\.\w+$/u.test(path) ? undefined : path.replace(/(?<=.)\/$/u, "");

test("every page's links and assets resolve", async ({
  baseURL,
  context,
  request,
}) => {
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

  // Every page has the sidebar, so the home page links to all of them.
  const fromHome = await linksFrom("/");
  const pages = [...new Set(fromHome.flatMap((path) => pagePath(path) ?? []))];
  const fromPages = await Promise.all(pages.map(linksFrom));
  const linked = [...new Set([...fromHome, ...fromPages.flat()])];
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
      "/quick-start",
      "/document-format",
      "/email-clients",
      "/playground",
    ])
  );
});

test("the header offers the Playground on every page but the Playground", async ({
  page,
}) => {
  const cta = () =>
    page.getByRole("banner").getByRole("link", { name: "Try the Playground" });

  for (const path of ["/", "/quick-start", "/theme-tokens"]) {
    // oxlint-disable-next-line no-await-in-loop -- One page at a time.
    await page.goto(path);
    // oxlint-disable-next-line no-await-in-loop -- See above.
    await expect(cta()).toHaveAttribute("href", "/playground");
  }

  await page.goto("/playground");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(cta()).toHaveCount(0);
});

const collapse = (text: string) => text.replaceAll(/\s+/gu, " ").trim();

test("the theme tokens page lists every token, with its default", async ({
  page,
}) => {
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

  await page.goto("/theme-tokens");
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
