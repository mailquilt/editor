import type { ComponentProps } from "react";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";

import { MailQuilt, MailQuiltShell } from "../../src/index.js";
import type {
  MailQuiltElement,
  MailQuiltShellElement,
  ShellAction,
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
  version: 4,
});

/** Gives each file the URL its name says. */
const uploadImage = (file: File) =>
  Promise.resolve({ url: `https://cdn.example/${file.name}` });

/** The Host app's Merge Tags. Each render gives a new list, as a host's often does. */
const mergeTags = () => [{ label: "First name", name: "first_name" }];

/** Texts in the Host app's words. Each render gives a new object, as a host's often does. */
const strings = () => ({ "topBar.undo": "Annuler" });

/** Where the Host app serves the Social Block's icons itself. */
const SOCIAL_ICONS_URL = "https://cdn.example/mail-icons/";

/** A newer version than this editor can read, so it's refused. */
const refusedEmail = { ...emailWith("Refused"), version: 999 };

const firstEmail = () =>
  new URLSearchParams(window.location.search).has("refused-first")
    ? refusedEmail
    : emailWith("Hello");

/** A host that leaves out `onError`. */
const noOnError = new URLSearchParams(window.location.search).has(
  "no-on-error"
);

/** A controlled host: every change goes into state and back into `value`. */
const Host = () => {
  const [document, setDocument] = useState(firstEmail);
  const [errors, setErrors] = useState<string[]>([]);
  const [changes, setChanges] = useState(0);
  const [shown, setShown] = useState(true);

  return (
    <main>
      <button onClick={() => setShown((now) => !now)} type="button">
        Toggle editor
      </button>
      <button onClick={() => setDocument(emailWith("Replaced"))} type="button">
        Replace email
      </button>
      <output data-testid="change-count">{changes}</output>
      <output data-testid="errors">{errors.join("\n")}</output>
      <output data-testid="latest-document">{JSON.stringify(document)}</output>
      {shown && (
        <MailQuilt
          aria-label="Newsletter"
          className="host-editor"
          // A new function each render, so the wrapper replaces its listener.
          onChange={(next) => {
            setDocument(next);
            setChanges((count) => count + 1);
          }}
          onError={
            noOnError
              ? undefined
              : (reason) => setErrors((all) => [...all, reason])
          }
          mergeTags={mergeTags()}
          socialIconsUrl={SOCIAL_ICONS_URL}
          strings={strings()}
          uploadImage={uploadImage}
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
  const [changed, setChanged] = useState(false);
  // The wrapper hands over the element only after it has set `value`.
  const attach = useCallback((element: MailQuiltShellElement | null) => {
    setReady(element !== null);
  }, []);
  const params = new URLSearchParams(window.location.search);
  let actions: ShellAction[] | undefined;
  let saveKey: string | undefined;
  if (changed) {
    actions = ["export-json"];
    saveKey = "react-test:other";
  } else if (params.has("only-html")) {
    actions = ["export-html"];
  } else if (params.has("no-actions")) {
    actions = [];
  }

  return (
    <main style={{ display: "grid", gridTemplateRows: "auto 700px" }}>
      <output data-testid="ready">{ready ? "yes" : "no"}</output>
      <button onClick={() => setChanged(true)} type="button">
        Change props
      </button>
      <MailQuiltShell
        actions={actions}
        aria-label="Newsletter"
        className="host-editor"
        heading={changed ? "Renamed" : "Campaign"}
        onChange={(next) => setDocument(next)}
        ref={attach}
        mergeTags={mergeTags()}
        saveKey={saveKey}
        socialIconsUrl={SOCIAL_ICONS_URL}
        strings={strings()}
        uploadImage={uploadImage}
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
  // As Next's and Vite's own starters render an app while it's being built.
  createRoot(root).render(
    params.has("strict") ? (
      <StrictMode>
        <Chosen />
      </StrictMode>
    ) : (
      <Chosen />
    )
  );
}
