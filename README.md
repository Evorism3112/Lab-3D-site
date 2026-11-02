# Лаборатория 3Д — Order Platform

Instant-quote 3D printing order site for [lab-3d.pro](https://lab-3d.pro): the customer uploads an
STL/OBJ file, picks material, color, finish, scale and infill, sees the price right away and places
the order. Orders are handed to **lab** — the in-house CRM in `lab/` — where they are produced and
shipped. Bilingual UI (RU/EN) via a cookie-based locale switcher. The JSON API under `app/api` powers
the frontend and can be used by other systems too.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4) — see `AGENTS.md`: this Next.js version has
  breaking changes, check `node_modules/next/dist/docs/` before writing code
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter, config in `prisma7.config.ts`)
- Auth.js (NextAuth v5, credentials provider) for the admin panel
- `@react-three/fiber` + `three` for the in-browser 3D preview
- Custom STL/OBJ parsers (`lib/geometry`) for volume/bounding-box calculation — no native deps
- Optional: [Bambuddy](https://github.com/maziggy/bambuddy) + OrcaSlicer for exact slicer-based
  prices and the printer/filament catalog; DaData for Russian address suggestions
- Stripe Checkout is wired in but **not used right now** (see *Payment* below)

## How an order flows

1. `/order/upload` — the file is uploaded (`POST /api/files`), parsed, its volume and size stored.
   `/order/sample` ("try it on an example") skips the upload and opens step 2 with a bundled sample model.
2. `/order/configure/[fileId]` — material / color / finish / quantity / scale / infill; the price comes
   from `POST /api/quote`.
3. `/order/checkout` — contacts and delivery (address suggestions, delivery price from lab:
   `POST /api/delivery/quote`), then `POST /api/orders`.
4. The order is saved and pushed to lab right away (`lib/labClient.ts`); the customer lands on
   `/order/thank-you`. Order tracking and production happen in lab, not on this site.

`/order/request` is a separate form for "model it for me" requests (description + photos).

### Pricing

Prices come **only from the slicer** (`lib/slicing.ts`): the model is sliced by OrcaSlicer through
Bambuddy with the admin's presets, and `lib/pricing/engine.ts` (pure function) turns its print time
and grams into a price — hours × hourly rate + plastic × spool price (with markup), finish multiplier,
setup fee, minimum price. Rates are set in `/admin/pricing`. Slicing takes seconds to minutes: the
configurator shows "calculating" and polls; the customer then sees the price and plastic weight, both
marked approximate (`≈`). A model the slicer can't price (doesn't fit, Bambuddy down, no preset) is
still ordered, **without a price** (`priceOnRequest`, 0 ₽): staff agree it with the customer, lead
time 2 days. Results are cached per model + settings in `SliceEstimate`.
  `/admin/pricing` → slicer has a slice log (latest quotes and test cubes, with the slicer named in each
  sliced file) and a “Test slice” button that slices a 20 mm cube the same way.

### Payment

Payment is currently **disabled**: checkout creates the order and sends it to lab, payment is
arranged there. The Stripe code (`/api/checkout/session`, `/api/webhooks/stripe`, `lib/stripe.ts`)
is kept, but prices are in rubles, which Stripe does not offer to most Russian accounts — a Russian
payment provider is needed before turning online payment on.

## Getting started

```bash
npm install

# start a local Postgres instance (Prisma's bundled dev server)
npx prisma dev -d -n formnow

# apply the schema and seed materials + an admin user
npx prisma migrate dev
npx prisma db seed

npm run dev
```

Open http://localhost:3000. Seeded dev admin login (for `/admin`): `admin` / `admin` (override with
`ADMIN_EMAIL` / `ADMIN_PASSWORD` when seeding; in production the seed refuses `admin` or a password
shorter than 8 characters, and leaves an existing admin alone if no password is given). The seed writes the material catalog only into an
empty database; `SEED_RESET=1` rewrites it.

To run lab locally next to the site, see `lab/README.md` (it needs its own port, e.g. `PORT=3001`),
then set `LAB_API_URL=http://127.0.0.1:3001`.

## Running on a Windows server (static IP, HTTPS, domain)

Works like a VPS: the site listens on the machine's IP behind [Caddy](https://caddyserver.com), which
provides HTTPS, and runs as a **background process** — closing the terminal does not stop it.
Everything is managed from a desktop app: double-click `server.bat` (first run builds `Lab3D.exe` with the
C# compiler built into Windows — nothing to download — then opens the window; it asks for administrator
rights itself). Closing the window does not stop the site.

```powershell
winget install OpenJS.NodeJS.LTS PostgreSQL.PostgreSQL.17 CaddyServer.Caddy Git.Git   # once, if missing
server.bat            # the app (Lab3D.exe)
```

| Page | What it does |
| --- | --- |
| Overview | status, address, processes, Start / Stop / Restart / Open site, and a journal of what the app ran |
| Logs | live view of the site, its errors, Caddy (HTTPS) and the supervisor (crashes, restarts) |
| Updates | shows the installed version and the commits waiting in the git repository; one button pulls them, installs dependencies, updates the database schema, rebuilds and restarts. Checks automatically every 30 minutes and shows a banner |
| Settings | first install / change of domain, database, admin login, autostart with Windows; uninstall |
| Cleanup | build cache and old logs; uploaded models that never became an order; stray files |

**Updates through git:** push your work to the repository; the app on the server pulls it. If the server
folder is a `git clone`, it just works. If it was copied or downloaded as a zip, open *Updates* and enter the
repository URL once (files are kept as they are). Private repositories need credentials on the server
(Git Credential Manager, or a token in the URL). The app itself is `deploy/app.ps1`, so updates also update
the app — it restarts itself after an update that changed it. If local edits in the server folder block a
pull, the app offers a forced update (`git reset --hard`; `.env*` and `uploads/` are not touched).

Everything the window does is also available as commands (and there is a console menu):
`server.bat menu | start | stop | restart | status | logs | update | setup | autostart | cleanup | uninstall`
(also as `npm run server:start` etc.). A supervisor (`deploy/start.ps1`) restarts the site or Caddy if they crash.

- **Domain:** enter it in Setup and create a DNS `A` record to the server's public IP. Ports 80 and 443 must be reachable from the internet (forward them on the router if the PC is behind one). Without a domain the site opens on `https://<IP>` with a self-signed certificate (the browser warns).
- **Port 80/443 busy?** IIS or another web server holds them; stop it first (Start tells you what is using the port).
- **Data to back up:** the PostgreSQL database and the `uploads/` folder.
- **Payment:** disabled for now (see *Payment* above).

**lab (CRM)** is set up from the same Setup flow: it offers to configure lab too, then writes
`LAB_API_URL` (localhost, lab's port) and `CRM_URL` (lab's domain, used for the «CRM» link in the
admin panel) into the site's env file.

**Slicer (exact prices):** `server.bat slicer` installs OrcaSlicer + the slicing sidecar for Bambuddy,
`server.bat slicer-test` checks the whole chain on a test cube, `server.bat slicer-restart` restarts it
without touching the site. Without it orders go in without a price, to be agreed with the customer.

Other commands: `bambuddy-start | bambuddy-stop | bambuddy-restart`, `db-push` (interactive schema push
for changes `update` refuses to apply unattended), `git-check`, `cleanup-cache`.

### Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (set for you by `prisma dev`) |
| `AUTH_SECRET` | Auth.js session secret — replace the placeholder before deploying |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Public site address; used for absolute links (e.g. model download links sent to lab) |
| `LAB_API_URL` | lab's address, e.g. `http://127.0.0.1:3001`; without it orders are saved but not sent to lab |
| `LAB_API_KEY` | Optional bearer token for the site → lab channel |
| `CRM_URL` | Link to lab from the admin panel; defaults to `crm.<site domain>` |
| `BAMBUDDY_URL` | Bambuddy API, default `http://127.0.0.1:8000` |
| `BAMBUDDY_API_KEY` | Enables exact slicer prices and color sync; without it every order is "price on request" |
| `BAMBUDDY_PUBLIC_URL` | Public address of the Bambuddy UI for the "open Bambuddy" link |
| `DADATA_API_KEY` | Russian address suggestions (free up to 10k requests/day); without it Photon (OpenStreetMap) is used |
| `NEXT_PUBLIC_RUB_PER_USD` | Exchange rate for showing USD on the English UI, default `90` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe (currently unused, see *Payment*) |

## Project layout

- `app/` — pages: home, `materials`, `works` (showcase), `faq`, `contacts`, `login`, and the order flow
  in `app/order/*` (`upload`, `configure/[fileId]`, `checkout`, `thank-you`, `request`, `sample`)
- `app/admin/*` — admin panel: `materials` (materials, colors, images, Bambuddy color sync),
  `pricing` (rates, infill levels, slicer presets), `printers`, `showcase`, `reviews`, `contacts`
- `app/api/*` — JSON API: files, quote, orders, materials/colors, showcase, reviews, model requests,
  address suggestions, delivery quotes, admin endpoints, Stripe
- `components/` — React components (client parts of pages, admin editors, 3D viewer)
- `lib/geometry` — STL/OBJ parsing and volume/bounding-box calculation
- `lib/pricing` — pricing engine and defaults; `lib/slicing.ts`, `lib/bambuddy.ts` — slicer prices
- `lib/labClient.ts` — sending orders to lab and getting delivery quotes from it
- `lib/i18n` — RU/EN translations and locale handling
- `lib/storage` — storage adapter (local `uploads/` folder; can be swapped for S3)
- `prisma/` — schema, migrations, seed
- `deploy/` — Windows server app and scripts (`server.bat` is the entry point)
- `lab/` — the CRM: order board, serial numbers, labels, CDEK/Ozon delivery, warehouse, accounting.
  A separate Node.js app with its own `package.json` and SQLite database — see `lab/README.md`
- `fixtures/` — a known-volume 10 mm test cube (expected volume 1 cm³) for checking the geometry pipeline

## Scope notes

Only **STL and OBJ** uploads are supported. `lib/geometry` has one parser per format behind a common
interface, so adding 3MF/STEP later doesn't require touching pricing, upload or viewer code.
