# API Versioning Strategy

All API routes are prefixed with `/api/v1`. Future breaking changes are introduced under `/api/v2` while v1 is maintained in parallel until a defined sunset date.

## Current versions

| Version | Status  | Base path  |
|---------|---------|------------|
| v1      | Active  | `/api/v1`  |
| v2      | Stub    | `/api/v2`  |

## Version header

Every v1 response includes:

```
API-Version: 1
```

Every v2 response includes:

```
API-Version: 2
```

## v2 stub

`/api/v2` is currently a stub. All requests return `501 Not Implemented`. When a v2 feature is ready, add it to `backend/src/routes/v2.ts` and remove the relevant catch-all handler.

## Route file structure

```
backend/src/routes/
  health.ts      – Health-check endpoints (excluded from auth/rate-limiting)
  v1.ts          – v1 application routes (loans, collateral, admin, …)
  v2.ts          – v2 stub (501 Not Implemented)
```

Application routes that live in `src/index.ts` will be migrated to `src/routes/v1.ts` in a follow-up refactor.

## Adding a new route

1. Add the handler to `backend/src/routes/v1.ts` (or `index.ts` until the migration is complete).
2. Register the route under the `/api/v1/` prefix.
3. Add integration tests in a `*.integration.test.ts` or `*.test.ts` file.
4. Update `backend/openapi.json` to document the new endpoint.

## Deprecation policy

1. Deprecated routes emit a `Deprecation: true` response header with a `Warning` header explaining the replacement.
2. Routes are deprecated for at least **one minor release cycle** before removal.
3. Removal is announced in `CHANGELOG.md` with a migration guide.
