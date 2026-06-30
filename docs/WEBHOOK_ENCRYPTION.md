# Webhook Payload Encryption

## Overview

Webhook consumers that handle sensitive data can opt into AES-256-GCM payload encryption by setting `encrypt: true` during registration.

## Security threat model

Without encryption, webhook payloads are protected in transit by HTTPS but are readable by anyone who gains access to the request body (e.g., a compromised intermediary proxy, logging middleware, or misconfigured CDN). Payload encryption ensures that only a receiver who holds the shared webhook secret can read the payload — forward secrecy at the application layer.

## Registering an encrypted webhook

```http
POST /api/v1/webhooks
Content-Type: application/json

{ "url": "https://your-server.example.com/hook", "encrypt": true }
```

Response includes `encrypt: true` and the webhook `id`.

## Encrypted delivery format

When `encrypt: true`, the delivered body contains:

```json
{
  "event": "loan.approved",
  "encrypted_payload": "<hex-encoded ciphertext>",
  "iv": "<hex-encoded 12-byte IV>",
  "auth_tag": "<hex-encoded 16-byte GCM auth tag>",
  "timestamp": 1234567890000
}
```

The `payload` field is **not** present in encrypted deliveries.

## Key derivation

The encryption key is derived from your `WEBHOOK_SECRET` environment variable using **HKDF-SHA256**:

```
key = HKDF(
  hash   = SHA-256,
  IKM    = WEBHOOK_SECRET (UTF-8 bytes),
  salt   = "" (empty),
  info   = "stellarkraal-webhook-encryption" (UTF-8),
  length = 32 bytes
)
```

## Decrypting in Node.js

```js
const crypto = require("crypto");

function deriveKey(secret) {
  return crypto.hkdfSync("sha256", Buffer.from(secret), Buffer.alloc(0),
    Buffer.from("stellarkraal-webhook-encryption"), 32);
}

function decrypt(body, secret) {
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm", key, Buffer.from(body.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(body.auth_tag, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(body.encrypted_payload, "hex")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8"));
}

// Usage
const payload = decrypt(req.body, process.env.WEBHOOK_SECRET);
console.log(payload.event, payload.payload);
```

## Decrypting in Python

```python
import os, json
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def derive_key(secret: str) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"",
                info=b"stellarkraal-webhook-encryption").derive(secret.encode())

def decrypt(body: dict, secret: str) -> dict:
    key = derive_key(secret)
    aesgcm = AESGCM(key)
    iv = bytes.fromhex(body["iv"])
    ct_tag = bytes.fromhex(body["encrypted_payload"]) + bytes.fromhex(body["auth_tag"])
    plain = aesgcm.decrypt(iv, ct_tag, None)
    return json.loads(plain)
```
