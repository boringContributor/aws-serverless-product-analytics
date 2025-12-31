# Tracking Script

Lightweight client-side analytics tracking library.

## Features

- Auto-tracks page views
- Manual event tracking API
- Session tracking
- Anonymous user tracking (persisted in localStorage)
- Single-page application support
- Uses `navigator.sendBeacon()` for reliability

## Build

```bash
pnpm build
```

Output: `dist/analytics.js` (~3KB minified)

## Usage

```html
<script src="dist/analytics.js"></script>
<script>
  Analytics.init({
    apiEndpoint: 'https://your-api.com/events',
    projectId: 'my-project',
    debug: true
  });

  // Track custom event
  Analytics.track('button_clicked', { button: 'signup' });

  // Identify user
  Analytics.identify('user-123');
</script>
```

## API

### `Analytics.init(config)`

Initialize the tracker.

**Parameters:**
- `config.apiEndpoint` (string, required): API endpoint URL
- `config.projectId` (string, required): Your project identifier
- `config.userId` (string, optional): User ID if known
- `config.debug` (boolean, optional): Enable console logging

### `Analytics.track(eventType, properties)`

Track a custom event.

**Parameters:**
- `eventType` (string): Event name (e.g., 'button_clicked')
- `properties` (object, optional): Event properties

### `Analytics.trackPageView()`

Manually track a page view. Called automatically on init and navigation.

### `Analytics.identify(userId)`

Associate a user ID with future events.

**Parameters:**
- `userId` (string): User identifier

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev
```
