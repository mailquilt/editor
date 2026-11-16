// Mounts the React page's Shell example on a page of its own.
import { createRoot } from "react-dom/client";

import { EmailPage } from "../src/email-page";

const root = document.querySelector("#root");
if (root) {
  createRoot(root).render(<EmailPage />);
}
