# @mailquilt/react

The Mail Quilt email editor for React 19: `MailQuilt`, the editor, and `MailQuiltShell`, a whole editor page with Import, Export and saving in the browser.

```bash
npm install @mailquilt/react
```

```tsx
"use client";

import { MailQuilt } from "@mailquilt/react";
import type { MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";

export const Editor = ({ savedEmail }) => {
  const editor = useRef<MailQuiltElement>(null);
  const [email, setEmail] = useState(savedEmail);

  return (
    <>
      <MailQuilt
        onChange={setEmail}
        onError={({ reason }) => console.log(reason)}
        ref={editor}
        value={email}
      />
      <button onClick={async () => send(await editor.current?.exportHtml())}>
        Send
      </button>
    </>
  );
};
```

On the server it renders an empty `<mail-quilt>`, and the editor loads in the browser.

[Source and docs](https://github.com/yourcodebuddy-in/mailquilt) · MIT
