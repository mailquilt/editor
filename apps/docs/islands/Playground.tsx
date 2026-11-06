import { createEmail } from "@mailquilt/core";
import "@mailquilt/editor";
import type { MailQuilt } from "@mailquilt/editor";
import { useEffect, useRef, useState } from "react";

// The custom element needs a browser, so this island is never server-rendered.
export const client = "only";

declare module "react" {
  // oxlint-disable-next-line typescript/no-namespace -- React declares JSX as a namespace, so only a namespace can extend it.
  namespace JSX {
    interface IntrinsicElements {
      "mail-quilt": {
        ref?: React.Ref<MailQuilt>;
        value?: ReturnType<typeof createEmail>;
      };
    }
  }
}

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

const Playground = () => {
  const canvas = useRef<MailQuilt>(null);
  const [document, setDocument] = useState(createStarterEmail);
  const [html, setHtml] = useState("");

  useEffect(() => {
    const element = canvas.current;
    const onChange = (event: HTMLElementEventMap["mq-change"]) => {
      setDocument(event.detail.document);
    };
    element?.addEventListener("mq-change", onChange);
    return () => element?.removeEventListener("mq-change", onChange);
  }, []);

  const exportHtml = async () => {
    setHtml((await canvas.current?.exportHtml()) ?? "");
  };

  return (
    <div style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
      <mail-quilt ref={canvas} value={document} />
      <div>
        <button onClick={exportHtml} type="button">
          Export HTML
        </button>
      </div>
      {html && (
        <textarea aria-label="Exported HTML" readOnly rows={16} value={html} />
      )}
    </div>
  );
};

export default Playground;
