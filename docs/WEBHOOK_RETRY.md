# Webhook Retry with Exponential Backoff

## Overview
Webhook deliveries are retried with exponential backoff when they fail, ensuring reliable delivery of events.

## Retry Schedule

| Attempt | Delay |
|---------|-------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| 6+ | Permanent failure |

## Implementation

### Retry Service
The `WebhookRetryService` manages the retry lifecycle:

1. **Schedule Delivery** - Create delivery record with first attempt
2. **Process Delivery** - Attempt to deliver, handle success/failure
3. **Retry with Backoff** - If failed, schedule next attempt with exponential delay
4. **Permanent Failure** - After 5 attempts, mark as permanently failed

### Database Schema

```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  webhook_id UUID NOT NULL,
  url TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempt_number INT DEFAULT 1,
  max_attempts INT DEFAULT 5,
  status ENUM('pending', 'success', 'failed', 'permanent_failure'),
  last_error TEXT,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
{
  "success": true,
  "data": [
    {
      "id": "del-001",
      "webhookId": "wh-001",
      "url": "https://example.com/webhook",
      "payload": { "event": "loan.created" },
      "attemptNumber": 3,
      "maxAttempts": 5,
      "status": "pending",
      "lastError": "Connection timeout",
      "nextRetryAt": "2024-01-01T00:00:05.000Z",
      "createdAt": "2024-01-01T00:00:01.000Z",
      "updatedAt": "2024-01-01T00:00:03.000Z"
    }
  ],
  "count": 1
}
{
  "url": "https://example.com/webhook",
  "payload": {
    "event": "loan.created",
    "data": { "loanId": "loan-123" }
  }
}
