/**
 * Lightweight Product Analytics Tracking Script
 *
 * Usage:
 * <script src="https://your-cdn.com/analytics.js"></script>
 * <script>
 *   Analytics.init({
 *     apiEndpoint: 'https://your-api.execute-api.us-east-1.amazonaws.com/prod',
 *     projectId: 'your-project-id',
 *   });
 * </script>
 */

interface AnalyticsConfig {
  apiEndpoint: string;
  projectId: string;
  userId?: string;
  debug?: boolean;
  trackWebVitals?: boolean;
}

interface TrackEventOptions {
  eventType: string;
  properties?: Record<string, any>;
  userId?: string;
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
  private sessionId: string;
  private anonymousId: string;
  private eventQueue: any[] = [];
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateId();
    this.anonymousId = this.getOrCreateAnonymousId();
  }

  /**
   * Initialize the analytics tracker
   */
  init(config: AnalyticsConfig): void {
    // Check DNT header
    if (this.isDNTEnabled()) {
      logger.info('[Analytics] DNT header detected, tracking disabled');
      return;
    }

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
        referrer: document.referrer,
      },
    });
  }

  /**
   * Identify a user
   */
  identify(userId: string): void {
    if (this.config) {
      this.config.userId = userId;
      this.log('User identified', userId);
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
   * Check if Do Not Track is enabled
   */
  private isDNTEnabled(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      (navigator.doNotTrack === '1' ||
        (window as any).doNotTrack === '1' ||
        (navigator as any).msDoNotTrack === '1')
    );
  }

  /**
   * Send an event to the API
   */
  private sendEvent(options: TrackEventOptions): void {
    if (!this.config) return;

    const event = {
      projectId: this.config.projectId,
      eventType: options.eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: options.userId || this.config.userId,
      anonymousId: this.anonymousId,
      properties: options.properties || {},
      context: this.getContext(),
    };

    this.log('Tracking event', event);

    // Determine endpoint based on event type
    const endpoint = this.getEndpoint(options.eventType);

    // Send via sendBeacon for reliability (works even on page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(event)], {
        type: 'application/json',
      });
      const success = navigator.sendBeacon(endpoint, blob);

      if (!success) {
        this.log('sendBeacon failed, falling back to fetch');
        this.sendViaFetch(endpoint, event);
      }
    } else {
      // Fallback to fetch
      this.sendViaFetch(endpoint, event);
    }
  }

  /**
   * Send event via fetch API
   */
  private sendViaFetch(endpoint: string, event: any): void {
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    if (!this.config) return '';

    const baseUrl = this.config.apiEndpoint.replace(/\/$/, '');

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
   * Get or create anonymous ID (persisted in localStorage)
   */
  private getOrCreateAnonymousId(): string {
    const key = 'analytics_anonymous_id';
    let id = '';

    try {
      id = localStorage.getItem(key) || '';
    } catch (e) {
      // LocalStorage may be blocked
    }

    if (!id) {
      id = this.generateId();
      try {
        localStorage.setItem(key, id);
      } catch (e) {
        // Ignore if can't set
      }
    }

    return id;
  }

  /**
   * Generate a random ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
      logger.info(`[Analytics] ${message}`, data);
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
