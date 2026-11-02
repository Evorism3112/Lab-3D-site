// Starts the slicer wrapper (deploy/slicer/api, maziggy/orca-slicer-api) for Bambuddy. The wrapper
// listens on every interface; only Bambuddy on this machine needs it, so its server is bound to
// loopback. Settings come from the environment start.ps1 sets (PORT, ORCASLICER_PATH, DATA_PATH).
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (port, ...rest) {
  // The wrapper logs nothing for a good slice, so every request is written to slicer.log: that is
  // how one sees Bambuddy really sent a slice here. Health checks and progress polls are skipped.
  this.on("request", (req, res) => {
    // Express has already rewritten req.url for its mounted routers ("/health" -> "/") by the time
    // this listener runs; originalUrl keeps what was asked for.
    const url = req.originalUrl ?? req.url ?? "";
    if (req.method === "GET" && /^\/(health|slice\/progress)/.test(url)) return;
    const started = Date.now();
    res.on("close", () => {
      const took = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${new Date().toISOString()} ${req.method} ${url} ${res.statusCode} ${took}s`);
    });
  });
  // Express calls listen(port, callback).
  return listen.call(this, port, "127.0.0.1", ...rest.filter((arg) => typeof arg === "function"));
};

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "slicer", "api", "dist", "src", "index.js");
await import(pathToFileURL(entry).href);
