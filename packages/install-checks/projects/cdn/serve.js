import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [root, port] = process.argv.slice(2);
const contentTypes = { ".html": "text/html", ".js": "text/javascript" };

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const file = path.join(root, pathname === "/" ? "index.html" : pathname);
  createReadStream(file)
    .on("error", () => response.writeHead(404).end())
    .on("open", () => {
      // CDNs allow any origin, and module scripts need it from another origin.
      response.writeHead(200, {
        "access-control-allow-origin": "*",
        "content-type": contentTypes[path.extname(file)] ?? "text/plain",
      });
    })
    .pipe(response);
}).listen(Number(port));
