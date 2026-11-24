---
name: editor-screens
description: Screenshots and load recordings of the Mail Quilt editor and site, as the evidence docs/agents/design.md requires before UI work is done. Use whenever you change or review anything visible in packages/editor or apps/docs, or are asked for screenshots, the screenshot matrix, phone or dark mode screenshots, the editor's dark theme, a drag in progress, a load recording, a filmstrip, or to check a screen for flashing, layout shift or where focus goes.
---

# Editor screens

Makes the evidence `docs/agents/design.md` asks for: the screenshot matrix (every width, light and dark, for the page and for the editor's theme), menus, dialogs and the Preview open, a drag in progress, and a frame-by-frame recording of something loading. The scripts use Playwright's Chromium, taken from `apps/docs`, so they reach inside the editor's Shadow DOM.

## 1. Run the site

The editor is shot where people meet it: on the site, mostly the Playground (`/playground`), which is the Shell with a starter email. Build, then serve the build, in its own terminal:

```bash
./node_modules/.bin/turbo run build --filter=docs --ui=stream   # the packages, then the site
(cd apps/docs && ./node_modules/.bin/blume preview --port 4180)
```

Rebuild after every change you want to see. The scripts read `SCREENS_URL` (default `http://localhost:4180`). Use your own port if another agent may be running one, and stop only the server you started, by its PID.

Each shot opens a fresh browser, so the Playground starts from its starter email every time.

## 2. Take the evidence

```bash
S="$(git rev-parse --show-toplevel)/.claude/skills/editor-screens/scripts"

# Every width, the page light and dark, with a contact sheet <name>-matrix.png
node $S/screens.mjs --out /tmp/shots --name playground --path /playground

# The editor in its default theme and in the documented dark theme too
node $S/screens.mjs --out /tmp/shots --name playground --path /playground --editor both

# Steps first, run in order
node $S/screens.mjs --out /tmp/shots --name preview --widths 768,1440 --path /playground \
  --step 'click=role=button[name="Preview"]'
# Below 640 px the narrow notice's button is the way in, and it has its own name
node $S/screens.mjs --out /tmp/shots --name preview-phone --widths 320,390 --path /playground \
  --step 'click=role=button[name="Preview email"]'
# The canvas is behind the narrow notice below 640 px, so shoot it from 768 up
node $S/screens.mjs --out /tmp/shots --name block-toolbar --path /playground \
  --widths 768,1024,1440,1920,2560 --step 'click=text=Get started' --step 'press=Escape'

# A drag in progress: picked up and held over the target, not dropped
node $S/screens.mjs --out /tmp/shots --name drag --widths 1440 --path /playground \
  --step 'drag=text=Divider -> text=Get started'

# Every frame painted while the page loads, with 120 ms of latency
node $S/filmstrip.mjs --out /tmp/shots --name playground-load --path /playground

# Or while the last step runs, such as the Preview opening
node $S/filmstrip.mjs --out /tmp/shots --name preview-open --path /playground \
  --step 'click=role=button[name="Preview"]'
```

- **Steps:** `click=`, `hover=`, `type=<text>`, `press=<key>` (Playwright key names: `Tab`, `Shift+Tab`, `Escape`, `Control+z`, `ArrowDown`), `drag=<from> -> <to>`, `wait=<ms>`.
- **Targets** are Playwright selectors and reach inside the Shadow DOM: CSS, `text=Label`, or `role=button[name="Preview"]`, which is the surest. A target that matches nothing, or more than one thing, stops the run with a message and saves nothing for that shot, so a wrong screen is never saved as evidence.
- **Focus:** each line of output names what has focus, looking through the shadow roots. Use it to check focus paths against `keyboard.mdx` and "Keys and focus" in `docs/agents/decisions.md`. Clicks and keys are real input, so focus moves as it does for a person.
- **Widths** default to 320, 390, 768, 1024, 1440, 1920 and 2560. Below 700 px the page is a touch phone. Below 640 px the editor shows its narrow notice instead of the canvas; shoot it on purpose, it's a real state.
- **Themes:** `--themes` is what the browser prefers, which the site follows. `--editor dark` (or `both`) also gives every editor on the page the dark theme from `apps/docs/docs/theme-the-editor.mdx`, read from that page, so the shots test what the docs promise. It overrides tokens a page sets inline, such as the Playground's orange accent.
- **Reduced motion:** set `SCREENS_REDUCED_MOTION=1`.
- **Failed requests:** `--block '<url glob>'` makes a request fail, for an error state that comes from the network, such as a host's image upload. The site's own chunks have hashed names and the MJML chunk also holds the editor, so blocking it breaks the whole page; for the Preview's error state, use the editor's browser tests (`packages/editor/browser-tests`) instead.

## 3. Look, to find faults

Open every image yourself. You are looking for what is wrong, not confirming that it works:

- **Filmstrip:** after the first full frame, nothing may appear, disappear, move or change state. A placeholder that becomes something else, or a panel that pops in, is a flash to fix.
- **Matrix:** text that wraps or is cut off, controls that change size between widths, things that don't line up, contrast that fails in the dark theme, and anything that looks like an unexamined default (design.md, "Question every default").
- **Phone:** the narrow notice reads well, nothing sits under the iPhone home indicator, and the site's menus work.

Then hand the evidence to a fresh design reviewer (design.md, step 7), and in the pull request say what was checked and what was found. Attach images only where a reviewer needs to see a visual change.
