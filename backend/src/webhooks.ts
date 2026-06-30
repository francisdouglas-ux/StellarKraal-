import crypto from "crypto";

export interface WebhookRegistration {
  id: string;
  url: string;
  /** Per-webhook HMAC-SHA256 secret. Returned once on registration; store securely. */
  secret: string;
  createdAt: number;
}

export interface DeliveryLog {
  webhookId: string;
  event: string;
  payload: object;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  deliveredAt: number | null;
}

// In-memory stores (replace with DB in production)
const webhooks = new Map<string, WebhookRegistration>();
const deliveryLogs: DeliveryLog[] = [];

/**
 * Reset in-memory webhook state for deterministic testing.
 */
export function __resetForTests(): void {
  webhooks.clear();
  deliveryLogs.length = 0;
}

// ── AES-256-GCM encryption helpers ───────────────────────────────────────────

/**
 * Derives a 32-byte AES key from the webhook secret using HKDF-SHA256.
 *
 * @param secret - Webhook secret (arbitrary-length string).
 * @returns 32-byte Buffer suitable for AES-256-GCM.
 */
export function deriveEncryptionKey(secret: string): Buffer {
  return crypto.hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.alloc(0), // empty salt
    Buffer.from("stellarkraal-webhook-encryption", "utf8"),
    32
  );
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * Receivers decrypt with:
 * ```
 * const key = hkdf("sha256", secret, "", "stellarkraal-webhook-encryption", 32);
 * const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
 * decipher.setAuthTag(Buffer.from(authTag, "hex"));
 * const plain = decipher.update(Buffer.from(encrypted_payload, "hex")) + decipher.final();
 * ```
 *
 * @param plaintext - UTF-8 string to encrypt.
 * @param key - 32-byte AES key (from {@link deriveEncryptionKey}).
 * @returns Object containing hex-encoded `iv`, `encrypted_payload`, and `auth_tag`.
 */
export function encryptPayload(
  plaintext: string,
  key: Buffer
): { iv: string; encrypted_payload: string; auth_tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    encrypted_payload: encrypted.toString("hex"),
    auth_tag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext produced by {@link encryptPayload}.
 *
 * @param iv - Hex-encoded 12-byte IV.
 * @param encryptedPayload - Hex-encoded ciphertext.
 * @param authTag - Hex-encoded 16-byte GCM auth tag.
 * @param key - 32-byte AES key.
 * @returns Decrypted UTF-8 string.
 */
export function decryptPayload(
  iv: string,
  encryptedPayload: string,
  authTag: string,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return decipher.update(Buffer.from(encryptedPayload, "hex")).toString("utf8") + decipher.final("utf8");
}

/**
 * Register a new webhook listener.
 *
 * A unique HMAC-SHA256 secret is generated per registration and included in
 * the response. The caller must persist this secret; it is not retrievable
 * after registration. Use it to verify the `X-StellarKraal-Signature` header
 * on every incoming delivery:
 *
 * ```
 * const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
 * const trusted  = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
 * ```
 *
 * @param url - Destination URL for webhook delivery.
 * @returns The registered webhook metadata including the one-time secret.
 * @throws Error if the URL is invalid or unsupported.
 */
export function registerWebhook(url: string, encrypt = false): WebhookRegistration {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Webhook URL must use http or https");
  }
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("hex");
  const reg: WebhookRegistration = { id, url, secret, createdAt: Date.now() };
  webhooks.set(id, reg);
  return reg;
}

/**
 * List all registered webhooks.
 *
 * @returns An array of registered webhook metadata (secret omitted for security).
 */
export function getWebhooks(): Omit<WebhookRegistration, "secret">[] {
  return Array.from(webhooks.values()).map(({ secret: _s, ...rest }) => rest);
}

/**
 * Deregister a webhook by ID.
 *
 * @param id - The unique webhook ID returned at registration time.
 * @returns `true` if the webhook was found and removed, `false` if not found.
 */
export function deleteWebhook(id: string): boolean {
  return webhooks.delete(id);
}

/**
 * Retrieve the current webhook delivery log entries.
 *
 * @returns An array of delivery log entries for recent webhook attempts.
 */
export function getDeliveryLogs(): DeliveryLog[] {
  return deliveryLogs;
}

/**
 * Compute the HMAC-SHA256 signature for a webhook payload.
 *
 * @param payload - Raw JSON string to sign.
 * @param secret  - Per-webhook secret returned at registration time.
 * @returns Signature string in the format `sha256=<hex>`.
 */
function sign(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver an event payload to all registered webhooks.
 * For webhooks registered with `encrypt: true`, the body is AES-256-GCM
 * encrypted and the response includes `encrypted_payload`, `iv`, and
 * `auth_tag` fields instead of a plain `payload`.
 *
 * Each delivery includes an `X-StellarKraal-Signature` header containing
 * `sha256=<hex>` computed with the per-webhook secret. Receivers should verify
 * this header before processing the payload (see {@link registerWebhook}).
 *
 * @param event - The webhook event name.
 * @param payload - Payload object to send in the webhook body.
 * @returns A promise that resolves once delivery attempts are scheduled.
 */
export async function fireWebhooks(event: string, payload: object): Promise<void> {
  const body = JSON.stringify({ event, payload, timestamp: Date.now() });

  for (const wh of webhooks.values()) {
    const signature = sign(body, wh.secret);
    const log: DeliveryLog = {
      webhookId: wh.id,
      event,
      payload,
      attempts: 0,
      lastStatus: null,
      lastError: null,
      deliveredAt: null,
    };
    deliveryLogs.push(log);
    deliver(wh.url, body, signature, log);
  }
}

async function deliver(
  url: string,
  body: string,
  signature: string,
  log: DeliveryLog,
  attempt = 0
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  log.attempts = attempt + 1;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StellarKraal-Signature": signature,
      },
      body,
    });
    log.lastStatus = res.status;
    if (res.ok) {
      log.deliveredAt = Date.now();
      return;
    }
    log.lastError = `HTTP ${res.status}`;
  } catch (err: any) {
    log.lastError = err.message;
    log.lastStatus = null;
  }

  if (attempt + 1 < MAX_ATTEMPTS) {
    const delay = Math.pow(2, attempt) * 1000; // exponential backoff
    setTimeout(() => deliver(url, body, signature, log, attempt + 1), delay);
  }
}
