# Performance Baselines

This document defines the baseline p95 response times for critical API endpoints.

## Baseline Response Times (p95)

| Endpoint | Method | Baseline p95 (ms) | Threshold (2x) | Description |
|----------|--------|-------------------|----------------|-------------|
| `/api/loan/:id` | GET | 200ms | 400ms | Retrieve loan details by ID |
| `/api/health/:loanId` | GET | 200ms | 400ms | Calculate health factor for a loan |
| `/api/loan/request` | POST | 300ms | 600ms | Request a new loan |

## Test Configuration

- **Concurrent Users**: 50
- **Test Duration**: 30 seconds
- **Failure Threshold**: 2x baseline p95 response time

## Baseline Establishment

These baselines were established under the following conditions:

- **Environment**: Local development
- **Hardware**: Standard development machine
- **Network**: Localhost (no network latency)
- **Database**: Mock Stellar network responses
- **Load**: 50 concurrent connections

## CI/CD Integration

Performance tests run automatically in CI and will fail if:
- Any endpoint's p95 response time exceeds 2x the documented baseline
- Any endpoint returns errors or timeouts

## Updating Baselines

Baselines should be updated when:
1. Significant infrastructure changes are made
2. Optimization work is completed
3. New features are added that affect performance

To update baselines:
1. Run performance tests: `npm run perf:test`
2. Review results in `performance-results/` directory
3. Update baseline values in `performance/benchmarks.js`
4. Update this documentation
5. Commit changes with justification

## Performance Results

Performance test results are stored as CI artifacts in the `performance-results/` directory.
Each run generates a timestamped JSON file with detailed metrics.

## Interpreting Results

- **p50 (median)**: Half of requests complete faster than this
- **p75**: 75% of requests complete faster than this
- **p90**: 90% of requests complete faster than this
- **p95**: 95% of requests complete faster than this (our primary metric)
- **p99**: 99% of requests complete faster than this
- **max**: Slowest request in the test

We use p95 as our primary metric because it represents the experience of most users
while accounting for some outliers.
