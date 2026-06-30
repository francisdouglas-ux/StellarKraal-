/**
 * Integration tests for GET /api/v1/transactions (issue #618).
 * Verifies auth enforcement, pagination, and per-user/collateral/loan filtering.
 */
import request from 'supertest';
import app from './index';
import { insertTransaction } from './db/store';

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

const USER_KEY = 'GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6';
const OTHER_KEY = 'GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ';
let testUser: any = { publicKey: USER_KEY };

jest.mock('./middleware/auth', () => ({
  authRouter: require('express').Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    req.user = testUser;
    next();
  },
}));

describe('GET /api/v1/transactions', () => {
  beforeEach(() => {
    testUser = { publicKey: USER_KEY };

    insertTransaction({
      borrower: USER_KEY,
      type: 'loan',
      status: 'completed',
      amount: 500_000,
      loanId: 'loan-1',
      collateralId: 'col-1',
    });
    insertTransaction({
      borrower: USER_KEY,
      type: 'repayment',
      status: 'completed',
      amount: 100_000,
      loanId: 'loan-1',
    });
    insertTransaction({
      borrower: USER_KEY,
      type: 'liquidation',
      status: 'failed',
      amount: 200_000,
      collateralId: 'col-2',
    });
    // transaction for a different user — must never appear in results
    insertTransaction({ borrower: OTHER_KEY, type: 'loan', status: 'completed', amount: 999_999 });
  });

  it('returns 401 when not authenticated', async () => {
    testUser = null;
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  it('returns paginated transactions for the authenticated user only', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(typeof res.body.pageSize).toBe('number');
    res.body.data.forEach((tx: any) => expect(tx.borrower).toBe(USER_KEY));
  });

  it('filters by type', async () => {
    const res = await request(app).get('/api/v1/transactions?type=repayment');
    expect(res.status).toBe(200);
    res.body.data.forEach((tx: any) => expect(tx.type).toBe('repayment'));
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/v1/transactions?status=failed');
    expect(res.status).toBe(200);
    res.body.data.forEach((tx: any) => expect(tx.status).toBe('failed'));
  });

  it('filters by loanId', async () => {
    const res = await request(app).get('/api/v1/transactions?loanId=loan-1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((tx: any) => expect(tx.loanId).toBe('loan-1'));
  });

  it('filters by collateralId', async () => {
    const res = await request(app).get('/api/v1/transactions?collateralId=col-2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((tx: any) => expect(tx.collateralId).toBe('col-2'));
  });

  it('returns 400 for invalid page', async () => {
    const res = await request(app).get('/api/v1/transactions?page=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/page/);
  });

  it('returns 400 for pageSize > 100', async () => {
    const res = await request(app).get('/api/v1/transactions?pageSize=101');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pageSize/);
  });

  it('returns 400 for invalid type', async () => {
    const res = await request(app).get('/api/v1/transactions?type=invalid');
    expect(res.status).toBe(400);
  });

  it('respects pagination parameters', async () => {
    const res = await request(app).get('/api/v1/transactions?page=1&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pageSize).toBe(2);
  });
});
