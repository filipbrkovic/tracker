# LocalCal implementation log

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
No direct ChatGPT web/mobile local-MCP connectivity is promised. Some inherited
Italian UI labels remain. No physical CasaOS, ZimaBoard or phone test claimed.
