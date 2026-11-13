# @mailquilt/react

The Mail Quilt email editor for React 19: `MailQuilt`, the editor, and `MailQuiltShell`, a whole editor page with Import, Export and saving in the browser.

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

Pass the email you saved for this person, or `createEmail()` from `@mailquilt/core` for a new one. Without an email, the editor is empty.

On the server it renders an empty `<mail-quilt>`, and the editor loads in the browser.

[Docs](https://editor.mailquilt.com/docs/quick-start#react) · [Source](https://github.com/mailquilt/editor) · MIT
