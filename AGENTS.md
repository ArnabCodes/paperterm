# Project guidance

- Read `README.md` and `TASKS.md` before changing project scope.
- Build a shared browser reader with Chromium, Firefox, and Safari adapters. Track Safari native packaging/runtime validation separately from source completion. The October 2026 rebuild supersedes the original terminal-only scope.
- Preserve readable keyboard help and document the exact key bindings.
- Treat rendering, text extraction, and lookup limitations as product behavior to document.
- Do not claim rendering or lookup quality without browser validation on representative PDFs.
- Run npm run build and npm test for relevant changes; the latter runs Cargo tests with the selected rustup compiler.
- Keep PDF content and indexing local. Do not upload documents or introduce telemetry.
- Keep the GitHub repository private. Preserve Git history when replacing implementation files.
