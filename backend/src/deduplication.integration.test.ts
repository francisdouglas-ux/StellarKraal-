/**
 * Integration tests for request deduplication middleware (issue #616).
 * Verifies that identical concurrent POST requests within 5 s return the same
 * cached response, keyed per user (wallet address).
 */
import request from 'supertest';
import app from './index';
import { _resetDeduplicationCache } from './middleware/deduplication';

jest.mock('./utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@stellar/stellar-sdk', () => ({
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  BASE_FEE: '100',
  Contract: jest.fn().mockImplementation(() => ({ call: jest.fn().mockReturnValue({}) })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ toXDR: () => 'mock_xdr' }),
  })),
  Address: jest.fn().mockImplementation(() => ({ toScVal: jest.fn().mockReturnValue({}) })),
  nativeToScVal: jest.fn().mockReturnValue({}),
  scValToNative: jest.fn().mockReturnValue({}),
  xdr: { ScVal: { scvVoid: jest.fn().mockReturnValue({}) } },
  Keypair: {
    fromPublicKey: jest.fn().mockReturnValue({ verify: jest.fn().mockReturnValue(true) }),
  },
  SorobanRpc: {
    Server: jest.fn().mockImplementation(() => ({
      getAccount: jest.fn().mockResolvedValue({ id: 'GABC', sequence: '1' }),
      prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => 'prepared_xdr' }),
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: {} } }),
      getHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
    })),
  },
}));

jest.mock('./jobs/healthFactorJob', () => ({
  scheduleHealthFactorJob: jest.fn(() => ({ stop: jest.fn() })),
  runHealthFactorJob: jest.fn().mockResolvedValue(0),
}));

jest.mock('./jobs/repaymentReminderJob', () => ({
  scheduleRepaymentReminderJob: jest.fn(() => ({ stop: jest.fn() })),
}));

const USER_A = 'GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6';
const USER_B = 'GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ';
let testUser: any = { publicKey: USER_A, role: 'admin' };

jest.mock('./middleware/auth', () => ({
  authRouter: require('express').Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    req.user = testUser;
    next();
  },
}));

describe('Request deduplication middleware', () => {
  beforeEach(() => {
    _resetDeduplicationCache();
    testUser = { publicKey: USER_A, role: 'admin' };
  });

  it('returns X-Deduplicated header for duplicate POST within 5s', async () => {
    const body = { animal_type: 'cattle', count: 5, appraised_value: 500_000 };

    const first = await request(app).post('/api/v1/collateral').send(body);
    expect(first.headers['x-deduplicated']).toBeUndefined();

    const second = await request(app).post('/api/v1/collateral').send(body);
    expect(second.headers['x-deduplicated']).toBe('true');
    expect(second.status).toBe(first.status);
  });

  it('different body hashes are not deduplicated', async () => {
    const body1 = { animal_type: 'cattle', count: 5, appraised_value: 500_000 };
    const body2 = { animal_type: 'goat', count: 3, appraised_value: 200_000 };

    await request(app).post('/api/v1/collateral').send(body1);
    const res = await request(app).post('/api/v1/collateral').send(body2);
    expect(res.headers['x-deduplicated']).toBeUndefined();
  });

  it('different users are not deduplicated against each other', async () => {
    const body = { animal_type: 'cattle', count: 5, appraised_value: 500_000 };

    testUser = { publicKey: USER_A, role: 'admin' };
    await request(app).post('/api/v1/collateral').send(body);

    testUser = { publicKey: USER_B, role: 'admin' };
    const res = await request(app).post('/api/v1/collateral').send(body);
    expect(res.headers['x-deduplicated']).toBeUndefined();
  });

  it('does not deduplicate GET requests', async () => {
    const res1 = await request(app).get('/api/v1/collateral');
    const res2 = await request(app).get('/api/v1/collateral');
    expect(res1.headers['x-deduplicated']).toBeUndefined();
    expect(res2.headers['x-deduplicated']).toBeUndefined();
  });
});
