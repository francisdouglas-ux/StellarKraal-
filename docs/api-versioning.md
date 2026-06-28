# API Versioning Policy

StellarKraal exposes versioned REST endpoints under `/api/v1/`. This document defines when a new version is introduced, how breaking changes are handled, and how clients should migrate.

## Version scheme

| Layer | Format | Example | Source of truth |
|-------|--------|---------|-----------------|
| URL path | `v{N}` | `/api/v1/loan/request` | Route mount in `backend/src/routes/v1.ts` |
| OpenAPI `info.version` | SemVer (`MAJOR.MINOR.PATCH`) | `1.0.0` | `backend/package.json` (synced via `npm run openapi:sync`) |
| Response envelope | `api_version` field | `"v1"` | Version router middleware |

The URL version (`v1`) is the **compatibility boundary**. The OpenAPI `info.version` tracks the **release** of the spec and backend package; a patch bump does not require a new URL version.

## Breaking vs non-breaking changes

### Non-breaking (safe within the same URL version)

- Adding optional request fields
- Adding new response fields
- Adding new endpoints
- Adding new query parameters (optional)
- Bug fixes that restore documented behaviour
- Performance improvements with identical contracts

### Breaking (requires a new URL version, e.g. `/api/v2/`)

- Removing or renaming fields in request or response bodies
- Changing field types (e.g. `string` → `number`)
- Changing required fields (making optional fields required, or removing required fields)
- Changing HTTP methods or URL paths
- Changing authentication requirements
- Changing error response shapes clients depend on
- Changing pagination defaults in a way that breaks existing clients

When a breaking change is unavoidable, ship it in a new router (`v2.ts`) backed by shared service modules. The v1 router remains available until the deprecation window closes.

## Deprecation timeline

1. **Announce** — Add `Deprecation: true` and `Sunset: <HTTP-date>` headers to affected endpoints. Document the change in the migration guide (see below).
2. **Dual-run** — Maintain both old and new behaviour (or redirect unversioned paths to v1) for at least **6 months**.
3. **Sunset** — After the `Sunset` date, remove the deprecated endpoint or return `410 Gone`.

### Standard headers

| Header | Value | Meaning |
|--------|-------|---------|
| `Deprecation` | `true` | Endpoint is deprecated; migrate to the replacement |
| `Sunset` | HTTP-date (RFC 7231) | Last day the endpoint is guaranteed to work |
| `Warning` | `299 - "message"` | Human-readable guidance for developers |
| `Link` | `<url>; rel="successor-version"` | Optional pointer to the replacement endpoint |

Example middleware usage:

```typescript
import { deprecationHeaders, deprecationHeadersWhen } from "../middleware/deprecation";

// Always deprecated
router.get(
  "/legacy-endpoint",
  deprecationHeaders({
    sunset: new Date("2026-12-31T23:59:59Z"),
    warning: "Use GET /api/v1/loans?page=1&pageSize=20 instead.",
    link: "</api/v1/loans>; rel=\"successor-version\"",
  }),
  handler
);

// Conditionally deprecated (e.g. unpaginated listing)
router.get(
  "/loans",
  deprecationHeadersWhen(
    (req) => !req.query.page && !req.query.pageSize && !req.query.limit,
    {
      sunset: new Date("2026-12-31T23:59:59Z"),
      warning: "Unpaginated loan listing is deprecated; use ?page=1&pageSize=20",
    }
  ),
  handler
);
```

## Migration guide format

When introducing `/api/v2/` (or deprecating v1 endpoints), publish a migration guide at `docs/migrations/v1-to-v2.md` with this structure:

```markdown
# Migrating from API v1 to v2

## Overview
- Release date: YYYY-MM-DD
- v1 sunset date: YYYY-MM-DD
- Breaking changes summary (1–3 sentences)

## Endpoint mapping

| v1 | v2 | Notes |
|----|----|-------|
| POST /api/v1/loan/request | POST /api/v2/loans | `collateral_id` → `collateral_ids[]` |

## Request/response diffs
(per changed endpoint: before/after JSON examples)

## Client checklist
- [ ] Update base URL to `/api/v2`
- [ ] Update field names per mapping table
- [ ] Handle new error codes
- [ ] Remove reliance on deprecated headers/endpoints
```

## Architecture for multi-version support

Route handlers in `backend/src/routes/v1.ts` (and future `v2.ts`) should be thin HTTP adapters. Business logic lives in service modules:

```
backend/src/
  routes/
    v1.ts          ← HTTP: validation, status codes, headers
    v2.ts          ← future versioned router
  services/
    loanService.ts
    collateralService.ts
```

A v2 router reuses the same services and only changes request/response mapping, making version upgrades incremental rather than a full rewrite.

## Client guidance

1. **Always call versioned URLs** — Use `/api/v1/...` instead of unversioned `/api/...`. Unversioned routes redirect with `Deprecation` headers.
2. **Ignore unknown response fields** — Forward-compatible clients must tolerate new JSON keys.
3. **Watch response headers** — Log `Deprecation`, `Sunset`, and `Warning` in development; alert on them in production integrations.
4. **Pin integration tests** to the URL version, not only the OpenAPI package version.

## Changelog

API-level changes are recorded in the repository CHANGELOG (when present) and reflected in OpenAPI `info.version` bumps. Patch releases document non-breaking fixes; minor releases document additive changes; major URL version bumps document breaking migrations.
