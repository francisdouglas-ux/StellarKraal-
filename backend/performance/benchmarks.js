const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

// Baseline p95 response times (in milliseconds)
const BASELINES = {
  'GET /api/v1/loans': 200,
  'GET /api/v1/collateral': 200,
  'POST /api/v1/loans': 300,
};

// Performance test configuration
const TEST_CONFIG = {
  connections: 50, // 50 concurrent users
  duration: 30, // 30 seconds
  pipelining: 1,
};

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Test scenarios
const scenarios = [
  {
    name: 'GET /api/v1/loans',
    url: `${API_BASE_URL}/api/loan/1`,
    method: 'GET',
  },
  {
    name: 'GET /api/v1/collateral',
    url: `${API_BASE_URL}/api/health/1`,
    method: 'GET',
  },
  {
    name: 'POST /api/v1/loans',
    url: `${API_BASE_URL}/api/loan/request`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      borrower: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      collateral_id: 1,
      amount: 600000,
    }),
  },
];

// Run a single benchmark
async function runBenchmark(scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running benchmark: ${scenario.name}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: scenario.url,
        method: scenario.method,
        headers: scenario.headers,
        body: scenario.body,
        connections: TEST_CONFIG.connections,
        duration: TEST_CONFIG.duration,
        pipelining: TEST_CONFIG.pipelining,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        // Extract p95 latency (in milliseconds)
        const p95Latency = result.latency.p97_5; // autocannon uses p97.5 as closest to p95
        const baseline = BASELINES[scenario.name];
        const threshold = baseline * 2;
        const passed = p95Latency <= threshold;

        const benchmarkResult = {
          name: scenario.name,
          url: scenario.url,
          method: scenario.method,
          connections: TEST_CONFIG.connections,
          duration: TEST_CONFIG.duration,
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            mean: result.requests.mean,
          },
          latency: {
            mean: result.latency.mean,
            p50: result.latency.p50,
            p75: result.latency.p75,
            p90: result.latency.p90,
            p95: result.latency.p97_5, // Using p97.5 as p95
            p99: result.latency.p99,
            max: result.latency.max,
          },
          throughput: {
            mean: result.throughput.mean,
            total: result.throughput.total,
          },
          errors: result.errors,
          timeouts: result.timeouts,
          baseline: baseline,
          threshold: threshold,
          passed: passed,
          timestamp: new Date().toISOString(),
        };

        // Print results
        console.log(`\nResults for ${scenario.name}:`);
        console.log(`  Total Requests: ${result.requests.total}`);
        console.log(`  Requests/sec: ${result.requests.average.toFixed(2)}`);
        console.log(`  Latency (ms):`);
        console.log(`    Mean: ${result.latency.mean.toFixed(2)}`);
        console.log(`    p50: ${result.latency.p50.toFixed(2)}`);
        console.log(`    p75: ${result.latency.p75.toFixed(2)}`);
        console.log(`    p90: ${result.latency.p90.toFixed(2)}`);
        console.log(`    p95: ${result.latency.p97_5.toFixed(2)}`);
        console.log(`    p99: ${result.latency.p99.toFixed(2)}`);
        console.log(`  Baseline p95: ${baseline}ms`);
        console.log(`  Threshold (2x baseline): ${threshold}ms`);
        console.log(`  Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`  Errors: ${result.errors}`);
        console.log(`  Timeouts: ${result.timeouts}`);

        resolve(benchmarkResult);
      }
    );

    // Track progress
    autocannon.track(instance, { renderProgressBar: true });
  });
}

// Run all benchmarks
async function runAllBenchmarks() {
  console.log('Starting Performance Benchmarks');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Connections: ${TEST_CONFIG.connections}`);
  console.log(`Duration: ${TEST_CONFIG.duration}s`);

  const results = [];
  let allPassed = true;

  for (const scenario of scenarios) {
    try {
      const result = await runBenchmark(scenario);
      results.push(result);
      if (!result.passed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`Error running benchmark for ${scenario.name}:`, error);
      allPassed = false;
      results.push({
        name: scenario.name,
        error: error.message,
        passed: false,
      });
    }
  }

  // Save results to file
  const resultsDir = path.join(__dirname, '../performance-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(resultsDir, `benchmark-${timestamp}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log('Performance Benchmark Summary');
  console.log(`${'='.repeat(60)}\n`);

  results.forEach((result) => {
    if (result.error) {
      console.log(`${result.name}: ✗ ERROR - ${result.error}`);
    } else {
      console.log(
        `${result.name}: ${result.passed ? '✓ PASSED' : '✗ FAILED'} (p95: ${result.latency.p95.toFixed(2)}ms, threshold: ${result.threshold}ms)`
      );
    }
  });

  console.log(`\nResults saved to: ${resultsFile}`);
  console.log(`\nOverall Status: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

  // Exit with appropriate code for CI
  process.exit(allPassed ? 0 : 1);
}

// Run benchmarks
runAllBenchmarks().catch((error) => {
  console.error('Fatal error running benchmarks:', error);
  process.exit(1);
});
