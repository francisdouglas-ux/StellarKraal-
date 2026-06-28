import CircuitBreaker from "opossum";
import { fireAlert } from "./alerting";
import { rules } from "./alertRules";
import { pool } from "./connectionPool";
import logger from "./logger";
import { getCorrelationId } from "./correlationContext";

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
 * Wrapped RPC methods with connection pooling + retry logic.
 * correlationId from AsyncLocalStorage is included in structured logs
 * and forwarded as X-Correlation-ID metadata on each RPC call.
 */
const rpcMethods = {
  getAccount: async (address: string) => {
    const correlationId = getCorrelationId();
    logger.debug("RPC getAccount", { address, correlationId });
    return pool.run((server) => server.getAccount(address));
  },

  prepareTransaction: async (tx: any) => {
    const correlationId = getCorrelationId();
    logger.debug("RPC prepareTransaction", { correlationId });
    return pool.run((server) => server.prepareTransaction(tx));
  },

  simulateTransaction: async (tx: any) => {
    const correlationId = getCorrelationId();
    logger.debug("RPC simulateTransaction", { correlationId });
    return pool.run((server) => server.simulateTransaction(tx));
  },

  getHealth: async () => {
    const correlationId = getCorrelationId();
    logger.debug("RPC getHealth", { correlationId });
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
    logger.error("Circuit breaker opened", { breaker: breaker.name, correlationId: getCorrelationId() });
    fireAlert(rules.rpcCircuitOpen, `Circuit breaker opened for ${breaker.name}`, {
      breaker: breaker.name,
    });
  });

  breaker.on("halfOpen", () => {
    logger.info("Circuit breaker half-open", { breaker: breaker.name, correlationId: getCorrelationId() });
  });

  breaker.on("close", () => {
    logger.info("Circuit breaker closed", { breaker: breaker.name, correlationId: getCorrelationId() });
  });

  breaker.on("failure", (error: Error) => {
    const correlationId = getCorrelationId();
    fireAlert(rules.rpcFailure, `RPC call failed: ${error.message}`, {
      breaker: breaker.name,
      error: error.message,
    });
    logger.warn(`RPC call failed: ${error.message}`, { breaker: breaker.name, error: error.message, correlationId });
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
   * Get circuit breaker states for health check
   */
  getCircuitStates: () => ({
    getAccount: getAccountBreaker.opened ? "open" : "closed",
    prepareTransaction: prepareTransactionBreaker.opened ? "open" : "closed",
    simulateTransaction: simulateTransactionBreaker.opened ? "open" : "closed",
    getHealth: getHealthBreaker.opened ? "open" : "closed",
  }),

  /**
   * Check if any circuit is open
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
