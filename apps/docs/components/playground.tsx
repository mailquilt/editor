import { createEditor, createEmail } from "@mailquilt/core";
import { MailQuiltShell } from "@mailquilt/react";
import { useState } from "react";
import type { CSSProperties } from "react";

import { accentTokens } from "../site/editor-facts";
import { paragraph } from "../site/rich-text";

// Prefixed, because other apps on the same origin, such as other projects on
// localhost, share its localStorage.
const SAVED_EMAIL_KEY = "mailquilt:playground:email";

/**
 * A Heading, a Text Block and a Button, each in its own Row, so that moving a
 * Row can be tried straight away. Made with Commands, as a person would.
 */
const createStarterEmail = () => {
  const editor = createEditor({ document: createEmail() });
  const textId = editor.getDocument().rows[0]?.columns[0]?.blocks[0]?.id;
  const heading = editor.apply({
    blockType: "heading",
    rowIndex: 0,
    type: "insertBlockInNewRow",
  });
  const button = editor.apply({
    blockType: "button",
    rowIndex: 2,
    type: "insertBlockInNewRow",
  });
  const changes: [string | undefined, Record<string, unknown>][] = [
    [
      heading.ok ? heading.createdId : undefined,
      { content: paragraph("Welcome") },
    ],
    [textId, { content: paragraph("Hi {{first_name}}, type here.") }],
    [button.ok ? button.createdId : undefined, { label: "Get started" }],
  ];
  for (const [blockId, props] of changes) {
    if (blockId !== undefined) {
      editor.apply({ blockId, props, type: "updateBlockProps" });
    }
  }
  return editor.getDocument();
};

/** Made once, so a re-render can't hand the Shell a different email. */
const STARTER_EMAIL = createStarterEmail();

/**
 * A few Google Fonts, as a Host app would offer its brand's, each falling back
 * to a system font of the same kind.
 */
const PLAYGROUND_FONTS = [
  {
    fallback: "Georgia, 'Times New Roman', serif",
    name: "DM Serif Display",
    url: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap",
  },
  {
    fallback: "Georgia, 'Times New Roman', serif",
    name: "Fraunces",
    url: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&display=swap",
  },
  {
    fallback: "Arial, Helvetica, sans-serif",
    name: "Inter",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
  },
];

/**
 * The site's own editor wears the site's color, set with theme tokens. React's
 * types name no custom properties, which it sets as they are.
 */
const SITE_ACCENT = accentTokens(
  "var(--site-accent)",
  "var(--site-accent-hover)"
) as CSSProperties;

/**
 * The Shell where the editor always was, below the page's title, or why it
 * isn't there.
 */
const Playground = () => {
  const [failed, setFailed] = useState<string>();
  // The Shell shows an email it refused itself. Only the editor's code failing
  // to load leaves it undefined, and an empty box with nothing to say.
  const reportFailedLoad = (reason: string) => {
    if (!customElements.get("mail-quilt-shell")) {
      setFailed(reason);
    }
  };
  return failed === undefined ? (
    // No side padding, so the editor lines up with the page's title.
    <div className="playground">
      <div className="playground-shell">
        <MailQuiltShell
          fonts={PLAYGROUND_FONTS}
          heading="Your email"
          onError={reportFailedLoad}
          saveKey={SAVED_EMAIL_KEY}
          style={SITE_ACCENT}
          value={STARTER_EMAIL}
        />
      </div>
    </div>
  ) : (
    <div className="playground-failed" role="alert">
      <p>The Playground couldn&apos;t start. Reload the page to try again.</p>
      <p className="site-small site-muted">{failed}</p>
    </div>
  );
};

export default Playground;
