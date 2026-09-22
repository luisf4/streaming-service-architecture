# 0006 - Frontend talks to the backend only through OpenAPI-derived types

## Status

Accepted (decided in PLAN.md: "Front não importa nada do backend").

## Context

`frontend/web` needs typed request/response shapes for `upload-api` and
`stream-api`. The easy path in a TypeScript monorepo is importing DTOs
straight from `backend/apps/*/src`. That easy path also means the
frontend's build now depends on NestJS, Prisma-derived types, and every
transitive dependency those carry - and a refactor inside a backend
service's *internal* types can break the frontend even when the actual
HTTP contract didn't change.

## Decision

The only thing that crosses the boundary is HTTP, described as OpenAPI.
Both `upload-api` and `stream-api` expose their OpenAPI document via
`@nestjs/swagger` at `/docs-json`
(`backend/apps/{upload,stream}-api/src/main.ts`); the frontend's
`generate:api-types` script points `openapi-typescript` at those live
endpoints to produce type-only files. `frontend/web/src/lib/api-types.ts`
and `api-client.ts` are the actual contract surface the rest of the
frontend code imports from - never a backend package.

## Consequences

- **Not exercised end to end in this environment.** No backend service
  could be booted here (no RabbitMQ/Postgres/S3 available), so
  `api-types.ts` is hand-written to match the current DTOs exactly rather
  than machine-generated from a live `/docs-json` - the file says so at
  the top. Running `pnpm run generate:api-types` against a real running
  stack is a real follow-up, not optional polish: it's the only way to
  catch a DTO/type drift automatically instead of manually.
- The frontend's `package.json` has zero dependency on any
  `@video-streaming/*` backend package - `pnpm why @video-streaming/database`
  from `frontend/web` finds nothing. That boundary is what makes "redeploy
  the frontend without touching the backend" (and vice versa) actually true.
- A backend DTO field rename is a silent break until someone regenerates
  types and the frontend fails to compile - there's no CI step wiring
  "backend OpenAPI changed" to "regenerate and typecheck the frontend"
  yet.
