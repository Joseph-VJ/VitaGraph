const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distDir = path.join(__dirname, "dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || reqPath.startsWith("/gallery")) reqPath = "/index.html";
  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(path.join(distDir, "index.html")).pipe(res);
  }
});

server.listen(5189, () => {
  console.log("Server running on http://localhost:5189");
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const outputPath = path.join(__dirname, "gallery_screenshot.png");
  const cmd = `"${edgePath}" --headless=new --disable-gpu --no-sandbox --disable-background-networking --disable-sync --disable-extensions --virtual-time-budget=2000 --window-size=1440,3200 --screenshot="${outputPath}" "http://localhost:5189/gallery"`;
  try {
    execSync(cmd, { timeout: 15000 });
    console.log("Screenshot captured successfully at:", outputPath);
  } catch (err) {
    console.error("Capture result/error:", err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});
