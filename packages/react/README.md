# @mailquilt/react

The Mail Quilt email editor for React 19: `MailQuilt`, the editor, and `MailQuiltShell`, a whole editor page with Import, Export and saving in the browser.

[![Building an email in the Mail Quilt editor: changing the heading, dragging in a two-column Row, typing in each Column and changing the button's color](https://editor.mailquilt.com/editor-demo.gif)](https://editor.mailquilt.com/playground)

```bash
npm install @mailquilt/react
```

```tsx
"use client";

import { MailQuilt } from "@mailquilt/react";
import type { BlocksDocument, MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";

interface EditorProps {
  savedEmail: BlocksDocument;
  send: (html: string | undefined) => void;
}

export const Editor = ({ savedEmail, send }: EditorProps) => {
  const editor = useRef<MailQuiltElement>(null);
  const [email, setEmail] = useState(savedEmail);

  return (
    <>
      <MailQuilt
        onChange={setEmail}
        onError={(reason) => console.log(reason)}
        ref={editor}
        value={email}
      />
      <button
        type="button"
        onClick={async () => send(await editor.current?.exportHtml())}
      >
        Send
      </button>
    </>
  );
};
```

Pass the email you saved for this person, or `createEmail()` for a new one, from `@mailquilt/core`, which you install too: `npm install @mailquilt/core`. Without an email, the editor is empty.

On the server it renders an empty `<mail-quilt>`, and the editor loads in the browser.

[Docs](https://editor.mailquilt.com/docs/react) · [Playground](https://editor.mailquilt.com/playground) · [Source](https://github.com/mailquilt/editor) · MIT
