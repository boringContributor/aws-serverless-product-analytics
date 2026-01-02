# Analytics Payload Schema

## Compressed Event Format

The tracker sends a compressed payload format similar to Vercel Analytics to minimize bandwidth usage.

### Field Mapping

| Short Key | Full Name | Type | Required | Description | Example |
|-----------|-----------|------|----------|-------------|---------|
| `en` | event_name | string | ✓ | Event type | `"pageview"`, `"button_clicked"`, `"webvital"` |
| `ts` | timestamp | number | ✓ | Unix timestamp in milliseconds | `1767345974789` |
| `o` | origin | string | ✓ | Full page URL | `"https://sauerer.dev/dashboard"` |
| `r` | referrer | string | ✓ | Document referrer URL (can be empty string) | `"https://google.com"` or `""` |
| `sw` | screen_width | number | ✓ | Screen width in pixels | `1920` |
| `sh` | screen_height | number | ✓ | Screen height in pixels | `1080` |
| `ed` | event_data | object | | Optional custom event properties | `{ "buttonId": "signup" }` |

### HTTP Headers

**Authorization Header:**
```
Authorization: Bearer <JWT_TOKEN>
```
The JWT token contains user information and is decoded by the backend.

**User-Agent Header:**
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...
```
The User-Agent is automatically sent by the browser in the HTTP request header and should be extracted on the backend. It is **not included in the payload** to reduce payload size.

## Example Payloads

### Page View Event

```json
{
  "en": "pageview",
  "ts": 1767345974789,
  "o": "https://sauerer.dev/dashboard",
  "r": "https://sauerer.dev/",
  "sw": 1920,
  "sh": 1080
}
```

### Custom Event (Button Click)

```json
{
  "en": "button_clicked",
  "ts": 1767345980123,
  "o": "https://sauerer.dev/dashboard",
  "r": "",
  "sw": 1920,
  "sh": 1080,
  "ed": {
    "buttonId": "signup",
    "location": "header"
  }
}
```

### Web Vital Event

```json
{
  "en": "webvital",
  "ts": 1767345985456,
  "o": "https://sauerer.dev/dashboard",
  "r": "",
  "sw": 1920,
  "sh": 1080,
  "ed": {
    "metric": "LCP",
    "value": 1234,
    "rating": "good"
  }
}
```

## TypeScript Interface (Backend)

```typescript
interface CompressedEvent {
  en: string;          // event name (required)
  ts: number;          // timestamp (required)
  o: string;           // origin - full URL (required)
  r: string;           // referrer (required, can be empty string)
  sw: number;          // screen width (required)
  sh: number;          // screen height (required)
  ed?: Record<string, any>; // optional event data
  sid?: string;        // optional session id (deprecated, kept for backward compatibility)
}
```

**Note**: User-Agent and project/user info should be extracted from the HTTP request headers (Authorization: Bearer JWT), not from the payload.

## API Endpoints

- **Page Views**: `POST /view`
- **Custom Events**: `POST /event`
- **Web Vitals**: `POST /event`

## Size Comparison

### Before (Verbose Format)
```json
{
  "eventType": "pageview",
  "timestamp": 1767345974789,
  "sessionId": "1735819200000-abc123def",
  "properties": {},
  "context": {
    "page": {
      "url": "https://sauerer.dev/dashboard",
      "title": "Dashboard - My App",
      "path": "/dashboard",
      "referrer": ""
    },
    "userAgent": "Mozilla/5.0...",
    "locale": "en-US",
    "screen": {
      "width": 1920,
      "height": 1080
    },
    "timestamp": 1767345974789
  }
}
```
**Size**: ~450 bytes

### After (Compressed Format)
```json
{
  "en": "pageview",
  "ts": 1767345974789,
  "sid": "1735819200000-abc123def",
  "o": "https://sauerer.dev/dashboard",
  "r": "",
  "sw": 1920,
  "sh": 1080
}
```
**Size**: ~200 bytes

**Reduction**: ~56% smaller payload
