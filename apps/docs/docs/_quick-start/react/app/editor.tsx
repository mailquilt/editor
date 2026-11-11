"use client";

import { MailQuilt } from "@mailquilt/react";
import type { BlocksDocument, MailQuiltElement } from "@mailquilt/react";
import { useRef, useState } from "react";

import { starterEmail } from "./starter-email";

/** Nothing on the page shows the email until the browser has it, so this can't mismatch. */
const savedEmail = (): BlocksDocument | undefined => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const saved = localStorage.getItem("email");
    return saved ? JSON.parse(saved) : starterEmail;
  } catch {
    // Storage is blocked, or what's saved isn't JSON.
    return starterEmail;
  }
};

export const Editor = () => {
  const editor = useRef<MailQuiltElement>(null);
  const [email, setEmail] = useState(savedEmail);
  const [html, setHtml] = useState("");
  const [loadError, setLoadError] = useState("");

  return (
    <main>
      <MailQuilt
        onChange={(next) => {
          setEmail(next);
          localStorage.setItem("email", JSON.stringify(next));
        }}
        onError={({ reason }) => setLoadError(reason)}
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
      <output id="exported-html">{html}</output>
      <output id="load-error">{loadError}</output>
    </main>
  );
};
