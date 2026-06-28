# Collateral Endpoint Pagination

## Overview
The `GET /api/v1/collateral` endpoint supports cursor-based pagination to efficiently handle large result sets.

## Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 20 | 100 | Number of records to return per page |
| `cursor` | string | - | - | Pagination cursor for fetching next page |

## Usage

### First Request
{
  "collateral": [...],
  "nextCursor": null,
  "limit": 20
}
{
  "error": "Invalid Parameter",
  "message": "limit must be between 1 and 100"
}
{
  "error": "Unauthorized",
  "message": "User not authenticated"
}
{
  "createdAt": "2024-01-01T00:00:00.000Z",
  "id": "123"
}
