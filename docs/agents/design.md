# Designing and building UI

Mail Quilt has two kinds of UI, and they're designed differently:

- **The editor** (`<mail-quilt>`, `<mail-quilt-shell>`, the panels, toolbars, format bar and Preview, in `packages/editor`) runs inside other people's apps. It's a Lit Web Component in Shadow DOM (ADR 0002), styled only through its theme tokens (`packages/editor/src/theme.ts`, documented in `apps/docs/docs/theme-tokens.mdx`). Its default theme is neutral, not Mail Quilt's brand, so it sits well in any host app, and a host restyles it by setting tokens.
- **The site** (`apps/docs`: the landing page, the docs, Examples, Compare and the Playground) is Mail Quilt's own face, built with Blume and styled in `theme.css` and `styles/` from the logo's language.

This page sets the bar, the process and the checklist every UI change passes before it's called done, on either.

## The bar

- **Start from a concept, not from components.** On the site, the concept is the logo's: a visible **grid** that Blocks sit in, a dashed **slot** for anything empty, planned or untested, and a **lift** for whatever the pointer picks up. The orange marks one thing at a time. In the editor, the concept is the email itself: the canvas shows the email as it will be sent, and the editor's own chrome stays quiet around it.
- **Every screen has one job.** Before drawing it, write down who arrives there, in what state, what they need to know, and what they do next. For the editor, that person is the host app's user, a marketer or founder designing an email without code, inside someone else's product.
- **Content is design.** Every heading, label and sentence is specific and true. Name things the way users think of them, in `GLOSSARY.md` terms.
- **Never promise what isn't built.** A section that doesn't work yet is shown as coming, or left out. It's never filled with placeholders that look real.
- **Never draw a guess.** A screen waits for what it needs rather than drawing a state and changing it a moment later.
- **Ask "would a senior designer sign this?",** not "is it clean?". Clean but generic is not done, and neither is loud for its own sake.

## Process

1. **UX first.** Write down the screen's job, who arrives and in what state, every state it has (loading, empty, error, success, disabled), and its copy, before any styling.
2. **Mock up anything new, then stop.** Every new screen, panel, toolbar, menu, dialog or site section is shown as rendered mockups before it's built: desktop and phone (1440 and 390 px), light and dark, every state from step 1. The full set of widths in step 6 is for the build, not the mockups. Show two or three directions with a recommendation, and wait for the maintainer's pick. This holds on a `ready-for-agent` ticket too. Only copy, spacing and token changes inside an existing component skip this step.
3. **Question every default.** For each browser, Lit or Blume default the design leans on, check how it renders on a phone, its type size, its focus and its motion, and keep it only when it's right. Say which you kept. Ones that matter here:
   - The host page's `color-scheme`, fonts and colours don't reach inside the editor's Shadow DOM; only its tokens do (`--mq-color-scheme` for what the browser draws itself, such as a dropdown's open list).
   - Blume's own header, sidebar and docs styles are restyled by selectors in `theme.css`, which a Blume upgrade can break (`apps/docs/README.md`, "Before upgrading Blume").
   - Inputs under 16px make Safari on iPhone and iPad zoom the page.
4. **Build** with the existing tokens and pieces. In the editor, each module keeps its CSS beside its template, shared styles are `theme.ts`'s, every shadow is a token's, and a property of the editor's own that isn't a token is named `--_mq-…` (`docs/agents/decisions.md`). On the site, use `theme.css`'s `--site-*` tokens and the pieces in `styles/site.css`.
   - The picked mockup is the visual spec. The build matches it screen by screen, and any visible difference fails unless it's named as better. Don't redesign while building.
   - Before building any confirmation, error, empty or busy state, find how the editor or site already does it and reuse that. Say in the design notes which existing pattern a new screen follows.
   - Use the `frontend-design` skill for visual direction and the `emil-design-eng` skill for interaction polish: press and hover states, where a popover grows from, tooltip timing, transitions.
5. **Review** against the checklist below. Where a rule is deliberately broken, the code or this page says why. A correctness review is not a design review.
6. **Make the evidence and look at it, to find faults.** Before calling UI done, produce and inspect:
   - screenshots at 320, 390, 768, 1024, 1440, 1920 and 2560 px wide, in light and dark, for every state, including errors. For the editor, that's its default theme and its built-in dark theme (`theme="dark"`), and below 640px its narrow notice. The wide screens matter: a layout that looks right at 1440 can stretch badly on a wide monitor;
   - every dialog, menu, tooltip and the Preview open, on a phone and on desktop;
   - a frame-by-frame recording of anything that loads, in which nothing already drawn moves or changes;
   - focus and keyboard paths checked in a real browser with real keys, against `keyboard.mdx` and the rules in `docs/agents/decisions.md`, "Keys and focus".
   While you iterate, shoot only the state you changed, at 390 and 1440 px. Shoot the full set when the build is finished, before the design review in step 7, and again for any state a review fix changes.

   The `editor-screens` skill makes all of these. Tests passing is not evidence of design, and neither are screenshots alone.
7. **Get a fresh design review.** Give a reviewer agent that hasn't seen your work this page, the brand docs, the `frontend-design` and `emil-design-eng` skills, the code and the evidence, but not your conclusions. Fix each finding or say why it stays.
8. **Say what was checked in the pull request:** each checklist item with what showed it, what the design review found and what changed. Images go in only when a human reviewer needs to see a visual change, such as a before and after.

## Brand

The official logo kit is in `docs/brand/` (see its README). The site's copies are in `apps/docs/public/`. Use these files as they are; never redraw, recolour, stretch or rearrange the logo.

- **Colours:** ink `#111113`, accent `#D4380F`, quilt grey `#71717A`. The site's light and dark values live in `apps/docs/theme.css`.
- **Type:** Space Grotesk for display headings.
- **The accent is used sparingly:** for brand moments and the one thing being picked up or placed, never for ordinary actions.
- **The editor isn't branded.** Its default accent is a neutral blue so it fits a host app, and hosts can white-label it. Mail Quilt's brand belongs on the site.
- **Quilting stays in the pictures; the words stay plain.** No sewing puns in the copy.

## Review checklist

Run this on every UI change, and explain each finding in plain words: what a user would see go wrong, not only the name of the rule.

1. **UI states:** loading, empty, error, success and disabled are all handled. Try long text, missing data, an empty email, a very long one, and double clicks.
2. **Accessibility (WCAG 2.2 AA):** the editor's own status is in `apps/docs/docs/accessibility.mdx`; a change keeps it true or updates it.
   - Every control has a name and a label. Errors and refusals are announced.
   - Keyboard focus is visible, and anything a person can do by dragging they can do from the keyboard.
   - When the focused element is removed or disabled, focus moves somewhere on purpose (ADR 0011).
   - Text contrast is at least 4.5:1; icons and borders at least 3:1, in the default theme and the built-in dark theme.
   - Targets are at least 24 px.
   - Motion respects reduced motion. Decorative graphics are hidden from screen readers.
3. **Responsive:** the widths above, with no sideways scroll. A one-column page is capped and centred on wide screens, never left-aligned with an empty gap on the right.
4. **Theming:** the editor uses its tokens only, and a host token set on the element wins, in either theme. The site uses `theme.css`'s tokens. No hard-coded colours or one-off sizes; add a token instead, with its dark value in `theme.ts`, and document a new editor token in `theme-tokens.mdx`.
5. **Reuse and structure:** repeated markup or logic becomes one component or module. Each has one job, a small API and no dead code. Names say what things are.
6. **Lit and types:** no needless casts, listeners cleaned up, and state kept once (ADR 0016).
7. **Performance:** watch what each font, icon and library adds to the editor's bundle; it ships inside other apps. MJML loads only for Preview and export. Animate `transform` and `opacity` only.
8. **Privacy and security:** no personal data in URLs or logs. External links use `rel="noopener noreferrer"`.
9. **Copy:** plain and true, with the same name for an action everywhere it appears. Nothing on screen promises a feature that doesn't exist.
10. **Tests:** behaviour tests at the right level (`docs/agents/testing.md`), with the automated accessibility check in the browser tests, each seen failing without its code.

Check each finding against the code before reporting it. For an independent read, give a fresh reviewer the code and this checklist, not your own conclusions.
