# Docker Guide

This guide explains the Docker Compose setup for StellarKraal, covering each service, volume configuration, and common workflows.

## Services

The `docker-compose.yml` file defines six services:

### `contract-builder`

Compiles the Soroban smart contract to WebAssembly (WASM).

- **Image:** `rust:1.78`
- **Role:** Runs `cargo build` targeting `wasm32-unknown-unknown` to produce the contract binary. This is a one-shot build step, not a long-running server.
- **Resource limits:** 1 CPU / 1 GB RAM (compilation is CPU-intensive).

### `backend`

The Node.js + Express API server.

- **Image:** Built from `./backend/Dockerfile` (multi-stage, `node:20-alpine`)
- **Port:** `3001`
- **Health check:** `GET http://localhost:3001/api/health` — checked every 30 s with a 15 s start grace period.
- **Logs:** JSON-file driver with the tag `backend`, consumed by Promtail.

### `frontend`

The Next.js web application.

- **Image:** Built from `./frontend/Dockerfile` (multi-stage, `node:20-alpine`)
- **Port:** `3000`
- **Dependency:** Waits for `backend` to report `healthy` before starting (`depends_on: condition: service_healthy`).
- **Health check:** `GET http://localhost:3000` — checked every 30 s with a 20 s start grace period.
- **Logs:** JSON-file driver with the tag `frontend`, consumed by Promtail.

### `loki`

Log aggregation backend.

- **Image:** `grafana/loki:2.9.4`
- **Port:** `3100`
- **Role:** Receives log streams pushed by Promtail and stores them for querying in Grafana.

### `promtail`

Log collector and shipper.

- **Image:** `grafana/promtail:2.9.4`
- **Role:** Reads container logs via the Docker socket, labels them by service name and container, and pushes them to Loki.
- **Mounts:**
  - `/var/lib/docker/containers` (read-only) — raw container log files.
  - `/var/run/docker.sock` (read-only) — Docker service discovery.
  - `./observability/promtail-config.yml` — scrape and pipeline configuration.
- **Dependency:** Starts after `loki`.

### `grafana`

Metrics and log visualisation dashboard.

- **Image:** `grafana/grafana:10.4.2`
- **Port:** `3200` (mapped from internal port 3000)
- **Role:** Provides pre-provisioned dashboards for backend metrics and container logs, sourced from Loki.
- **Anonymous access:** Enabled with `Viewer` role so no login is required locally.
- **Dependency:** Starts after `loki`.

## Volumes

| Volume | Used by | Purpose |
|---|---|---|
| `cargo-cache` | `contract-builder` | Caches downloaded Rust crate registry between builds, avoiding repeated downloads. |
| `loki-data` | `loki` | Persists log data across container restarts. |
| `grafana-data` | `grafana` | Persists Grafana state (dashboards, preferences) across restarts. |

The SQLite database file (`backend/dev.sqlite3`) is **not** a named volume — it lives on the host filesystem at `./backend/dev.sqlite3` and is accessed directly by the backend container via the bind mount in the build context.

## Service dependency graph

```
contract-builder   (independent)
backend            (independent)
frontend           → backend (healthy)
loki               (independent)
promtail           → loki
grafana            → loki
```

## Common workflows

### Build and start the full stack

```bash
docker compose up --build
```

Add `-d` to run in the background:

```bash
docker compose up --build -d
```

### Start without rebuilding images

```bash
docker compose up -d
```

### Stop all services

```bash
docker compose down
```

### Rebuild a single service image

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

### View logs

All services:

```bash
docker compose logs -f
```

A specific service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Check service health and status

```bash
docker compose ps
```

Inspect the health status of a specific container:

```bash
docker inspect stellarkraal-backend-1 --format '{{.State.Health.Status}}'
```

## Running a subset of services

Start only the backend and its observability stack (no frontend, no contract builder):

```bash
docker compose up -d backend loki promtail grafana
```

Start only the application services (no observability):

```bash
docker compose up -d backend frontend
```

Run the contract builder once and exit:

```bash
docker compose run --rm contract-builder
```

## Resetting the database for a clean state

The SQLite database is stored at `./backend/dev.sqlite3` on the host. To wipe it and start fresh:

1. Stop the backend:

   ```bash
   docker compose stop backend
   ```

2. Delete the database file:

   ```bash
   rm backend/dev.sqlite3
   ```

3. Restart the backend (migrations run automatically on startup):

   ```bash
   docker compose up -d backend
   ```

To also clear the Loki log history and Grafana state, remove the named volumes:

```bash
docker compose down -v
```

> **Warning:** `docker compose down -v` deletes all named volumes (`cargo-cache`, `loki-data`, `grafana-data`). The Rust crate cache will be re-downloaded on the next build.

## Health checks

| Service | Endpoint | Interval | Timeout | Retries | Start period |
|---|---|---|---|---|---|
| `backend` | `GET http://localhost:3001/api/health` | 30 s | 10 s | 3 | 15 s |
| `frontend` | `GET http://localhost:3000` | 30 s | 10 s | 3 | 20 s |

The `frontend` service uses `condition: service_healthy` so it only starts after the backend passes its health check.

## Compose file variants

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local development (default) |
| `docker-compose.staging.yml` | Staging overrides — apply on top of the base file |
| `docker-compose.prod.yml` | Production overrides |
| `docker-compose.test.yml` | Integration test environment |

To run the staging stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

## Troubleshooting

- **Port already in use:** Another process is using 3000, 3001, 3100, or 3200. Stop it or change the host port in `docker-compose.yml`.
- **Frontend stuck waiting for backend:** The backend health check is failing. Run `docker compose logs backend` to diagnose.
- **Stale build cache:** Force a clean rebuild with `docker compose build --no-cache`.
- **Contract build fails:** Ensure the `cargo-cache` volume is intact. If corrupted, remove it with `docker volume rm stellarkraal-_cargo-cache` and rebuild.
