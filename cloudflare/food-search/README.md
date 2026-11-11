# Optional food database search

LocalCal can search packaged foods using this Cloudflare Worker. The core Go/SQLite/PWA app, food imports and offline logging remain independent of it. The first provider is **Open Food Facts**; no AI, paid API key or food-data subscription is required. Cloudflare account usage remains subject to Cloudflare's own plan limits.

## What the user sees

1. In Add food, type a food name or brand.
2. Expand **Search food databases**, select **Croatia** or **Worldwide**, and select **Search online**. Searches are explicit, never sent on each keystroke.
3. Review up to eight product options, including brand, package quantity, barcode and nutrition. Products without usable energy are displayed but cannot fill the form.
4. Choose a product and confirm whether its nutrition panel is per **100 g** or **100 ml**.
5. Select **Fill food form**, correct any details, then **Create food** to save through the normal LocalCal food workflow. Choosing a result does not automatically import or log it.

The saved food syncs to SQLite/MCP like any other local food. Search queries and the market selection go to the Worker and Open Food Facts. Diary, weight, targets and existing food-library contents are not sent. Open Food Facts is community-maintained; check the current package label.

## Connection

`Browser -> Go /api/food-search -> authenticated Worker /search -> Open Food Facts`

The browser never receives the Worker token. The Go server accepts only the query and a fixed market choice; callers cannot choose an upstream URL. The Worker has a fixed Open Food Facts upstream, follows no redirects, and caches successful searches for five minutes. A six-second interval on the Go proxy helps respect the upstream search request limit. Upstream failures are not cached.

## Local development

On this Windows workspace, a launcher can start a separate preview with its own
test database and the local Worker connection:

```powershell
.\tools\start-food-search-preview.ps1
```

Run it from the repository root, then open `http://localhost:3191/`. It reuses a
Worker already listening on port 8787, or starts one if needed. The launcher has
been syntax-checked; automated approval prevented executing a configured app
launch during this session, including after user confirmation. The existing
preview on port 3189 was left unchanged.

Requires Node 22.12 or newer and the project's Go toolchain.

```sh
cd cloudflare/food-search
npm ci
```

Create `.dev.vars` in this directory containing `SEARCH_TOKEN=` followed by a random secret of at least 16 characters. This file is ignored by Git. A development token has already been generated locally for this workspace; its value is intentionally not printed or committed.

Start the local Worker:

```sh
npm run dev
```

It listens on `127.0.0.1:8787`. In a separate PowerShell terminal at the repository root, launch an app instance using a separate test database:

```powershell
$env:FOOD_SEARCH_WORKER_URL = 'http://127.0.0.1:8787/search'
$env:FOOD_SEARCH_WORKER_TOKEN = ([IO.File]::ReadAllText((Join-Path $PWD 'cloudflare/food-search/.dev.vars')).Trim() -split '=', 2)[1]
$env:PORT = '3191'
$env:DATA_DIR = Join-Path $env:TEMP 'localcal-food-search-test'
$env:STATIC_DIR = $PWD.Path
go run ./cmd/server
```

Open `http://localhost:3191/`. The separate `DATA_DIR` keeps this test instance out of the existing preview database. The app's inherited server listens on all interfaces; use the normal private-network/firewall arrangement for local development. The Worker itself binds only to loopback.

For an existing local app instance, set the two `FOOD_SEARCH_WORKER_*` variables in its launch environment and restart it with its existing `DATA_DIR` unchanged. Loading updated HTML alone does not add the Go API routes to an already running older binary.

## Deploy to Cloudflare

From this directory:

```sh
npx wrangler login
npx wrangler secret put SEARCH_TOKEN
npm run deploy
```

Use a strong secret and retain the same value for the app's server configuration. `wrangler.jsonc` declares the secret as required. Adjust `OFF_USER_AGENT` to identify your deployment/contact according to Open Food Facts API guidance.

Put the published Worker URL and matching token in the LocalCal server's environment (or the Compose `.env` file):

```dotenv
FOOD_SEARCH_WORKER_URL=https://localcal-food-search.YOUR-SUBDOMAIN.workers.dev/search
FOOD_SEARCH_WORKER_TOKEN=YOUR_MATCHING_SECRET
```

Recreate the app container with the updated source/configuration:

```sh
docker compose up -d --build
```

The Worker needs no D1, KV, R2 or public connection to the local SQLite server. The app makes outbound requests to it. No Cloudflare deployment has been made by this implementation session.

## Nutrition rules

- Uses only the source's normalized **as-sold** `*_100g` nutrient values, never the raw entered or `*_serving` values. Prepared-product values are not substituted.
- OFF defines those normalized fields as per 100 g **or per 100 ml for liquids**. The caller must confirm the basis; packaging quantity is not used as a density conversion.
- Keeps source kcal. When only kJ is available, converts by 4.184 and records the conversion in the source notes.
- Missing and less-than nutrient values stay blank/unknown. Source qualifiers are retained in notes.
- Does not guess portion weights or add a serving conversion.
- Stores the product URL, barcode, chosen basis and ODbL attribution in the saved food's source field.

Open Food Facts data is under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Retain attribution, and review the share-alike requirements before distributing a derived food database. Application code retains the repository's MIT license; this does not relicense source food data.

## Verification

```sh
npm test
npm run check
```

The root `make test` also runs the Worker tests without installing Wrangler. Tests cover normalized units, missing/bounded nutrients, authentication before cache access, duplicate products, caching, service errors, rate limits, server-side token handling, UI review and explicit save. A real local workerd search also returned Open Food Facts products during this session. API availability and coverage vary; empty results and service errors have explicit UI states.

Primary references: [OFF API guidance](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md), [OFF nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/), [Cloudflare local development](https://developers.cloudflare.com/workers/local-development/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
