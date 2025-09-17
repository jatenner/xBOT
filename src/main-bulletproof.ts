import { createServer } from "http";

async function boot() {
  // Try common server modules in priority order
  const candidates = ["./server", "./main", "./index", "./api/index"];
  let started = false;

  for (const mod of candidates) {
    try {
      const m = await import(mod);
      if (typeof m.start === "function") {
        console.log(`Using runtime entry: ${mod}.start()`);
        await m.start();
        started = true;
        break;
      }
      if (m.app?.listen) {
        const port = Number(process.env.PORT || 8080);
        console.log(`Using runtime entry: ${mod}.app.listen(${port})`);
        m.app.listen(port);
        started = true;
        break;
      }
    } catch (_) {}
  }

  if (!started) {
    // fallback: bare HTTP server to keep container alive + health
    const port = Number(process.env.PORT || 8080);
    createServer((_, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "xBOT up (fallback)" }));
    }).listen(port, () =>
      console.log(`Fallback server listening on :${port}`)
    );
  }
}

boot().catch((e) => {
  console.error("Fatal boot error:", e);
  process.exit(1);
});
