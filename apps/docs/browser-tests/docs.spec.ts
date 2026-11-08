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
