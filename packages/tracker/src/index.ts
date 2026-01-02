/**
 * @analytics/tracker
 *
 * ESM module export for framework usage
 */

// Re-export the analytics instance from analytics.ts
export { default, default as analytics } from './analytics';

// Re-export types
export type { AnalyticsConfig, TrackEventProperties } from './analytics';

// Convenience exports for direct function calls
import analytics from './analytics';

export const init = (config: import('./analytics').AnalyticsConfig): void => {
  analytics.init(config);
};

export const track = (eventType: string, properties?: import('./analytics').TrackEventProperties): void => {
  analytics.track(eventType, properties);
};

export const trackPageView = (): void => {
  analytics.trackPageView();
};

export const setToken = (jwtToken: string): void => {
  analytics.setToken(jwtToken);
};
