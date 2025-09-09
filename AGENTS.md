Project-scoped guidance for agents working in this repository. Keep changes minimal, focused, and aligned with the project’s tooling and conventions.

Tooling
- Package manager/runtime: use `bun`. Do not introduce npm/yarn/pnpm lockfiles; keep `bun.lock` as the single source of truth.
- Scripts: `bun run dev` (Turbopack), `bun run build` (Turbopack), `bun run start`.
- Install deps: `bun add <pkg>`; dev deps: `bun add -D <pkg>`; one-off CLIs: `bunx <bin>`.
- shadcn/ui: add components using `bunx --bun shadcn@latest` (do not use `npx`). Place generated files under `src/components/` following shadcn’s structure.
- Lint/format: `bun run lint` and `bun run format` (Biome). Do not change Biome config unless necessary.

Framework (Next.js App Router)
- Source lives under `src/app`. Prefer Server Components by default; add `"use client"` only when required.
- Keep routes, layouts, and metadata consistent with Next.js 15 conventions.
- Use path alias `@/*` for imports from `src/*` (see `tsconfig.json`).
- If adding shared UI, place under `src/components/` (create the folder if missing) and co-locate styles when sensible.

Styling (Tailwind CSS v4)
- Entry CSS: `src/app/globals.css` imports Tailwind via `@import "tailwindcss";` and defines theme tokens.
- Extend theme using Tailwind v4 patterns, e.g. `@theme inline { --color-...: ... }`. Prefer CSS variables for design tokens.
- Avoid introducing a `tailwind.config.*` unless a non-inline theme is truly needed. PostCSS is configured via `@tailwindcss/postcss` — don’t modify unless necessary.
- Use utilities and variants per Tailwind v4. No content scanning config is required in v4’s default setup.

TypeScript & Quality
- TS is `strict: true`. Maintain accurate types and avoid `any` unless justified.
- Biome is the formatter/linter. Run locally before proposing changes; keep rule exceptions minimal.

Running & Verifying
- Dev: `bun run dev` and open `http://localhost:3000`.
- Prod build: `bun run build` then `bun run start`.
- Static assets live in `public/`; global styles in `src/app/globals.css`.

Conventions
- Keep config files (`next.config.ts`, `postcss.config.mjs`, `biome.json`) unchanged unless a change is directly required.
- Update `docs/PLAN.md` when adding notable tasks or decisions; reflect user-facing changes in `README.md`.
- Minimize dependencies; prefer built-in Next.js/Tailwind capabilities.

Notes
- No test framework is configured yet. Propose test setup before adding one.
- If introducing client-side interactivity, ensure it’s in Client Components with `"use client"` and remains SSR/streaming friendly.
