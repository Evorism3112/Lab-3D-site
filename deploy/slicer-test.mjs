// End-to-end check of the slicer the way the site uses it (lib/slicing.ts): the slicer wrapper,
// the Bambuddy key and slicer settings, the presets chosen in the site admin, then a real slice
// of a 20 mm cube through Bambuddy. Usage: node deploy/slicer-test.mjs (env from .env.production).
// Prints the steps for the Lab3D.exe journal and saves the outcome to deploy/slicer/last-test.json.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const deployDir = path.dirname(fileURLToPath(import.meta.url));
const resultFile = path.join(deployDir, "slicer", "last-test.json");
const slicerPort = Number(process.env.SLICER_PORT || 3003);
const bambuddy = (process.env.BAMBUDDY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const apiKey = process.env.BAMBUDDY_API_KEY;
const LIBRARY_FOLDER = "Расчёт цены (сайт)";

const step = (text) => console.log(`\n${text}`);
const ok = (text) => console.log(`  √ ${text}`);
const warn = (text) => console.log(`  ! ${text}`);

async function save(result) {
  await fs.mkdir(path.dirname(resultFile), { recursive: true });
  await fs.writeFile(resultFile, JSON.stringify({ at: new Date().toISOString(), ...result }));
}

async function fail(text) {
  console.log(`  × ${text}`);
  await save({ ok: false, error: text });
  process.exit(1);
}

async function call(pathname, init = {}, timeoutMs = 15_000) {
  const res = await fetch(`${bambuddy}/api/v1${pathname}`, {
    ...init,
    headers: { "X-API-Key": apiKey, ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => {
    throw new Error(`Bambuddy недоступен (${bambuddy}): ${err.message}`);
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : res.statusText;
    throw new Error(`${init.method ?? "GET"} ${pathname}: ${res.status} ${detail}`);
  }
  return res.json();
}

/** Binary STL of a 20 × 20 × 20 mm cube (8 cm³). */
function cubeStl() {
  const v = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const buf = Buffer.alloc(84 + faces.length * 50);
  buf.writeUInt32LE(faces.length, 80);
  let offset = 84;
  for (const face of faces) {
    offset += 12;
    for (const i of face) for (const c of v[i]) { buf.writeFloatLE(c, offset); offset += 4; }
    offset += 2;
  }
  return buf;
}

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};

// 1. The wrapper started by the server (start.ps1).
step(`1. Слайсер на 127.0.0.1:${slicerPort}`);
const health = await fetch(`http://127.0.0.1:${slicerPort}/health`, { signal: AbortSignal.timeout(15_000) })
  .then((r) => r.json())
  .catch(() => null);
if (!health) await fail("Не отвечает. Запущен ли сервер? Подробности - в логе слайсера.");
if (!health.checks?.orcaslicer?.available) await fail(`OrcaSlicer не запускается: ${health.checks?.orcaslicer?.error ?? "нет подробностей"}`);
if (!health.checks?.dataPath?.accessible) await fail(`Нет доступа к папке данных слайсера: ${health.checks?.dataPath?.error ?? ""}`);
ok("отвечает, OrcaSlicer найден");

// 2. Bambuddy: the key and which slicer it sends slices to.
step("2. Bambuddy");
if (!apiKey) await fail("Ключ API Bambuddy не задан - сохраните его на вкладке «Принтеры».");
let settings;
try {
  settings = await call("/settings");
} catch (err) {
  await fail(`${err.message}. У ключа должно быть включено «Read status».`);
}
if (settings.preferred_slicer !== "orcaslicer") {
  await fail("В Bambuddy выбран не OrcaSlicer: Настройки -> Очередь -> «Слайсер» -> Предпочитаемый слайсер: OrcaSlicer.");
}
const sidecarUrl = (settings.orcaslicer_api_url || "").replace(/\/$/, "");
if (sidecarUrl && !/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(sidecarUrl)) warn(`адрес слайсера в Bambuddy: ${sidecarUrl}`);
else if (sidecarUrl && !sidecarUrl.endsWith(`:${slicerPort}`)) await fail(`В Bambuddy адрес слайсера ${sidecarUrl}, а нужен http://127.0.0.1:${slicerPort}.`);
if (!settings.use_slicer_api) warn("«Использовать API слайсера» выключено: сайту это не мешает, но в самом Bambuddy кнопки «Нарезать» не будет.");
ok(`режет через OrcaSlicer (${sidecarUrl || `http://localhost:${slicerPort}`})`);

// 3. Presets: the ones chosen in the site admin, otherwise a common Bambu Lab set.
step("3. Профили");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const chosen = {};
try {
  await db.connect();
  const rows = (await db.query(`select key, value from "Setting" where key in ('slicer.printerPreset', 'slicer.processPreset')`)).rows;
  for (const row of rows) {
    try {
      chosen[row.key] = JSON.parse(row.value);
    } catch {
      // Not set.
    }
  }
} catch (err) {
  warn(`база сайта недоступна (${err.message}) - беру профили сами`);
} finally {
  await db.end().catch(() => {});
}
let presets;
try {
  presets = await call("/slicer/presets", {}, 60_000);
} catch (err) {
  await fail(err.message);
}
const all = (slot) => ["local", "orca_cloud", "cloud", "standard"].flatMap((tier) => presets[tier]?.[slot] ?? []);
const suffixOf = (name) => name.match(/@[^@]+$/)?.[0]?.trim() ?? null;
let printer = chosen["slicer.printerPreset"];
let processPreset = chosen["slicer.processPreset"];
if (printer && processPreset) ok("из админки сайта (Цены -> «Точная цена через слайсер»)");
else {
  warn("в админке сайта профили не выбраны - беру стандартные для проверки");
  processPreset = all("process").find((p) => /0\.20mm Standard @BBL X1C$/.test(p.name)) ?? all("process").find((p) => /0\.20mm Standard/.test(p.name)) ?? all("process")[0];
  printer = all("printer").find((p) => /X1 Carbon 0\.4/.test(p.name)) ?? all("printer")[0];
}
if (!printer || !processPreset) await fail("Bambuddy не вернул ни одного профиля принтера или процесса.");
const suffix = suffixOf(processPreset.name);
const plas = all("filament").filter((p) => (p.filament_type ?? "").toUpperCase() === "PLA" && (!suffix || p.name.endsWith(suffix)));
const filament = plas.find((p) => /generic/i.test(p.name)) ?? plas[0] ?? all("filament")[0];
if (!filament) await fail("Bambuddy не вернул ни одного профиля пластика.");
console.log(`    принтер: ${printer.name}\n    процесс: ${processPreset.name}\n    пластик: ${filament.name}`);

// 4. A real slice through Bambuddy, cleaned up afterwards like the site does.
step("4. Нарезка тестового кубика 20 мм");
const libraryFiles = [];
const ref = (p) => ({ source: p.source, id: p.id });
try {
  const folders = await call("/library/folders");
  let folder = folders.find((f) => f.name === LIBRARY_FOLDER && f.parent_id === null);
  if (!folder) {
    folder = await call("/library/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: LIBRARY_FOLDER }),
    });
  }
  const form = new FormData();
  form.append("file", new Blob([cubeStl()]), "slicer-test-cube.stl");
  const uploaded = await call(`/library/files?folder_id=${folder.id}&generate_stl_thumbnails=false`, { method: "POST", body: form }, 60_000).catch(
    (err) => {
      throw new Error(`${err.message}. У ключа должно быть включено «Manage library».`);
    },
  );
  libraryFiles.push(uploaded.id);
  const started = Date.now();
  const job = await call(
    `/library/files/${uploaded.id}/slice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printer_preset: ref(printer),
        process_preset: ref(processPreset),
        filament_preset: ref(filament),
        process_overrides: { sparse_infill_density: "15%" },
        auto_arrange: true,
      }),
    },
    60_000,
  );
  let lastPhase = "";
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await call(`/slice-jobs/${job.job_id}`);
    if (status.status === "completed") {
      const { library_file_id, print_time_seconds, filament_used_g } = status.result;
      libraryFiles.push(library_file_id);
      const took = Math.round((Date.now() - started) / 1000);
      ok(`нарезано за ${took} с: печать ${formatTime(print_time_seconds)}, пластик ${filament_used_g.toFixed(1)} г`);
      await save({ ok: true, seconds: print_time_seconds, grams: filament_used_g, took, printer: printer.name, process: processPreset.name, filament: filament.name });
      break;
    }
    if (status.status === "failed") throw new Error(status.error_detail ?? "Нарезка не удалась");
    // Live percent needs a progress pipe the wrapper can't open on Windows, so only the phase is shown.
    const phase = status.status === "pending" ? "в очереди Bambuddy..." : "режет...";
    if (phase !== lastPhase) console.log(`    ${phase}`);
    lastPhase = phase;
    if (Date.now() - started > 10 * 60_000) throw new Error("Нарезка не закончилась за 10 минут");
  }
} catch (err) {
  for (const id of libraryFiles) await call(`/library/files/${id}`, { method: "DELETE" }).catch(() => {});
  await fail(err.message);
}

step("5. Уборка");
for (const id of libraryFiles) {
  await call(`/library/files/${id}`, { method: "DELETE" }).catch((err) => warn(`не удалось удалить файл ${id}: ${err.message}`));
}
ok("файлы проверки удалены из библиотеки Bambuddy");
console.log("\nСлайсер работает: сайт сможет считать точную цену.");
