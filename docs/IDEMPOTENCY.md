# Idempotency for Loan Creation

## Overview
The `POST /api/v1/loans` endpoint supports idempotency to prevent duplicate loan creation when clients retry requests.

## How It Works

1. **Client includes `Idempotency-Key` header** in the request
2. **Server stores the response** for that key for 24 hours
3. **If the same key is used again**, the server returns the original response

## Request Format

### Headers
{
  "success": true,
  "data": {
    "id": "loan-123",
    "amount": 1000,
    "collateralId": "col-001",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Loan created successfully"
}
{
  "success": true,
  "data": {
    "id": "loan-123",
    "amount": 1000,
    "collateralId": "col-001",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Loan created successfully"
}
{
  "error": "Missing Required Header",
  "message": "Idempotency-Key header is required for POST /api/v1/loans"
}
{
  "error": "Invalid Header",
  "message": "Idempotency-Key must be a non-empty string"
}
# First request
curl -X POST /api/v1/loans \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: my-unique-key-001" \
  -d '{"amount":1000,"collateralId":"col-001"}'

# Second request (same key) - returns original response
curl -X POST /api/v1/loans \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: my-unique-key-001" \
  -d '{"amount":1000,"collateralId":"col-001"}'
curl -X POST /api/v1/loans \
  -H "Authorization: Bearer <token>" \
  -d '{"amount":1000,"collateralId":"col-001"}'
# Returns 422 with error message
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
