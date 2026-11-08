import { createEditor, createEmail } from "@mailquilt/core";
import { MailQuiltShell } from "@mailquilt/react";

// The editor only does anything in a browser, so this island is never
// server-rendered.
export const client = "only";

// The key the Playground has always used, so visitors keep their saved emails.
// The prefix, because other apps on the same origin, such as other projects on
// localhost, share its localStorage.
const SAVED_EMAIL_KEY = "mailquilt:playground:email";

const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

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
      editor.apply({ blockId, props, type: "updateProps" });
    }
  }
  return editor.getDocument();
};

/** Made once, so a re-render can't hand the Shell a different email. */
const STARTER_EMAIL = createStarterEmail();

/**
 * The Advanced Shell where the editor always was, below the page's title. Its
 * height leaves room for the 4rem docs header and the space around it, so it
 * fits the window once scrolled to, and the email scrolls inside it. Never
 * shorter than the editor's own 600px and the Shell's 48px header, or the
 * Shell would scroll by a few pixels.
 */
const Playground = () => (
  // No side padding, so the editor lines up with the page's title.
  <div style={{ padding: "1rem 0" }}>
    <div
      style={{ height: "calc(100dvh - 6rem)", minHeight: "calc(600px + 48px)" }}
    >
      <MailQuiltShell
        saveKey={SAVED_EMAIL_KEY}
        value={STARTER_EMAIL}
        variant="advanced"
      />
    </div>
  </div>
);

export default Playground;
