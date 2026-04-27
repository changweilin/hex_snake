const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const useDist = process.argv.includes("--dist");
const root = path.resolve(__dirname, useDist ? "dist" : ".");
const port = Number(process.env.PORT || 6287);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function resolveRequest(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.resolve(root, `.${requested}`);

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequest(req.url || "/");

  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, data, type);
  });
});

function getNetworkUrls() {
  const urls = [`http://localhost:${port}`];
  const interfaces = os.networkInterfaces();

  Object.values(interfaces).forEach(entries => {
    (entries || []).forEach(entry => {
      if (entry.family !== "IPv4" || entry.internal) return;
      urls.push(`http://${entry.address}:${port}`);
    });
  });

  return [...new Set(urls)];
}

server.listen(port, host, () => {
  console.log("Hex Snake dev server running:");
  getNetworkUrls().forEach(url => console.log(`  ${url}`));
  console.log(`Serving ${root}`);
  console.log(`Listening on ${host}:${port}`);
});
