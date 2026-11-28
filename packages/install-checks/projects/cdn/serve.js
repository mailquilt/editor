import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const [root, port] = process.argv.slice(2);
const contentTypes = { ".html": "text/html", ".js": "text/javascript" };

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  try {
    const body = await readFile(file);
    // CDNs allow any origin, and module scripts need it from another origin.
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": contentTypes[path.extname(file)] ?? "text/plain",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(Number(port), "127.0.0.1");
