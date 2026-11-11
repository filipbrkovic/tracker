# LocalCal — Codex / Claude Code Implementation Handoff

**Revision:** 2026-11-10 — **FORK Progress Tracker; do not start from scratch**
**Upstream repository:** https://github.com/heizelnut/tracker
**Upstream license:** MIT (preserve LICENSE and attribution)
**Target deployment:** ZimaBoard (x86-64) running CasaOS and Docker Compose
**Product:** private, single-user, mobile-first calorie/macro tracker with editable local food data and MCP read/write access

## 0. Your job — implement, don't just plan

You are Codex or Claude Code acting as the implementation agent. **Clone or fork `https://github.com/heizelnut/tracker` and modify its existing codebase.** Do not generate an unrelated new app. Inspect the actual repository, run its existing tests, and document any difference between this handoff and the repository's current state. Preserve useful code and migration paths. Implement the highest-priority working milestones, run tests, and report exact results. If you cannot run Docker or test on CasaOS, state that honestly.

Suggested commands:

```bash
git clone https://github.com/heizelnut/tracker.git localcal
cd localcal
git remote rename origin upstream
# Add your own fork as 'origin' if you have one; otherwise continue on a local branch.
git switch -c feature/localcal
# Inspect README.md, cmd/server/, index.html, sw.js, Dockerfile, docker-compose.yml, tests/ and LICENSE.
make test
```

**Do not blindly rely on the exact commands or structure in this handoff if upstream has changed. Inspect first.** Do not remove `LICENSE`. Keep a `CHANGELOG_LOCALCAL.md` explaining what changed and why.

## 1. Existing foundation to REUSE

Progress Tracker already provides a mobile-responsive offline-capable PWA (`index.html`, service worker and manifest), a lightweight **Go + SQLite** server under `cmd/server`, incremental per-record sync with SSE, a Dockerfile/Compose deployment, an editable food database and CSV import, and a **Streamable HTTP MCP endpoint** at `/mcp` with food/diary tools. According to the upstream README, its MCP tools already include `list_foods`, `add_food`, `list_diary`, `add_diary_item`, `update_diary_item`, and `remove_diary_item`.

**Architectural mandate:** Evolve the current **Go + SQLite + PWA** stack. Do **not** rewrite it into React, Node, TypeScript, PostgreSQL, or microservices as a first step. Refactor `index.html` into modules only if that materially improves testability and does not delay a functioning fork. Keep one lightweight application container, unless a separately hosted optional AI service is chosen.

**Critical existing behavior to audit:** The browser currently uses LocalStorage as an offline cache; server data lives in SQLite (`DATA_DIR/tracker.db`); the upstream sync model represents an entire day's diary as one record with last-write-wins timestamps. Verify conflict behavior with two browsers plus MCP; it must never silently drop independently added items. Do not presume that browser cache and server are always identical just because MCP writes use the DB.

## 2. Product requirements

The result should feel as simple as Calorco, but be fully under the owner's control.

- **No registration or accounts:** One private user; no sign-up, email, passwords or external identity provider. Network security can use a private VPN, trusted HTTPS reverse proxy, or an MCP bearer secret — these are not consumer accounts.
- **Truly local/self-hosted:** ZimaBoard + CasaOS is the primary server; SQLite and photos live on a bind-mounted local disk. Core manual tracking has no subscriptions, cloud database, external AI APIs, telemetry or daily quota.
- **Very fast logging:** Launch app on phone, find or create food, enter amount, save in a few taps. Always show **Create food** and **Quick add** even when there are no search results.
- **Croatian/regional foods first-class:** Support Croatian and neighboring regional food names, brands, alternate spellings, common aliases, č/ć/đ/š/ž, and searches without diacritics. Keep display names in their original spelling. Don't hardcode assumptions about what foods are available.
- **Owner-supplied datasets:** The owner may supply large CSV/JSON food tables later. Design importer, field mapping, validation, preview, duplicate handling, updates and source attribution. Do not require online lookup.
- **Editable everything:** User can create, edit and delete foods, portions and diary entries; fix nutrition data at any time; save recent and favorite foods.
- **MCP read AND write:** Agents using supported MCP clients must access the same records as the UI. Save operations must be verifiable from the phone app, and vice versa.
- **Optional food photos:** Camera/upload UI with manual fallback; optional vision recognition through an explicit opt-in service (e.g. Ollama on a more capable machine). ZimaBoard must not be forced to run a heavy model.
- **Mobile PWA:** Support Android and iPhone browsers. Use HTTPS/trusted secure context when needed for installation and camera features. Explain local-network vs remote access clearly.

## 3. Proposed user experience

Mobile bottom navigation: **Today | Add | Foods | Settings**. Keep the main actions within thumb reach; no fitness plans, exercise UI, trophies, social features or calorie coaching in the initial fork.

### Today
- Today/yesterday navigation, calorie target and consumed calories, protein/carbs/fat totals.
- List of the day's entries with food name, portion, kcal, macros and edit/delete controls.
- Prominent **+ Add** and **Camera** actions. New MCP entries should become visible via SSE/sync and be visible after refresh/restart.

### Add
- One forgiving search field: saved foods, favorites, recent foods, aliases, brands and regional spellings.
- Enter quantity in grams, milliliters or servings, with an editable serving-to-grams conversion where appropriate.
- Always-visible **Create custom food** and **Quick add calories/macros** options. Never force a database match.
- Quick add requires a meaningful name and kcal; macros can be omitted (record as unknown, do not falsely report 0 as known).
- Photo workflow: upload/capture -> show photo -> optionally propose foods and portions -> user corrects and confirms -> save ordinary diary records.

### Foods
- Create/edit/duplicate/archive foods. Nutritional basis may be per 100 g, 100 ml or serving, with stable conversion units.
- Brand, barcode (optional), original name, aliases, category, source, nutrition facts and saved servings.
- Import CSV/JSON with preview and report: added/updated/skipped/rejected, with errors per row. Export CSV/JSON. Provide sample templates.

### Settings
- Daily calories/macros, Croatian/English UI labels, units, data/storage location, import/export and backup/restore.
- AI is **off by default**; configuring a separate vision endpoint is optional.
- Explain access: local LAN, trusted HTTPS or VPN; no app-level registration.

## 4. Build on the repository, not alongside it

Recommended implementation order:

1. **Baseline:** Run existing Go/JavaScript tests and a local Docker smoke test. Record revision/commit, behavior, dependency and security audit. Pin a tested upstream commit for reproducible changes.
2. **Simplify UI:** Make diary the landing page. Hide/remove workout, lift and unnecessary coaching screens from the UI. Keep existing database records and migration compatibility initially; do not accidentally erase user history or break old backups.
3. **Regional food search:** Add normalized search indexes and aliases while preserving original Unicode names. `svjezi sir` must find `Svježi sir`; handle case and common spelling variants. Avoid collision between distinct brands.
4. **Importer:** Extend upstream CSV support; add JSON, flexible delimiter/decimal parsing, preview/dry-run, nutrition-basis mapping, idempotent imports and a template. The owner will provide data later: build the ingestion pipeline without assuming it exists now.
5. **Entry model and sync:** Use stable IDs for individual diary items; snapshot nutrition on logged items, so later changes to a food do not silently rewrite history. Fix any last-write-wins per-day data-loss race. Preserve offline edits and safe reconciliation on reconnect.
6. **MCP:** Reuse the Go backend and its existing HTTP MCP implementation; extend tools where required. Do not create a second divergent database or a second standalone backend. Add optional stdio transport or an explicit local bridge **only after** HTTP MCP is tested. Do not claim the existing server already supports stdio.
7. **CasaOS deployment:** Adapt current multistage Go Dockerfile and Compose, test amd64 image and persistent storage. Provide CasaOS GUI import and SSH/CLI routes. Avoid mandatory GPU, Ollama, Redis or PostgreSQL containers.
8. **Photos:** Add local photo attachment and manual log first; later add optional user-reviewed vision proposals. Photo AI must not block manual tracking.

## 5. Data rules and nutritional math

- Food identity: durable ID, display name, normalized searchable name, aliases, brand, optional barcode, categories, source/provenance and timestamps.
- Store authoritative nutrition per stated basis (`100 g`, `100 ml` or `serving`), kcal and optional protein/carbs/fat, plus serving conversion. Distinguish **unknown** nutrition values from measured zero.
- Use entered kcal where provided; calculate `4×protein + 4×carbs + 9×fat` only as a fallback. Don't overwrite label calories just because macro-derived calories differ. Support alcohol/other energy sources without inventing nutrition from a name alone.
- Diary item must snapshot the name, chosen amount/unit, nutrition values, day and source food ID. Editing the food master record must not unexpectedly alter logged historical totals.
- Validate negatives, zero/invalid serving size, unrealistic values (warn rather than silently destroy), Unicode, fractional quantities and decimal comma.
- Avoid duplicate log entries from repeated MCP requests; use optional client idempotency keys.
- Treat `Europe/Zagreb` as default timezone and use local calendar day boundaries, including DST transitions. Make timezone configurable.
- Preserve old user data through versioned migrations and backup before destructive schema changes.

## 6. MCP requirements

**Keep upstream `/mcp` Streamable HTTP working where secure; first audit its tool schemas and behavior.** Preserve existing tools when possible and add/adjust the following capabilities (names may be mapped to compatible existing ones):

| Capability | Expected behavior |
| --- | --- |
| `search_foods` / `list_foods` | Search regional aliases, brands and names; return stable food IDs and nutrition basis. |
| `create_food` / `add_food` | Save custom local food with explicit nutrition and aliases; return food ID. |
| `update_food` | Correct name, aliases, servings and nutritional data. |
| `quick_log_food` / `add_diary_item` | Log a chosen food or explicit manual entry with date/amount; return saved entry ID and calculated totals. |
| `list_diary` / `list_entries` | Read actual saved records and IDs for a date/range. |
| `update_diary_item` | Edit quantity and recalculate snapshot totals. |
| `remove_diary_item` | Delete one identified item, not the whole day. |
| `get_day_summary` | Match exactly what the UI shows for kcal and macros. |
| `import_foods` (optional MVP tool) | Consume an approved staged import, not arbitrary file paths/URLs. |

**Sync acceptance:** An MCP-created entry must appear in Today without separate manual import; a UI-created entry must appear through MCP; edits and deletes must also round-trip. Test browser refresh, server restart, device reconnect and simultaneous writers. Return errors rather than claiming a successful log that was not persisted.

**Security:** Upstream currently has *no authentication*, and its dataset key is not a security boundary. Do not expose `/mcp` or mutation APIs on the public internet without proper authorization. Prefer private-network access; if remotely served, add explicit token auth/TLS/reverse proxy and CORS/Origin/Host checks. No hard-coded secrets. Support MCP clients such as Codex CLI and Claude Code, but **do not promise direct ChatGPT Plus web/mobile access to local MCP**; that depends on ChatGPT's current features and account permissions.

## 7. ZimaBoard / CasaOS deployment

Existing repository provides `Dockerfile`, `docker-compose.yml` and `DATA_DIR=/data`; evolve those rather than starting a new container system. Current upstream container listens on **8080** and uses an Alpine runtime with a Go binary. Confirm these details against the checked-out revision.

Deliver:

- `Dockerfile` with `linux/amd64` build tested; production runtime non-root and small memory footprint; health check and restart policy.
- `compose.yaml` or revised `docker-compose.yml`, with persistent **bind mount** such as `/DATA/AppData/localcal:/data`, not a disposable anonymous volume. Set appropriate ownership/permissions for mounted path.
- Optional subfolders for `photos`, `imports`, `backups`; put all persistent assets inside `/data` and keep SQLite on local storage, not NFS/SMB.
- An overridable host port, e.g. `3187:8080`. Explicitly distinguish loopback-only setup from LAN exposure for phone access.
- `CASAOS_DEPLOYMENT.md` covering: repo clone/build, Compose CLI, importing a prepared Compose app through CasaOS, local URL, secure phone access, updates, rollback and backup/restore. A CasaOS app import must not assume a locally built image is available from a remote registry.
- Backup recommendation: `VACUUM INTO` or SQLite online backup mechanism when running, not blindly copying only the WAL-mode `tracker.db` while writes continue. Include photos and import data as relevant.
- A private LAN/VPN/HTTPS model (e.g. Tailscale or trusted reverse proxy); never instruct opening unauthenticated port 8080/3187 to the internet.

No registration even on the home server. For remote access, a proxy-level security layer or device/VPN setup is acceptable; do not add a user-account product feature.

## 8. Food photos and optional AI

MVP: allow mobile photo capture/upload and retain image locally under `/data/photos`. Validate file type/size, strip GPS EXIF data and use safe filenames. If no AI model is configured, allow the user to enter food name and nutrition manually while attaching the photo.

Later optional integration: a remote Ollama-compatible vision model running on a separate capable machine, **disabled by default**. Generate a reviewable draft with likely items and estimated portions; match against local foods first. Do not auto-save guesses. Avoid paid API calls, quotas or assumptions that ZimaBoard hardware can process photos efficiently.

## 9. Acceptance tests — demonstrate, don't merely assert

1. `docker compose up -d --build` works on an amd64-capable host; UI works with no registration and no AI; restart retains SQLite data.
2. Create `Svježi sir` with supplied fixture nutrition. Searching `svjezi sir` finds the same record and displays the original accented name.
3. One food with aliases `kruh` and `hljeb` is searchable under both without creating duplicate food records.
4. A totally unknown regional food can be quick-added manually with explicit kcal, even with an empty database.
5. Import Croatian CSV/JSON files with diacritics, brands, decimal commas and duplicates. Dry-run preview works; repeated import doesn't duplicate foods; source and errors remain inspectable.
6. Add a food via MCP; it appears in the phone web app via sync, and after refresh/restart. App-added food/diary entries are immediately queryable through MCP.
7. Two clients independently add different foods to the **same day** while one is offline; both survive reconciliation. An MCP write during client sync is not lost.
8. Edit and delete individual diary items in either interface; both interfaces agree on totals. Retried identical MCP write with same request ID creates one entry.
9. Change food nutrition later; historical diary snapshots remain unchanged unless intentionally re-calculated.
10. Manual/photo workflows work if Ollama is unconfigured or unavailable. No photo leaves the configured private storage without opt-in.
11. Store data in `/DATA/AppData/localcal` on a CasaOS-style Docker setup; test restart, update and backup/restore. Clearly label untested physical ZimaBoard/CasaOS specifics.
12. HTTPS/PWA availability and phone access are documented and tested where devices are available. No unauthenticated public HTTP MCP or mutation API.
13. Existing upstream tests still pass or have a justified, documented replacement; add new Go tests and browser/sync integration coverage.

## 10. Milestones and delivery definition

**Milestone 0 — audit/reproducible fork:** checkout upstream, note commit hash, license, architecture, baseline tests, Docker baseline, exact modifications needed, create new branch.

**Milestone 1 — usable LocalCal:** simplified Today/Add/Foods/Settings; manual custom food and quick-add; aliases and regional search; import/export with preview; stable diary IDs and tested sync; CasaOS-style Docker persistence. **Ship runnable software**, not just plans.

**Milestone 2 — robust MCP:** reuse/extend existing Go MCP endpoint, add missing editing/summary/idempotency tools, implement tests that prove MCP/UI consistency, document usable client configuration and secure connectivity.

**Milestone 3 — photos/polish:** camera/photo attachment + manual fallback, optional user-reviewed AI, favorites/recents and Croatian/English UI. Keep the core usable if the vision service is down.

**Required deliverables:** Source in the fork/branch, code changes and working commands, tests and results, `README.md`, `CASAOS_DEPLOYMENT.md`, import templates, backup instructions, configuration example, license attribution, a simple demo/verification checklist, and clearly stated limitations. Do not claim it works on the physical ZimaBoard unless actually tested there.

**Stop criteria:** First ship Milestone 1 end-to-end. Then proceed to Milestone 2 and Milestone 3 as time and tooling permit. If blocked, state what is implemented, exact test results and what remains; never disguise mock functionality as complete.

---

## START PROMPT — paste into Codex / Claude Code

> Clone and fork https://github.com/heizelnut/tracker. Read `LocalCal_ProgressTracker_Handoff_2026-11-10.md` completely and follow it as the implementation specification. **Reuse the upstream Go + SQLite + PWA + MCP server, do not rebuild from scratch.** The goal is a minimal private calorie tracker for a ZimaBoard with CasaOS and Docker, with Croatian/regional food search, owner-supplied food imports, no registration, reliable app↔MCP synchronization and optional photo logging. Start by auditing the real upstream source and running its tests. Then implement Milestone 1, test it, and continue to MCP consistency and photo support. Keep tests and deployment documentation current. Actually modify and run the code; do not stop after writing a plan.

## References

- Upstream repository / README: https://github.com/heizelnut/tracker
- Upstream Dockerfile: https://github.com/heizelnut/tracker/blob/main/Dockerfile
- Upstream Compose: https://github.com/heizelnut/tracker/blob/main/docker-compose.yml
- CasaOS: https://github.com/IceWhaleTech/CasaOS
- MCP specification: https://modelcontextprotocol.io/
