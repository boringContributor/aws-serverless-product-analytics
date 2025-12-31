export interface AnalyticsEvent {
  projectId: string;
  eventType: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: EventContext;
}

export interface EventContext {
  page?: {
    url?: string;
    title?: string;
    path?: string;
    referrer?: string;
  };
  userAgent?: string;
  locale?: string;
  screen?: {
    width?: number;
    height?: number;
  };
  ip?: string;
  receivedAt?: number;
  geo?: GeoContext;
}

/**
 * Database Event - the shape expected by the database
 * This is what the processor should transform AnalyticsEvent into
 */
export interface DatabaseEvent {
  event_id: string;
  project_id: string;
  event_type: string;
  event_time: Date;
  session_id: string | null;
  user_id: string | null;
  anonymous_id: string | null;

  // Page data
  page_url: string | null;
  page_title: string | null;
  page_path: string | null;
  page_referrer: string | null;

  // User agent data (parsed)
  user_agent: string | null;
  browser_name: string | null;
  browser_version: string | null;
  os_name: string | null;
  os_version: string | null;
  device_type: string | null;

  // Screen data
  screen_width: number | null;
  screen_height: number | null;

  // Geo data
  country: string | null;
  city: string | null;
  region: string | null;
  ip_address: string | null;
  locale: string | null;

  // Custom properties (JSON string)
  properties: string | null;
  received_at: Date;
}

export interface GeoContext {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface TimeRange {
  startDate: string; // ISO date string or 'YYYY-MM-DD'
  endDate: string;
}

export interface QueryFilters extends TimeRange {
  projectId: string;
  eventType?: string;
  userId?: string;
  sessionId?: string;
  pagePath?: string;
  country?: string;
}

// Query Results
export interface OverviewMetrics {
  totalEvents: number;
  totalPageviews: number;
  uniqueSessions: number;
  uniqueVisitors: number;
  uniqueUsers: number;
}

export interface PageViewStat {
  path: string;
  title: string | null;
  pageviews: number;
  uniqueSessions: number;
  uniqueVisitors: number;
}

export interface ReferrerStat {
  referrerDomain: string;
  visits: number;
  uniqueSessions: number;
}

export interface DeviceStats {
  devices: Array<{ deviceType: string; count: number; uniqueSessions: number }>;
  browsers: Array<{ browserName: string; browserVersion: string | null; count: number }>;
  operatingSystems: Array<{ osName: string; osVersion: string | null; count: number }>;
}

export interface GeoStat {
  country: string;
  city: string | null;
  pageviews: number;
  uniqueSessions: number;
  uniqueVisitors: number;
}

export interface TimeSeriesPoint {
  time: string; // ISO timestamp
  events: number;
  pageviews: number;
  uniqueSessions: number;
  uniqueVisitors: number;
}

export interface WebVitalMetric {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
}

/**
 * Storage Adapter Interface
 *
 * Implement this interface for any storage backend
 */
export interface StorageAdapter {
  // ============================================
  // WRITE OPERATIONS (for event processor)
  // ============================================

  /**
   * Insert a batch of events into storage
   * Events should already be transformed to the database shape
   */
  insertEvents(events: DatabaseEvent[]): Promise<void>;

  /**
   * Initialize schema/tables (optional, for migration)
   */
  initializeSchema?(): Promise<void>;

  // ============================================
  // READ OPERATIONS (for query API)
  // ============================================

  /**
   * Get overview metrics for a project
   */
  getOverview(filters: QueryFilters): Promise<OverviewMetrics>;

  /**
   * Get top pages by views
   */
  getPageViews(filters: QueryFilters, limit?: number): Promise<PageViewStat[]>;

  /**
   * Get referrer statistics
   */
  getReferrers(filters: QueryFilters, limit?: number): Promise<ReferrerStat[]>;

  /**
   * Get device/browser/OS statistics
   */
  getDeviceStats(filters: QueryFilters): Promise<DeviceStats>;

  /**
   * Get geographic distribution
   */
  getGeoStats(filters: QueryFilters, limit?: number): Promise<GeoStat[]>;

  /**
   * Get time-series data for charts
   */
  getTimeSeries(
    filters: QueryFilters,
    granularity: 'hour' | 'day'
  ): Promise<TimeSeriesPoint[]>;

  /**
   * Get Web Vitals metrics
   */
  getWebVitals(filters: QueryFilters): Promise<WebVitalMetric[]>;

  /**
   * Close connections (cleanup)
   */
  close(): Promise<void>;
}

/**
 * Storage Configuration
 */
export interface StorageConfig {
  type: 'clickhouse' | 'postgres' | 'planetscale' | 'dsql';

  // Common config
  host: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;

  // Type-specific config
  protocol?: 'http' | 'https'; // ClickHouse
  ssl?: boolean; // Postgres
  url?: string; // PlanetScale (connection string)
}
