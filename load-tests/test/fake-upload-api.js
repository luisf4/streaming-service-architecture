const http = require("node:http");
const { randomUUID } = require("node:crypto");

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const url = req.url;
    if (req.method === "POST" && url === "/videos") {
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ videoId: randomUUID(), uploadId: randomUUID(), bucket: "raw", key: "x" }));
      return;
    }
    if (req.method === "POST" && /\/parts\/\d+\/presign$/.test(url)) {
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ url: `http://127.0.0.1:${PORT}/put-part` }));
      return;
    }
    if (req.method === "PUT" && url === "/put-part") {
      res.writeHead(200, { etag: '"fake-etag"' });
      res.end();
      return;
    }
    if (req.method === "POST" && url.endsWith("/complete")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: randomUUID(), status: "UPLOADED" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
});

const PORT = Number(process.argv[2] || 4000);
server.listen(PORT, () => console.log(`fake-upload-api on :${PORT}`));
