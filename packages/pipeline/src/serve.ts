import fs from "node:fs";
import http from "node:http";
import path from "node:path";

// Minimal static file server with Range support: how the renderer fetches
// the proxy footage (OffthreadVideo needs byte-range requests).
export const serveDir = (dir: string): Promise<{ url: string; close: () => void }> =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url ?? "/").split("?")[0]!.replace(/^\/+/, ""));
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const size = fs.statSync(file).size;
      const type = file.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
      const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
      if (range) {
        const start = range[1] ? parseInt(range[1], 10) : 0;
        const end = range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Type": type,
        });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": size,
          "Content-Type": type,
          "Accept-Ranges": "bytes",
        });
        fs.createReadStream(file).pipe(res);
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
