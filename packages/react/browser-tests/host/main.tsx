import type { ComponentProps } from "react";
import { useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { MailQuilt, MailQuiltShell } from "../../src/index.js";
import type {
  MailQuiltElement,
  MailQuiltShellElement,
} from "../../src/index.js";

type Document = NonNullable<ComponentProps<typeof MailQuilt>["value"]>;

const emailWith = (text: string): Document => ({
  kind: "blocks",
  rows: [
    {
      columns: [
        {
          blocks: [
            {
              id: "block-1",
              props: {
                content: {
                  content: [
                    { content: [{ text, type: "text" }], type: "paragraph" },
                  ],
                  type: "doc",
                },
              },
              type: "text",
            },
          ],
          id: "column-1",
          props: {},
          width: 100,
        },
      ],
      id: "row-1",
      props: {},
    },
  ],
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 1,
});

/** A newer version than this editor can read, so it's refused. */
const refusedEmail = { ...emailWith("Refused"), version: 999 };

const firstEmail = () =>
  new URLSearchParams(window.location.search).has("refused-first")
    ? refusedEmail
    : emailWith("Hello");

/** A controlled host: every change goes into state and back into `value`. */
const Host = () => {
  const [document, setDocument] = useState(firstEmail);
  const [errors, setErrors] = useState<string[]>([]);
  const [renderCount, setRenderCount] = useState(0);
  const [html, setHtml] = useState("");
  const [shown, setShown] = useState(true);
  const editor = useRef<MailQuiltElement>(null);

  return (
    <main>
      <button
        onClick={() => setRenderCount((count) => count + 1)}
        type="button"
      >
        Re-render host
      </button>
      <button
        onClick={async () =>
          setHtml((await editor.current?.exportHtml()) ?? "")
        }
        type="button"
      >
        Export HTML
      </button>
      <button onClick={() => setShown((now) => !now)} type="button">
        Toggle editor
      </button>
      <output data-testid="html">{html}</output>
      <output data-testid="render-count">{renderCount}</output>
      <output data-testid="errors">{errors.join("\n")}</output>
      <output data-testid="latest-document">{JSON.stringify(document)}</output>
      {shown && (
        <MailQuilt
          aria-label="Newsletter"
          className="host-editor"
          onChange={(next) => setDocument(next)}
          onError={({ reason }) => setErrors((all) => [...all, reason])}
          ref={editor}
          value={document}
        />
      )}
    </main>
  );
};

const callbackRefEmail = emailWith("Hello");

const describeRefCall = (element: MailQuiltElement | null) => {
  if (!element) {
    return "null";
  }
  return element.value ? "email" : "no email";
};

/** Writes down each thing its callback ref is given, and when it's cleaned up. */
const CallbackRefHost = () => {
  const [calls, setCalls] = useState<string[]>([]);
  const [shown, setShown] = useState(true);
  const record = useCallback((element: MailQuiltElement | null) => {
    setCalls((all) => [...all, describeRefCall(element)]);
    return () => setCalls((all) => [...all, "cleanup"]);
  }, []);

  return (
    <main>
      <button onClick={() => setShown((now) => !now)} type="button">
        Toggle editor
      </button>
      <output data-testid="ref-calls">{calls.join(", ")}</output>
      {shown && <MailQuilt ref={record} value={callbackRefEmail} />}
    </main>
  );
};

/** A controlled host of the Shell. */
const ShellHost = () => {
  const [document, setDocument] = useState(firstEmail);
  const [ready, setReady] = useState(false);
  // The wrapper hands over the element only after it has set `value`.
  const attach = useCallback((element: MailQuiltShellElement | null) => {
    setReady(element !== null);
  }, []);
  const params = new URLSearchParams(window.location.search);
  const save = params.has("save");

  return (
    <main style={{ display: "grid", gridTemplateRows: "auto 700px" }}>
      <output data-testid="ready">{ready ? "yes" : "no"}</output>
      <MailQuiltShell
        actions={params.has("only-html") ? ["export-html"] : undefined}
        aria-label="Newsletter"
        className="host-editor"
        heading="Campaign"
        onChange={(next) => setDocument(next)}
        ref={attach}
        saveKey={save ? "react-test:email" : undefined}
        value={document}
      />
    </main>
  );
};

const hosts = { "callback-ref": CallbackRefHost, shell: ShellHost };
const params = new URLSearchParams(window.location.search);
const Chosen =
  Object.entries(hosts).find(([name]) => params.has(name))?.[1] ?? Host;

const root = window.document.querySelector("#root");
if (root) {
  createRoot(root).render(<Chosen />);
}
