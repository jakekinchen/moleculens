# Codex Agent Guide

This repository is a Next.js TypeScript project. The backend is being migrated from Python FastAPI to Next.js route handlers.

## Agent Setup

-`scripts/setup-agent.sh` is already run before the container is built but just keep in mind that script was previously executed in the current environment.

## Development Workflow

1. Format and lint the code with `npm run format` and `npm run lint`.
2. Build the project with `npm run build` if needed.

### Pull Request Guidelines

- Title format: `[moleculens] <Title>`
- Keep changes small and focused.
- Ensure `npm run lint` passes before opening a PR.

---

# Next.js Backend Migration Plan

## Goal

Consolidate the existing Python FastAPI backend into a TypeScript based backend using Next.js (App Router). All APIs that the frontend currently depends on should be reimplemented as Next.js route handlers. Logic shared across routes will live under a `/lib` directory. Only the endpoints referenced from `api.ts` need to be ported initially.

## Target Folder Layout

```
/ (project root)
├─ app/
│  ├─ api/
│  │  └─ prompt/
│  │     ├─ process/[jobId]/route.ts
│  │     ├─ fetch-molecule-data/route.ts
│  │     ├─ generate-molecule-html/route.ts
│  │     ├─ generate-from-pubchem/route.ts
│  │     ├─ models/route.ts
│  │     └─ generate-molecule-diagram/route.ts
│  └─ ... (React server components/pages)
├─ lib/
│  ├─ jobStore.ts
│  ├─ pubchem.ts
│  ├─ llm.ts
│  ├─ models.ts
│  └─ diagram.ts
└─ ...
```

### app/api

Next.js route handlers inside `app/api` expose HTTP endpoints. Each file should define the HTTP method handlers (e.g. `GET`, `POST`) needed by the frontend.

- **process/[jobId]/route.ts** – `GET` handler used by `pollJobStatus`. Reads job status from `jobStore`.
- **fetch-molecule-data/route.ts** – `POST` handler. Uses `pubchem.ts` helper to retrieve minimal molecule data.
- **generate-molecule-html/route.ts** – `POST` handler. Accepts cached molecule data and returns HTML generated through the helpers in `pubchem.ts`.
- **generate-from-pubchem/route.ts** – `POST` handler. High level utility to fetch data and return a visualization package. Validates non‑scientific prompts via `llm.ts`.
- **models/route.ts** – `GET` handler that returns available model information from `models.ts`.
- **generate-molecule-diagram/route.ts** – `POST` handler for the diagram feature. Uses `diagram.ts` utilities and `llm.ts` to produce an SVG string.

### lib utilities

Reusable logic extracted from the Python code will be translated to TypeScript modules under `lib/`.

- **jobStore.ts** – Minimal in‑memory store for background job information (`status`, `progress`, `result`). Exposes helper functions `createJob`, `updateJob`, `getJob`.
- **pubchem.ts** – Functions to interact with PubChem APIs and to build molecule HTML. Ports the logic from `PubChemAgent`.
- **llm.ts** – Wrapper around the configured LLM. Provides utilities such as `classifyPrompt()` and the generic request function `callLLM()`.
- **models.ts** – Defines the TypeScript interface for `ModelInfo` and a registry of available models. Mirrors the Python `ModelRegistry`.
- **diagram.ts** – Utilities to generate 2‑D diagrams: planning with the LLM and rendering SVG using 2‑D coordinates. Should export `generateDiagram()` used by the route handler.

## Implementation Notes

1. **Keep Types Strict** – Create TypeScript interfaces mirroring the request/response models currently returned by the Python routes so the frontend API layer stays unchanged.
2. **Background Jobs** – For the `process` endpoint the heavy pipeline work should run in a background task (e.g. using `queueMicrotask` or a lightweight job queue). Store intermediate results in `jobStore`.
3. **Environment Variables** – Env variables are already exposed in the container. Use `process.env` to access them in the route handlers. For example, `process.env.PUBCHEM_API_KEY`.
4. **Server Components** – Any server‑side React components that need access to these APIs can import helpers directly from `/lib` or call the route handlers via `fetch`.
5. **Testing** – Unit test helpers under `/lib` with Jest. Route handlers can be tested with Next.js’ built‑in test utilities or supertest.
6. **Future Expansion** – As more Python routes are required, follow the same pattern: create a matching file in `app/api/.../route.ts` and factor shared logic into `lib/`.
