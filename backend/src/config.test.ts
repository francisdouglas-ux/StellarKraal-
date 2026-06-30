describe('Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let stderrSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.resetModules();
  });

  it('should validate required environment variables', () => {
    delete process.env.RPC_URL;
    delete process.env.CONTRACT_ID;

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('Environment validation failed');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should accept valid environment variables', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.PORT = '3001';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).not.toThrow();
  });

  it('should use default values for optional variables', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    delete process.env.PORT;
    delete process.env.RATE_LIMIT_GLOBAL;

    let config: any;
    jest.isolateModules(() => {
      config = require('./config').config;
    });

    expect(config.PORT).toBe('3001');
    expect(config.RATE_LIMIT_GLOBAL).toBe('60');
  });

  it('should validate URL format for RPC_URL', () => {
    process.env.RPC_URL = 'not-a-valid-url';
    process.env.CONTRACT_ID = 'test-contract-id';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('RPC_URL must be a valid URL');
  });

  it('should validate numeric string format', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.PORT = 'not-a-number';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('PORT must be a valid number');
  });

  it('should validate minimum length for secrets', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.WEBHOOK_SECRET = 'short';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('WEBHOOK_SECRET must be at least 16 characters');
  });

  it('should require JWT_SECRET and WEBHOOK_SECRET in production', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.WEBHOOK_SECRET;

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('Missing required variables for production');
    expect(written).toContain('JWT_SECRET');
    expect(written).toContain('WEBHOOK_SECRET');
  });

  it('should pass in production when JWT_SECRET and WEBHOOK_SECRET are set', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-production-jwt-secret-32-chars!'; // gitleaks:allow
    process.env.WEBHOOK_SECRET = 'a-production-webhook-secret-32!!';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).not.toThrow();
  });

  it('should validate DATABASE_URL format when provided', () => {
    process.env.RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.CONTRACT_ID = 'test-contract-id';
    process.env.DATABASE_URL = 'mysql://localhost/db';

    expect(() => {
      jest.isolateModules(() => {
        require('./config');
      });
    }).toThrow('process.exit called');

    const written = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(written).toContain('DATABASE_URL must start with');
  });
});
