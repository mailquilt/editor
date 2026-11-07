import { createEmail } from "@mailquilt/core";
import { MailQuilt } from "@mailquilt/react";
import type { MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";

// The editor only does anything in a browser, so this island is never
// server-rendered.
export const client = "only";

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
  const canvas = useRef<MailQuiltElement>(null);
  const [document, setDocument] = useState(createStarterEmail);
  const [html, setHtml] = useState("");

  const exportHtml = async () => {
    setHtml((await canvas.current?.exportHtml()) ?? "");
  };

  return (
    <div style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
      <MailQuilt onChange={setDocument} ref={canvas} value={document} />
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
