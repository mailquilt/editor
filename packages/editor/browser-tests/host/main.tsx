import type { BlocksDocument } from "@mailquilt/core";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import "../../src/index.js";
import type { MailQuilt } from "../../src/index.js";
import { emailWith } from "./email.js";

declare module "react" {
  // oxlint-disable-next-line typescript/no-namespace -- React declares JSX as a namespace, so only a namespace can extend it.
  namespace JSX {
    interface IntrinsicElements {
      "mail-quilt": {
        ref?: React.Ref<MailQuilt>;
        value?: BlocksDocument;
      };
    }
  }
}

const initialDocument = emailWith([[["Hello"]]]);

/** A controlled host: every `mq-change` goes into state and back into `value`. */
const Host = () => {
  const canvas = useRef<MailQuilt>(null);
  const [document, setDocument] = useState(initialDocument);
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    const element = canvas.current;
    const onChange = (event: HTMLElementEventMap["mq-change"]) => {
      setDocument(event.detail.document);
      setChangeCount((count) => count + 1);
    };
    element?.addEventListener("mq-change", onChange);
    return () => element?.removeEventListener("mq-change", onChange);
  }, []);

  return (
    <main className="flex flex-col gap-4 p-8">
      <p data-testid="host-paragraph">Host page text</p>
      {/* Only for Tailwind's reset to style, as a host's own button. */}
      <button type="button">Host button</button>
      <output data-testid="change-count">{changeCount}</output>
      <output data-testid="latest-document">{JSON.stringify(document)}</output>
      <mail-quilt ref={canvas} value={document} />
    </main>
  );
};

const root = window.document.querySelector("#root");
if (root) {
  createRoot(root).render(<Host />);
}
