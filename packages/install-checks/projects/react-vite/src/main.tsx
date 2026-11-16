// Mounts the React page's editor, as a Vite React app's own main.tsx does.
import { createRoot } from "react-dom/client";

import { Editor } from "./editor";

const root = document.querySelector("#root");
if (root) {
  createRoot(root).render(<Editor />);
}
