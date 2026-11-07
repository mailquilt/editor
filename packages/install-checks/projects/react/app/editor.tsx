"use client";

import { MailQuilt } from "@mailquilt/react";
import type { BlocksDocument, MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";

const starterEmail: BlocksDocument = {
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
                    {
                      content: [{ text: "Hello", type: "text" }],
                      type: "paragraph",
                    },
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
};

/** Nothing on the page shows the email until the browser has it, so this can't mismatch. */
const savedEmail = (): BlocksDocument | undefined => {
  if (typeof window === "undefined") {
    return;
  }
  const saved = localStorage.getItem("email");
  return saved ? JSON.parse(saved) : starterEmail;
};

export const Editor = () => {
  const editor = useRef<MailQuiltElement>(null);
  const [email, setEmail] = useState(savedEmail);
  const [html, setHtml] = useState("");

  return (
    <main>
      <MailQuilt
        onChange={(next) => {
          localStorage.setItem("email", JSON.stringify(next));
          setEmail(next);
        }}
        ref={editor}
        value={email}
      />
      <button
        onClick={async () =>
          setHtml((await editor.current?.exportHtml()) ?? "")
        }
        type="button"
      >
        Export HTML
      </button>
      <output data-testid="exported-html">{html}</output>
    </main>
  );
};
