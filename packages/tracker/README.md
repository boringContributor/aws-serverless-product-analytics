# Analytics Tracker

Lightweight product analytics tracking script optimized for Single Page Applications (SPAs) with JWT authentication.

## Features

- **SPA Route Tracking**: Automatically tracks page views on route changes using `pushState`, `replaceState`, and `popstate` events
- **JWT Authentication**: All requests include JWT token in Authorization header (no anonymous tracking)
- **Web Vitals**: Automatic monitoring of Core Web Vitals (LCP, FID, CLS, TTFB)
- **Reliable Delivery**: Uses `fetch` with `keepalive` flag for reliable event delivery, even during page unload
- **Lightweight**: Only 4KB minified
- **Privacy-Friendly**: Respects Do Not Track (DNT) headers

## Installation

### Building from source

```bash
bun install
bun run build
```

This creates `dist/analytics.js` which can be served from your CDN.

### Development mode

```bash
bun run dev
```

This watches for changes and rebuilds automatically.

## Usage

### Basic Setup

```html
<script src="https://your-cdn.com/analytics.js"></script>
<script>
  Analytics.init({
    jwtToken: 'your-jwt-token',
    debug: false, // Set to true for console logging
    trackWebVitals: true, // Optional, defaults to true
  });
</script>
```

The API endpoint is built into the tracker and points to:
```
https://esxx0ecwgi.execute-api.eu-central-1.amazonaws.com/prod
```

### Updating JWT Token

If your JWT token expires and needs to be refreshed:

```javascript
Analytics.setToken('new-jwt-token');
```

### Tracking Custom Events

```javascript
// Track button clicks
Analytics.track('button_clicked', {
  buttonId: 'signup',
  location: 'header',
});

// Track form submissions
Analytics.track('form_submitted', {
  formName: 'contact',
  fields: ['name', 'email'],
});

// Track feature usage
Analytics.track('feature_used', {
  feature: 'export',
  format: 'csv',
});
```

### Manual Page View Tracking

Page views are tracked automatically for SPAs, but you can manually track them:

```javascript
Analytics.trackPageView();
```

## Event Data Structure

All events sent to the API include:

```typescript
{
  projectId: string;
  eventType: string;
  timestamp: number;
  sessionId: string;
  properties: Record<string, any>;
  context: {
    page: {
      url: string;
      title: string;
      path: string;
      referrer: string;
    };
    userAgent: string;
    locale: string;
    screen: {
      width: number;
      height: number;
    };
    timestamp: number;
  };
}
```

The JWT token is sent in the `Authorization` header as `Bearer <token>`, which allows your backend to extract user information.

## API Endpoints

The tracker sends events to different endpoints based on event type:

- **Page views**: `POST /view`
- **Custom events**: `POST /event`
- **Web vitals**: `POST /event`

All requests include the JWT token in the Authorization header.

## SPA Integration Examples

### React with React Router

```javascript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Analytics automatically tracks route changes
    // No additional code needed!
  }, [location]);

  return null;
}
```

### Vue Router

```javascript
// No additional setup needed!
// The tracker automatically listens to history changes
```

### Next.js

```javascript
// pages/_app.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Analytics automatically tracks route changes
  }, [router]);

  return <Component {...pageProps} />;
}
```

## Privacy

- **DNT Support**: Automatically disables tracking if Do Not Track header is enabled
- **No Anonymous Tracking**: All users must be authenticated with JWT
- **No Cookies**: Uses session-based tracking without persistent cookies

## Browser Support

- Modern browsers with `fetch` API support
- ES2020+ JavaScript features
- Optional: `PerformanceObserver` for Web Vitals (gracefully degrades)

## Development

### Build Configuration

The build script ([build.js](build.js)) uses esbuild with:

- **IIFE format**: Creates a global `Analytics` object
- **Minification**: Reduces bundle size to ~4KB
- **Tree shaking**: Removes unused code
- **Source maps**: For debugging
- **Pure annotations**: Marks `console.log` and `console.debug` for removal in production

### Adding New Features

1. Edit [src/analytics.ts](src/analytics.ts)
2. Run `bun run dev` for live rebuilding
3. Test in your application
4. Run `bun run build` for production bundle

## License

MIT
