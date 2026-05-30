# Performance Testing

This directory contains performance benchmarking tools for the StellarKraal API.

## Overview

Performance tests use [autocannon](https://github.com/mcollina/autocannon) to simulate load and measure response times for critical API endpoints.

## Running Tests

### Prerequisites

1. Start the API server:
   ```bash
   npm run dev
   # or
   npm start
   ```

2. Ensure the server is running on `http://localhost:3001` (or set `API_URL` environment variable)

### Run Performance Tests

```bash
npm run perf:test
```

This will:
- Run load tests against all configured endpoints
- Simulate 50 concurrent users for 30 seconds
- Measure latency percentiles (p50, p75, p90, p95, p99)
- Compare p95 latency against documented baselines
- Fail if any endpoint exceeds 2x baseline
- Save results to `performance-results/` directory

### Environment Variables

- `API_URL`: Base URL of the API (default: `http://localhost:3001`)

## Test Configuration

Tests are configured in `benchmarks.js`:

- **Connections**: 50 concurrent users
- **Duration**: 30 seconds per endpoint
- **Pipelining**: 1 (no request pipelining)

## Endpoints Tested

1. **GET /api/loan/:id** - Retrieve loan details
   - Baseline p95: 200ms
   - Threshold: 400ms

2. **GET /api/health/:loanId** - Calculate health factor
   - Baseline p95: 200ms
   - Threshold: 400ms

3. **POST /api/loan/request** - Request new loan
   - Baseline p95: 300ms
   - Threshold: 600ms

## Understanding Results

### Metrics

- **Requests/sec**: Throughput (higher is better)
- **Latency percentiles**:
  - **p50 (median)**: Half of requests complete faster
  - **p75**: 75% of requests complete faster
  - **p90**: 90% of requests complete faster
  - **p95**: 95% of requests complete faster (primary metric)
  - **p99**: 99% of requests complete faster
  - **max**: Slowest request

### Pass/Fail Criteria

Tests pass if:
- p95 latency ≤ 2x baseline
- No errors or timeouts

Tests fail if:
- p95 latency > 2x baseline
- Errors or timeouts occur

## CI Integration

Performance tests run automatically in CI on:
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

Results are:
- Uploaded as CI artifacts (retained for 30 days)
- Posted as PR comments (for pull requests)
- Used to fail CI if thresholds are exceeded

## Updating Baselines

When performance improves or infrastructure changes:

1. Run tests: `npm run perf:test`
2. Review results in `performance-results/`
3. Update baselines in `benchmarks.js`
4. Update `BASELINES.md` documentation
5. Commit with justification

## Troubleshooting

### Server not responding

Ensure the API server is running:
```bash
curl http://localhost:3001/api/health/1
```

### High latency

Check:
- Server resource usage (CPU, memory)
- Network conditions
- Database/external service latency
- Concurrent processes

### Inconsistent results

Performance can vary due to:
- System load
- Network conditions
- Background processes
- Hardware differences

Run tests multiple times and compare trends.

## Best Practices

1. **Run on consistent hardware** for comparable results
2. **Close unnecessary applications** during testing
3. **Run multiple times** to establish trends
4. **Test in isolation** (no other load on the system)
5. **Document changes** when updating baselines
6. **Monitor trends** over time, not just single runs
