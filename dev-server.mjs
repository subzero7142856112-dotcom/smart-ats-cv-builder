/**
 * dev-server.mjs — Local API server for development.
 * Run with:  node --env-file=.env dev-server.mjs
 * Vite proxies /api/* here automatically (see vite.config.js).
 */
import http from "node:http";

const handlers = {};
const files = [
  "improve-summary",
  "improve-bullets",
  "generate-bullets",
  "analyze-job-description",
  "ats-score",
  "generate-cover-letter",
];

for (const name of files) {
  const mod = await import(`./api/${name}.js`);
  handlers[name] = mod.default;
}

function adapt(req, res) {
  // Add Vercel-style .status() and .json() to Node's raw res
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
}

const server = http.createServer(async (req, res) => {
  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const route = (req.url || "").replace(/^\/api\//, "").replace(/\?.*$/, "");
  const handler = handlers[route];

  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  adapt(req, res);

  try {
    await handler(req, res);
  } catch (err) {
    console.error("[API error]", err);
    if (!res.writableEnded) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✓ API server running on http://localhost:${PORT}`);
  console.log(`  Routes: ${files.map((f) => `/api/${f}`).join(", ")}`);
});
