import CircuitBreaker from "opossum";
import { fireAlert } from "./alerting";
import { rules } from "./alertRules";
import { pool } from "./connectionPool";
import logger from "./logger";

/**
 * Circuit breaker options:
 * - timeout: 10 seconds for RPC calls
 * - errorThresholdPercentage: 50% error rate triggers opening
 * - resetTimeout: 60 seconds before attempting to close circuit
 * - rollingCountTimeout: 10 seconds window for error calculation
 * - rollingCountBuckets: 10 buckets for rolling window
 * - volumeThreshold: 5 requests minimum before circuit can open
 */
const circuitBreakerOptions = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 60000, // 60 seconds
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  volumeThreshold: 5, // Minimum 5 requests before circuit can open
  name: "stellar-rpc",
};

/**
 * Wrapped RPC methods with connection pooling + retry logic
 */
const rpcMethods = {
  getAccount: async (address: string) => {
    return pool.run((server) => server.getAccount(address));
  },

  prepareTransaction: async (tx: any) => {
    return pool.run((server) => server.prepareTransaction(tx));
  },

  simulateTransaction: async (tx: any) => {
    return pool.run((server) => server.simulateTransaction(tx));
  },

  getHealth: async () => {
    return pool.run((server) => server.getHealth());
  },
};

/**
 * Create circuit breakers for each RPC method
 */
const getAccountBreaker = new CircuitBreaker(
  rpcMethods.getAccount,
  circuitBreakerOptions
);
const prepareTransactionBreaker = new CircuitBreaker(
  rpcMethods.prepareTransaction,
  circuitBreakerOptions
);
const simulateTransactionBreaker = new CircuitBreaker(
  rpcMethods.simulateTransaction,
  circuitBreakerOptions
);
const getHealthBreaker = new CircuitBreaker(
  rpcMethods.getHealth,
  circuitBreakerOptions
);

// Circuit breaker event logging + alerting
[
  getAccountBreaker,
  prepareTransactionBreaker,
  simulateTransactionBreaker,
  getHealthBreaker,
].forEach((breaker) => {
  breaker.on("open", () => {
    logger.error("Circuit breaker opened", { breaker: breaker.name });
    fireAlert(rules.rpcCircuitOpen, `Circuit breaker opened for ${breaker.name}`, {
      breaker: breaker.name,
    });
  });

  breaker.on("halfOpen", () => {
    logger.info("Circuit breaker half-open", { breaker: breaker.name });
  });

  breaker.on("close", () => {
    logger.info("Circuit breaker closed", { breaker: breaker.name });
  });

  breaker.on("fallback", (result: unknown, error: Error) => {
    const msg = error?.message ?? String(result);
    fireAlert(rules.rpcFailure, `RPC call failed: ${msg}`, {
      breaker: breaker.name,
      error: msg,
    });
    logger.warn(`RPC call failed: ${msg}`, { breaker: breaker.name, error: msg });
  });
});

/**
 * RPC client with circuit breaker and retry logic
 */
export const rpcClient = {
  getAccount: (address: string) => getAccountBreaker.fire(address),
  prepareTransaction: (tx: any) => prepareTransactionBreaker.fire(tx),
  simulateTransaction: (tx: any) => simulateTransactionBreaker.fire(tx),
  getHealth: () => getHealthBreaker.fire(),
  
  /**
   * Get circuit breaker states for health check.
   * @returns An object mapping each RPC method to its circuit breaker state.
   */
  getCircuitStates: () => ({
    getAccount: getAccountBreaker.opened ? "open" : "closed",
    prepareTransaction: prepareTransactionBreaker.opened ? "open" : "closed",
    simulateTransaction: simulateTransactionBreaker.opened ? "open" : "closed",
    getHealth: getHealthBreaker.opened ? "open" : "closed",
  }),

  /**
   * Check if any circuit is open.
   * @returns True if all circuit breakers are closed, false if any is open.
   */
  isHealthy: () => {
    return (
      !getAccountBreaker.opened &&
      !prepareTransactionBreaker.opened &&
      !simulateTransactionBreaker.opened &&
      !getHealthBreaker.opened
    );
  },
};

export default rpcClient;
