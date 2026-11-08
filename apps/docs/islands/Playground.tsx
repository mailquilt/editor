import { createEmail, loadDocument } from "@mailquilt/core";
import type { LoadResult } from "@mailquilt/core";
import { MailQuilt } from "@mailquilt/react";
import type { BlocksDocument, MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

// The editor only does anything in a browser, so this island is never
// server-rendered.
export const client = "only";

// The prefix, because other apps on the same origin, such as other projects on
// localhost, share its localStorage.
const SAVED_EMAIL_KEY = "mailquilt:playground:email";

const createStarterEmail = () => {
  const email = createEmail();
  const block = email.rows[0]?.columns[0]?.blocks[0];
  if (block) {
    block.props = {
      content: {
        content: [
          {
            content: [{ text: "Hi {{first_name}}, type here.", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
    };
  }
  return email;
};

/** Never throws, as what it reads may have been damaged or edited by hand. */
const parseEmail = (text: string): LoadResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Not valid JSON" };
  }
  return loadDocument(parsed);
};

const CANT_SAVE =
  "This browser can't save your email here. Export it as JSON to keep it.";

/** The email to open, and what the person should know about it. */
const openSavedEmail = (): {
  cantSave?: boolean;
  document: BlocksDocument;
  notice?: string;
} => {
  let saved: string | null;
  try {
    saved = localStorage.getItem(SAVED_EMAIL_KEY);
  } catch {
    return { cantSave: true, document: createStarterEmail() };
  }
  if (saved === null) {
    return { document: createStarterEmail() };
  }
  const loaded = parseEmail(saved);
  return loaded.ok
    ? { document: loaded.document }
    : {
        document: createStarterEmail(),
        notice: `Your saved email couldn't be opened: ${loaded.reason}`,
      };
};

/** Returns whether it saved. */
const saveEmail = (document: BlocksDocument) => {
  try {
    localStorage.setItem(SAVED_EMAIL_KEY, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
};

const downloadFile = (name: string, type: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
  // Later, because a browser may still be starting the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const Playground = () => {
  const canvas = useRef<MailQuiltElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(openSavedEmail);
  const { cantSave, document, notice } = email;

  // Saved here, not in an effect, so that opening the Playground can't replace
  // a saved email it refused before the person has changed anything.
  const keepEmail = (next: BlocksDocument) => {
    setEmail({ cantSave: !saveEmail(next), document: next });
  };

  const showNotice = (next?: string) => {
    setEmail((current) => ({ ...current, notice: next }));
  };

  const exportJson = () => {
    downloadFile(
      "email.json",
      "application/json",
      JSON.stringify(document, null, 2)
    );
  };

  const exportHtml = async () => {
    try {
      const html = await canvas.current?.exportHtml();
      if (html !== undefined) {
        downloadFile("email.html", "text/html", html);
        showNotice();
      }
    } catch (error) {
      showNotice(`The HTML couldn't be exported: ${String(error)}`);
    }
  };

  const importJson = async ({
    currentTarget,
  }: ChangeEvent<HTMLInputElement>) => {
    const file = currentTarget.files?.[0];
    // So that choosing the same file again, once it's fixed, is reported too.
    currentTarget.value = "";
    if (!file) {
      return;
    }
    let loaded: LoadResult;
    try {
      loaded = parseEmail(await file.text());
    } catch {
      loaded = { ok: false, reason: "The file couldn't be read" };
    }
    if (loaded.ok) {
      keepEmail(loaded.document);
    } else {
      showNotice(`That file couldn't be imported: ${loaded.reason}`);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
      {cantSave && <p role="alert">{CANT_SAVE}</p>}
      {notice && <p role="alert">{notice}</p>}
      <MailQuilt onChange={keepEmail} ref={canvas} value={document} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button onClick={exportHtml} type="button">
          Export HTML
        </button>
        <button onClick={exportJson} type="button">
          Export JSON
        </button>
        <button onClick={() => fileInput.current?.click()} type="button">
          Import JSON
        </button>
        <input
          accept=".json,application/json"
          hidden
          onChange={importJson}
          ref={fileInput}
          type="file"
        />
      </div>
    </div>
  );
};

export default Playground;
