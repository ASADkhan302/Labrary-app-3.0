# PROJECT_NOTES.md

## Architecture
- **Framework**: Vite + React 19 + TypeScript SPA + Tailwind CSS v4.
- **Port & Host**: Port 3000 on `0.0.0.0`.
- **Target**: University of Lakki Marwat LMS (Library Management System).
- **Core Engine**: Client-side storage (IndexedDB / LocalStorage / sql.js WASM fallback).

## Key Files
- `src/App.tsx`: Main application shell, tabs routing, modal state management.
- `src/types/library.ts`: Data types (Book, Borrower, Transaction, HistoryEntry, Settings).
- `src/services/storage.ts`: Data persistence engine & system configurations.
- `src/services/libraryFolderService.ts`: Local data folder syncing & imports.
- `src/components/BooksCatalogView.tsx`: Books inventory, multi-selection, and table management.
- `src/components/catalog/AlmariView.tsx`: Physical Almari stacks, capacity meters, range lookup & paste.
- `src/services/almariService.ts`: Almari Plan, shelf range calculations, and unified auto-arrange.
- `src/services/stagedImportEngine.ts`: Staged 1,000/round import pipeline with atomic rollback & resume.
- `src/components/CirculationDeskView.tsx`: Issue/return book circulation workflows.
- `src/components/BorrowersView.tsx`: Member registration & borrowing management.
- `src/components/ReportsView.tsx`: Circulation metrics and system reporting.

## Key Commands
- Dev Server: `npm run dev` (runs `vite --port=3000 --host=0.0.0.0`)
- Typecheck / Lint: `npm run lint` (`tsc --noEmit`)
- Build: `npm run build` (`vite build`)

## Development Conventions
- Strict line-targeted edits (`edit_file` / `multi_edit_file`).
- No full-file rewrites.
- Keep output summaries concise with tables; avoid dumping logs.
