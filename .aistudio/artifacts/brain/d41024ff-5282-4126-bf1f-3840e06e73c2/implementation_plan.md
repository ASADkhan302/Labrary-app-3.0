# Implementation Plan: ULM Library Core System Specification (Excluding UI)

## Proposed Changes

### Core System Technical Documentation
- **Create `docs/ULM_LMS_CORE_SYSTEM.md`**:
  - **Role & Directives**: System prompt for developers and AI models defining all non-UI rules, invariants, and performance targets (50,000+ books with zero UI freeze).
  - **Dual Storage Architecture**: Detailed technical documentation for Electron SQLite (`better-sqlite3`, WAL mode, PRAGMA tuning) and Browser IndexedDB fallback (`Dexie`/`idb`, memory B-tree caches).
  - **IPC Protocol & API Contracts**: Complete catalog of Electron IPC channels (`electron/main.cjs` <-> `preload.cjs` <-> Service Layer), request/response schemas, error handling, and asynchronous workers.
  - **Database Schemas & Data DDL**: Exhaustive database schemas, indexes, and TypeScript types for `books`, `almaris`, `shelves`, `borrowers`, `loans`, `audit_logs`, and `system_settings`.
  - **Accession Ledger & Sequence Engine**: Deterministic atomic auto-incrementing algorithms, prefix formatting, gap detection, and collision prevention.
  - **Barcode & Hardware Subsystems**: USB HID Keyboard Wedge buffer handling, timing tolerances (≤ 35ms), Code128 generation, and O(1) duplicate checks.
  - **Circulation & Lending Logic**: Issue, return, renewal, grace period, overdue penalty calculation formulas, and quota enforcement.
  - **Physical Stacks & Almari Engine**: Coordinate hierarchy, capacity tracking, fill-rate calculations, and automated overflow detection.
  - **Excel / CSV Pipeline**: Streaming XLSX ingestion, batch chunking, fuzzy column mapping, transaction rollbacks, and data export.
  - **Data Migration & Backup Integrity**: Zero-data-loss migration pipelines, SHA-256 checksum verification, and atomic snapshot restores.

## Verification Plan
1. Ensure `docs/ULM_LMS_CORE_SYSTEM.md` is created with complete, self-contained architecture, schemas, and algorithms.
2. Verify project builds cleanly with `compile_applet`.
