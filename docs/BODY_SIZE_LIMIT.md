# Request Body Size Limit

## Overview
The API enforces size limits on request bodies to prevent DoS attacks and ensure server stability.

## Limits

| Content Type | Default Limit | Configurable |
|--------------|---------------|--------------|
| JSON | 1 MB | `JSON_BODY_LIMIT` |
| URL-encoded | 1 MB | `JSON_BODY_LIMIT` |
| Multipart/form-data | 5 MB | `MULTIPART_BODY_LIMIT` |

## Configuration

### Environment Variables
```bash
# .env
JSON_BODY_LIMIT=1mb          # Maximum size for JSON/URL-encoded payloads
MULTIPART_BODY_LIMIT=5mb     # Maximum size for multipart/form-data uploads
JSON_BODY_LIMIT=500kb
JSON_BODY_LIMIT=2mb
MULTIPART_BODY_LIMIT=10mb
{
  "error": "Payload Too Large",
  "message": "Request body exceeds maximum allowed size of 1 MB"
}
{
  "error": "Payload Too Large",
  "message": "File exceeds maximum allowed size of 5 MB"
}
git status
