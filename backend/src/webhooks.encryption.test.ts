/**
 * Unit tests for AES-256-GCM webhook payload encryption (issue #630).
 * Verifies encrypt/decrypt round-trip and encrypted fireWebhooks delivery.
 */
import {
  deriveEncryptionKey,
  encryptPayload,
  decryptPayload,
  registerWebhook,
  fireWebhooks,
  getDeliveryLogs,
  __resetForTests,
} from "./webhooks";

const SECRET = "test-webhook-secret-32chars-long!!";

beforeEach(() => {
  __resetForTests();
  process.env.WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.WEBHOOK_SECRET;
});

describe("deriveEncryptionKey", () => {
  it("returns a 32-byte Buffer", () => {
    const key = deriveEncryptionKey(SECRET);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("is deterministic for the same secret", () => {
    expect(deriveEncryptionKey(SECRET).toString("hex")).toBe(
      deriveEncryptionKey(SECRET).toString("hex")
    );
  });

  it("produces different keys for different secrets", () => {
    expect(deriveEncryptionKey("secretA").toString("hex")).not.toBe(
      deriveEncryptionKey("secretB").toString("hex")
    );
  });
});

describe("encryptPayload / decryptPayload round-trip", () => {
  it("decrypts to original plaintext", () => {
    const key = deriveEncryptionKey(SECRET);
    const plaintext = JSON.stringify({ event: "loan.approved", loan_id: 1 });
    const { iv, encrypted_payload, auth_tag } = encryptPayload(plaintext, key);
    const recovered = decryptPayload(iv, encrypted_payload, auth_tag, key);
    expect(recovered).toBe(plaintext);
  });

  it("uses a random IV each call", () => {
    const key = deriveEncryptionKey(SECRET);
    const { iv: iv1 } = encryptPayload("hello", key);
    const { iv: iv2 } = encryptPayload("hello", key);
    expect(iv1).not.toBe(iv2);
  });

  it("throws on tampered ciphertext", () => {
    const key = deriveEncryptionKey(SECRET);
    const { iv, encrypted_payload, auth_tag } = encryptPayload("secret", key);
    const tampered = encrypted_payload.replace(/^../, "ff");
    expect(() => decryptPayload(iv, tampered, auth_tag, key)).toThrow();
  });

  it("throws on wrong key", () => {
    const key1 = deriveEncryptionKey("keyA");
    const key2 = deriveEncryptionKey("keyB");
    const { iv, encrypted_payload, auth_tag } = encryptPayload("secret", key1);
    expect(() => decryptPayload(iv, encrypted_payload, auth_tag, key2)).toThrow();
  });
});

describe("registerWebhook with encrypt flag", () => {
  it("defaults to encrypt=false", () => {
    const reg = registerWebhook("https://example.com/hook");
    expect(reg.encrypt).toBe(false);
  });

  it("stores encrypt=true when requested", () => {
    const reg = registerWebhook("https://example.com/hook", true);
    expect(reg.encrypt).toBe(true);
  });
});

describe("fireWebhooks encrypted delivery", () => {
  it("sends encrypted_payload and iv fields when encrypt=true", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;

    registerWebhook("https://example.com/hook", true);
    await fireWebhooks("loan.approved", { loan_id: 99 });
    await new Promise((r) => setImmediate(r));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toHaveProperty("encrypted_payload");
    expect(body).toHaveProperty("iv");
    expect(body).toHaveProperty("auth_tag");
    expect(body).not.toHaveProperty("payload");
  });

  it("encrypted body can be decrypted back to original payload", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;

    registerWebhook("https://example.com/hook", true);
    await fireWebhooks("loan.repaid", { loan_id: 42, amount: 500 });
    await new Promise((r) => setImmediate(r));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const key = deriveEncryptionKey(SECRET);
    const plain = decryptPayload(body.iv, body.encrypted_payload, body.auth_tag, key);
    const parsed = JSON.parse(plain);
    expect(parsed.event).toBe("loan.repaid");
    expect(parsed.payload).toEqual({ loan_id: 42, amount: 500 });
  });

  it("sends plain payload (no encrypted_payload) when encrypt=false", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;

    registerWebhook("https://example.com/hook", false);
    await fireWebhooks("loan.approved", { loan_id: 1 });
    await new Promise((r) => setImmediate(r));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toHaveProperty("payload");
    expect(body).not.toHaveProperty("encrypted_payload");
  });

  it("creates a delivery log entry for encrypted webhook", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;

    registerWebhook("https://example.com/hook", true);
    await fireWebhooks("loan.liquidated", { loan_id: 7 });

    expect(getDeliveryLogs()).toHaveLength(1);
  });
});
