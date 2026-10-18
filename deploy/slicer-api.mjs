// Starts the slicer wrapper (deploy/slicer/api, maziggy/orca-slicer-api) for Bambuddy. The wrapper
// listens on every interface; only Bambuddy on this machine needs it, so its server is bound to
// loopback. Settings come from the environment start.ps1 sets (PORT, ORCASLICER_PATH, DATA_PATH).
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (port, ...rest) {
  // Express calls listen(port, callback).
  return listen.call(this, port, "127.0.0.1", ...rest.filter((arg) => typeof arg === "function"));
};

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "slicer", "api", "dist", "src", "index.js");
await import(pathToFileURL(entry).href);
