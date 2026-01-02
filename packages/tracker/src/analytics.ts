/**
 * Lightweight Product Analytics Tracking Script for SPAs
 *
 * Features:
 * - Automatic SPA route tracking (pushState, replaceState, popstate)
 * - JWT-based authentication (no anonymous tracking)
 * - Web Vitals monitoring (LCP, FID, CLS, TTFB)
 * - Fetch with keepalive for reliable event delivery
 *
 * Usage:
 * <script src="https://your-cdn.com/analytics.js"></script>
 * <script>
 *   Analytics.init({
 *     jwtToken: 'your-jwt-token',
 *     debug: true,
 *   });
 *
 *   // Update token after refresh
 *   Analytics.setToken('new-jwt-token');
 *
 *   // Track custom events
 *   Analytics.track('button_clicked', { buttonId: 'signup' });
 * </script>
 */

// API endpoint - set to your deployed backend
const API_ENDPOINT = 'https://esxx0ecwgi.execute-api.eu-central-1.amazonaws.com/prod';

export interface AnalyticsConfig {
  jwtToken: string;
  debug?: boolean;
  trackWebVitals?: boolean;
}

export interface TrackEventProperties {
  [key: string]: any;
}

interface TrackEventOptions {
  eventType: string;
  properties?: Record<string, any>;
}

interface AnalyticsContext {
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
}

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

class ProductAnalytics {
  private config: AnalyticsConfig | null = null;
  private eventQueue: any[] = [];
  private isInitialized = false;

  constructor() {
    // Session ID removed - no longer needed
  }

  /**
   * Initialize the analytics tracker
   */
  init(config: AnalyticsConfig): void {
    this.config = config;
    this.isInitialized = true;

    this.log('Analytics initialized', config);

    // Track initial page view
    this.trackPageView();

    // Track web vitals if enabled
    if (config.trackWebVitals !== false) {
      this.trackWebVitals();
    }

    // Track page views on navigation (for SPAs)
    if (typeof window !== 'undefined') {
      // Listen for pushState/replaceState
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.trackPageView();
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.trackPageView();
      };

      // Listen for popstate (back/forward)
      window.addEventListener('popstate', () => {
        this.trackPageView();
      });
    }

    // Flush queue on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  /**
   * Track a custom event
   */
  track(eventType: string, properties?: Record<string, any>): void {
    if (!this.isInitialized || !this.config) {
      console.warn('[Analytics] Not initialized. Call Analytics.init() first.');
      return;
    }

    this.sendEvent({
      eventType,
      properties,
    });
  }

  /**
   * Track a page view
   */
  trackPageView(): void {
    if (!this.isInitialized || !this.config) {
      return;
    }

    this.sendEvent({
      eventType: 'pageview',
      properties: {
        url: window.location.href,
        title: document.title,
        path: window.location.pathname,
      },
    });
  }

  /**
   * Update JWT token (e.g., after token refresh)
   */
  setToken(jwtToken: string): void {
    if (this.config) {
      this.config.jwtToken = jwtToken;
      this.log('JWT token updated');
    }
  }

  /**
   * Track Web Vitals (Core Web Vitals + additional metrics)
   */
  private trackWebVitals(): void {
    // Only track web vitals in browsers that support PerformanceObserver
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    // Track Largest Contentful Paint (LCP)
    this.observeWebVital('largest-contentful-paint', (entry: any) => {
      this.sendWebVital('LCP', entry.renderTime || entry.loadTime);
    });

    // Track First Input Delay (FID)
    this.observeWebVital('first-input', (entry: any) => {
      this.sendWebVital('FID', entry.processingStart - entry.startTime);
    });

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observeWebVital('layout-shift', (entry: any) => {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    });

    // Send CLS on page hide
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && clsValue > 0) {
          this.sendWebVital('CLS', clsValue);
        }
      });
    }

    // Track Time to First Byte (TTFB)
    if (typeof performance !== 'undefined' && performance.timing) {
      const ttfb = performance.timing.responseStart - performance.timing.requestStart;
      if (ttfb > 0) {
        this.sendWebVital('TTFB', ttfb);
      }
    }
  }

  /**
   * Observe a web vital using PerformanceObserver
   */
  private observeWebVital(type: string, callback: (entry: PerformanceEntry) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          callback(entry);
        }
      });

      observer.observe({ type, buffered: true } as any);
    } catch (e) {
      // Silently fail if the browser doesn't support this metric
      this.log(`Failed to observe ${type}`, e);
    }
  }

  /**
   * Send a web vital metric
   */
  private sendWebVital(metric: string, value: number): void {
    this.track('webvital', {
      metric,
      value: Math.round(value),
      rating: this.getWebVitalRating(metric, value),
    });
  }

  /**
   * Get web vital rating (good, needs-improvement, poor)
   */
  private getWebVitalRating(metric: string, value: number): string {
    const thresholds: Record<string, [number, number]> = {
      LCP: [2500, 4000],
      FID: [100, 300],
      CLS: [0.1, 0.25],
      TTFB: [800, 1800],
    };

    const [good, poor] = thresholds[metric] || [0, 0];

    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Send an event to the API
   * Uses compressed field names matching Vercel Analytics format
   */
  private sendEvent(options: TrackEventOptions): void {
    if (!this.config) return;

    const ctx = this.getContext();

    // Compressed payload - Vercel Analytics format
    const event: any = {
      en: options.eventType,           // event name
      ts: Date.now(),                  // timestamp
      o: ctx.page.url,                 // origin (full URL)
      r: ctx.page.referrer,            // referrer
      sw: ctx.screen.width,            // screen width
      sh: ctx.screen.height,           // screen height
    };

    // Add event data if properties exist
    if (options.properties && Object.keys(options.properties).length > 0) {
      event.ed = options.properties;   // event data
    }

    this.log('Tracking event', event);

    // Determine endpoint based on event type
    const endpoint = this.getEndpoint(options.eventType);

    // Send via fetch with keepalive
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.jwtToken}`,
      },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch((error) => {
      this.log('Failed to send analytics event:', error);
    });
  }

  /**
   * Get the appropriate endpoint for the event type
   */
  private getEndpoint(eventType: string): string {
    const baseUrl = API_ENDPOINT.replace(/\/$/, '');

    if (eventType === 'pageview') {
      return `${baseUrl}/view`;
    } else if (eventType === 'webvital') {
      return `${baseUrl}/event`;
    } else {
      return `${baseUrl}/event`;
    }
  }

  /**
   * Get context about the current page/session
   */
  private getContext(): AnalyticsContext {
    return {
      page: {
        url: window.location.href,
        title: document.title,
        path: window.location.pathname,
        referrer: document.referrer,
      },
      userAgent: navigator.userAgent,
      locale: navigator.language,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Flush any queued events
   */
  private flush(): void {
    // No-op for now (events are sent immediately)
    // Can be extended to batch events if needed
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config?.debug) {
      console.info(`[Analytics] ${message}`, data);
    }
  }
}

// Export as global singleton
const analytics = new ProductAnalytics();

// Support for module systems and global namespace
if (typeof window !== 'undefined') {
  (window as any).Analytics = analytics;
}

export default analytics;
