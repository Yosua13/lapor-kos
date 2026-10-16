# Test Cases Verifikasi Manual: ARCH-04 Dekomposisi Domain & Refactoring One-Function-Per-File

- **Track ID:** ARCH-04
- **Master Epic:** #70
- **Issue:** #74
- **Branch:** `codex/arch-04-domain-decomposition-one-func-per-file`
- **Tanggal Pengujian:** 16 Oktober 2026

---

## 1. Tujuan Pengujian
Memvalidasi bahwa perombakan arsitektural Clean Architecture berbasis aturan ketat **One Function Per File** (1 file = 1 use case struct + Execute func + unit test, 1 file = 1 HTTP handler func):
1. Memenuhi struktur modular berlapis Domain, UseCase, Postgres Infrastructure, dan HTTP Delivery Handler.
2. Mencapai target coverage pengujian unit >85% untuk seluruh domain use cases.
3. Mempertahankan 100% kompatibilitas kontrak API HTTP tanpa breaking changes bagi frontend Next.js.
4. Menjaga integritas PostgreSQL trigger immutability audit trail dan multi-tenancy property scoping.

---

## 2. Matriks Pengujian & Verifikasi Gelombang

| ID Skenario | Domain | Komponen yang Didekomposisi | Status Unit Test | Coverage | Hasil Uji |
|-------------|--------|-----------------------------|------------------|----------|-----------|
| TC-ARCH04-01 | Finance | `internal/domain/finance/`, `internal/usecase/finance/`, `internal/delivery/http/handler/finance/`, `internal/infrastructure/postgres/finance/` | 14 test suite passed | 85.3% | PASS |
| TC-ARCH04-02 | Payment | `internal/domain/payment/`, `internal/usecase/payment/`, `internal/delivery/http/handler/payment/` | 9 test suite passed | 87.5% | PASS |
| TC-ARCH04-03 | Room Transfer | `internal/domain/room_transfer/`, `internal/usecase/room_transfer/`, `internal/delivery/http/handler/room_transfer/` | 9 test suite passed | 88.7% | PASS |
| TC-ARCH04-04 | Checkout | `internal/domain/checkout/`, `internal/usecase/checkout/`, `internal/delivery/http/handler/checkout/` | 8 test suite passed | 86.7% | PASS |
| TC-ARCH04-05 | Complaint | `internal/domain/complaint/`, `internal/usecase/complaint/`, `internal/delivery/http/handler/complaint/` | 9 test suite passed | 91.7% | PASS |
| TC-ARCH04-06 | User / Identity | `internal/domain/user/`, `internal/usecase/user/`, `internal/delivery/http/handler/user/` | 7 test suite passed | 100.0% | PASS |
| TC-ARCH04-07 | Contract | `internal/domain/contract/`, `internal/usecase/contract/`, `internal/delivery/http/handler/contract/` | 7 test suite passed | 100.0% | PASS |
| TC-ARCH04-08 | Visitor Permit | `internal/domain/visitor/`, `internal/usecase/visitor/`, `internal/delivery/http/handler/visitor/` | 8 test suite passed | 100.0% | PASS |

---

## 3. Hasil Pengujian Integrasi & Release Gates

1. **Backend Test Suite (`go test ./...`)**:
   - Seluruh package backend (handler, domain, usecase, middleware, service, repository, delivery, infrastructure) lulus pengujian 100%.
2. **CI Release Gate: Secret Scanner (`scan_secrets.go`)**:
   - `[PASS] No exposed secrets, live credentials, or private keys found in scanned files.`
3. **CI Release Gate: Release Artifact Checker (`check_release_artifacts.go`)**:
   - `[PASS] Release artifacts are clean: zero credentials, zero local binaries, and zero user uploads.`
4. **CI Release Gate: Migration Validator (`validate_migrations.go`)**:
   - `[PASS] All database migrations are sequentially consistent and valid (001 to 030).`
5. **CI Release Gate: Backup & Restore Drill (`backup_restore_drill.go`)**:
   - `[PASS] Backup & Restore Drill completed in 195ms. All 5 critical immutability triggers active.`
6. **Frontend Test Suite (`vitest run`)**:
   - 28 test files passed (102 unit/component tests passed).
7. **Frontend Production Build (`next build`)**:
   - Lulus kompilasi Turbopack dan pemeriksaan TypeScript tanpa error typecheck.

---

## 4. Kesimpulan
Seluruh kriteria penerimaan Issue #74 dan Master Epic #70 terpenuhi secara menyeluruh. Struktur repositori bersih, terisolasi dengan rapi, dan siap untuk deployment produksi.
