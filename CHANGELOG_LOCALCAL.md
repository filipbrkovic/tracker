# LocalCal implementation log

## Optional Cloudflare food database lookup

- Added explicit Open Food Facts search with Croatia/Worldwide market selection,
  product options, source attribution and an editable draft before saving.
- The Go server forwards food queries to an optional authenticated Cloudflare
  Worker. Worker credentials stay on the server; diary and weight data are not
  included in lookup requests. Core logging and imports remain independent.
- Uses normalized as-sold nutrition, preserves unknown/bounded macros and label
  energy, and requires confirmation of 100 g versus 100 ml before form fill.
- Added bounded responses, timeouts, request spacing, successful-result caching
  and clear unavailable/empty/error states. Documented local and Cloudflare setup.
- Real workerd execution caught unsupported `redirect: error`; the Worker uses
  manual redirects and rejects non-success upstream responses instead.

## Diary meal sections

- Added Breakfast, Lunch, Dinner and Snacks, with per-meal calorie/macro totals
  and Add food actions that select the meal in the logging form. Quick add uses
  the selected meal too.
- Each entry can move to another meal without changing its saved nutrition.
  Arrow controls reorder within a meal; dragging onto another entry assigns
  that entry's meal. Legacy entries remain in Unassigned until placed.
- Meal assignments use the existing per-item sync clocks and are preserved in
  backups and SQLite records. MCP add/update tools accept an optional meal;
  meal-only updates leave nutrition untouched. No schema migration required.

## Food autocomplete fix

- Typing in the food search now keeps name-and-brand labels as native datalist
  values. Selecting a suggestion no longer inserts an internal food ID.
- Added a regression check through the actual input/change handlers. Updated
  the PWA cache version so offline clients can refresh the corrected shell.

## Foundation

Upstream: https://github.com/heizelnut/tracker
Pinned revision: `b00399b72725278c8567e521f8d2764a7737d6b7`.
Working branch: `codex/localcal`. Original MIT LICENSE retained unchanged.
The existing fork already had `origin` and `upstream`; no replacement app was
created. Go + modernc SQLite + single-file PWA + existing HTTP MCP retained.

Baseline attempt: 18 JavaScript tests passed; 10 integration tests could not
start because Go was absent. Docker was also absent. A local Go 1.26.3 toolchain
was downloaded to run the remaining tests. Final results are recorded below.

## Milestone 1 changes

- Today/Add/Foods/Settings navigation; legacy records and hidden screens kept.
- Diacritic-insensitive regional names and aliases; brand-aware import identity.
- Custom food nutrition basis, source and optional macros; manual quick add.
- CSV/JSON preview, optional CSV header mapping, validation and import report;
  explicit apply, repeat import deduplication, CSV/JSON export and fixtures.
- Snapshot nutrition on diary entries; preserve unknown macros and label kcal.
- Per-item update/deletion clocks inside backwards-compatible day records.
  Independent additions merge; explicit item tombstones prevent resurrection.
  Legacy clients cannot infer deletion from omission: upgrade clients before
  editing/deleting shared diary entries. Concurrent edits to the same item use
  timestamps; this is not collaborative text editing.
- Full pulls during reconciliation deliberately replace unsafe client-clock
  cursors. This favors correctness over incremental bandwidth for a private
  single-user dataset. SSE still provides live updates.
- CasaOS-style persistent bind mount, loopback default, amd64 target, deployment
  and backup/restore instructions. No destructive schema migration.

## Boundaries

Milestone 2 tool extensions/idempotency and Milestone 3 photos/vision are not
implemented yet. Existing HTTP MCP is retained; stdio is not supported.
No direct ChatGPT web/mobile local-MCP connectivity is promised.
No physical CasaOS, ZimaBoard or phone test claimed.

## Verification and remaining limits (2026-11-10)

- Upstream Go tests passed after installing Go. Its JavaScript-only tests passed
  (18); ten integration tests exposed a Windows harness issue: missing `.exe`
  suffix. The harness now uses platform-specific executable names and waits for
  exit before deleting temporary files. Assertions were preserved.
- `go test ./...`: passed, including SQLite close/reopen, offline same-day
  addition/deletion replay and production Origin checks.
- `go vet ./...`: passed. `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build`:
  passed. This is a cross-build, not a Docker runtime test.
- Final `node --test tests/*.test.mjs`: **34 passed, 0 failed**.
  `go mod verify`: all modules verified. `git diff --check`: clean.
- JavaScript suite includes regional search, unknown/zero nutrition, insecure
  LAN UUID fallback, serving conversions, reorder preservation, app boot,
  server/SSE integration and a combined offline UI + MCP regression. The latter
  verifies saved nutrition after master-food edits and stale deletion replay.
- Real browser smoke: create `Svježi sir` with `98,5` kcal per 100 g, log 150 g,
  refresh, then read through MCP: 148 kcal and null macros in both interfaces.
  These were disposable test records, not owner nutrition data.
- Code/spec reviews found and prompted fixes for insecure-context imports,
  ordering, unused serving conversions, absent settings/quick macros, stale
  import previews and destructive legacy MCP food updates.

Daily targets/timezone and import reports are currently browser-local settings.
The existing MCP grams-only add tool explicitly rejects non-100g foods; the UI
supports 100g, 100ml and serving bases. Legacy MCP `add_food` rejects ambiguous
branded names and non-100g updates rather than silently changing their meaning.
Expanded MCP schemas, request idempotency, synced settings, photos, favorites,
recents and optional Croatian localization remain subsequent work. The implementation
uses no paid services. No comprehensive vulnerability scan was performed;
the security review covered network exposure, CORS/Origin and storage behavior.

Docker is unavailable here, so image startup/restart, CasaOS import, backup
restore on the target disk and physical Android/iPhone PWA checks remain open
deployment acceptance items. See `CASAOS_DEPLOYMENT.md` for the test checklist.

## English interface

Translated all built-in interface labels, dialogs, validation, empty states,
sync messages, accessibility labels, sample content and export filenames to
English. Set the document/PWA language to English and use English date formatting.
Existing owner-entered food names and multilingual import headers are preserved.
Updated the service-worker cache version. Verified Today, Add, Foods and Settings
in the running browser; all 34 JavaScript tests pass after translation.

## Clean workspace design (2026-11-11)

Applied the selected light workspace direction with a blue accent, a desktop
sidebar and mobile bottom navigation. All editable inputs/selects share the
same height, padding, border and corner radius, including settings and import
mapping. Added larger section spacing, separate search/portion panels and
collapsible secondary food metadata. Saved food search now shows accessible
selectable results with a top-right checkmark and subtle fill; selected results
keep the same one-pixel neutral border, without a selection ring or inset bar.
Keyboard focus remains visible for accessibility.

The stylesheet is included in Docker and offline PWA caching. Existing draft
food fields were preserved while refreshing the local preview. Browser checks
confirmed local search, selection, portion hints and the mobile layout.

The proposed AI workflow is ChatGPT search → sourced candidate drafts sent via
the existing HTTP MCP server → review/select in LocalCal → fill editable fields.
The existing server does not yet implement a staged-candidate tool, and no
ChatGPT connection or tunnel has been configured. This design change only
searches saved local foods; it does not simulate an online lookup.
