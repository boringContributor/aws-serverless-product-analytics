/**
 * Amazon DSQL Storage Adapter
 */

import { AuroraDSQLPool } from '@aws/aurora-dsql-node-postgres-connector';
import type {
  StorageAdapter,
  StorageConfig,
  DatabaseEvent,
  QueryFilters,
  OverviewMetrics,
  PageViewStat,
  ReferrerStat,
  DeviceStats,
  GeoStat,
  TimeSeriesPoint,
  WebVitalMetric,
} from '../types';

export class DSQLAdapter implements StorageAdapter {
  private pool: AuroraDSQLPool;

  constructor(config: StorageConfig) {
    this.pool = new AuroraDSQLPool({
      host: config.host,
      user: config.username || 'admin',
      max: 3,
      idleTimeoutMillis: 60000,
    });

  }

  async insertEvents(events: DatabaseEvent[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Use a transaction for batch insert
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO events (
          event_id, project_id, event_type, event_time, session_id, user_id, anonymous_id,
          page_url, page_title, page_path, page_referrer,
          user_agent, browser_name, browser_version, os_name, os_version, device_type,
          screen_width, screen_height,
          country, city, region, ip_address, locale,
          properties, received_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26
        )
      `;

      for (const event of events) {
        await client.query(insertQuery, [
          event.event_id,
          event.project_id,
          event.event_type,
          event.event_time,
          event.session_id,
          event.user_id,
          event.anonymous_id,
          event.page_url,
          event.page_title,
          event.page_path,
          event.page_referrer,
          event.user_agent,
          event.browser_name,
          event.browser_version,
          event.os_name,
          event.os_version,
          event.device_type,
          event.screen_width,
          event.screen_height,
          event.country,
          event.city,
          event.region,
          event.ip_address,
          event.locale,
          event.properties,
          event.received_at,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async getOverview(filters: QueryFilters): Promise<OverviewMetrics> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE event_type = 'pageview') as total_pageviews,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT anonymous_id) as unique_visitors,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
      ]);

      const row = result.rows[0] || {};

      return {
        totalEvents: Number(row.total_events || 0),
        totalPageviews: Number(row.total_pageviews || 0),
        uniqueSessions: Number(row.unique_sessions || 0),
        uniqueVisitors: Number(row.unique_visitors || 0),
        uniqueUsers: Number(row.unique_users || 0),
      };
    } finally {
      client.release();
    }
  }

  async getPageViews(filters: QueryFilters, limit: number = 20): Promise<PageViewStat[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          page_path as path,
          MAX(page_title) as title,
          COUNT(*) as pageviews,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT anonymous_id) as unique_visitors
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND page_path IS NOT NULL
        GROUP BY page_path
        ORDER BY pageviews DESC
        LIMIT $4
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
        limit,
      ]);

      return result.rows.map((row: any) => ({
        path: row.path,
        title: row.title,
        pageviews: Number(row.pageviews),
        uniqueSessions: Number(row.unique_sessions),
        uniqueVisitors: Number(row.unique_visitors),
      }));
    } finally {
      client.release();
    }
  }

  async getReferrers(filters: QueryFilters, limit: number = 20): Promise<ReferrerStat[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          CASE
            WHEN page_referrer ~ '^https?://([^/]+)' THEN
              substring(page_referrer from '^https?://([^/]+)')
            ELSE page_referrer
          END as referrer_domain,
          COUNT(*) as visits,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND page_referrer != ''
          AND page_referrer IS NOT NULL
        GROUP BY referrer_domain
        ORDER BY visits DESC
        LIMIT $4
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
        limit,
      ]);

      return result.rows.map((row: any) => ({
        referrerDomain: row.referrer_domain,
        visits: Number(row.visits),
        uniqueSessions: Number(row.unique_sessions),
      }));
    } finally {
      client.release();
    }
  }

  async getDeviceStats(filters: QueryFilters): Promise<DeviceStats> {
    const client = await this.pool.connect();

    try {
      const deviceQuery = `
        SELECT
          device_type,
          COUNT(*) as count,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND device_type IS NOT NULL
        GROUP BY device_type
        ORDER BY count DESC
      `;

      const browserQuery = `
        SELECT
          browser_name,
          browser_version,
          COUNT(*) as count
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND browser_name IS NOT NULL
        GROUP BY browser_name, browser_version
        ORDER BY count DESC
        LIMIT 10
      `;

      const osQuery = `
        SELECT
          os_name,
          os_version,
          COUNT(*) as count
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND os_name IS NOT NULL
        GROUP BY os_name, os_version
        ORDER BY count DESC
        LIMIT 10
      `;

      const params = [filters.projectId, filters.startDate, filters.endDate];

      const [deviceResult, browserResult, osResult] = await Promise.all([
        client.query(deviceQuery, params),
        client.query(browserQuery, params),
        client.query(osQuery, params),
      ]);

      return {
        devices: deviceResult.rows.map((row: any) => ({
          deviceType: row.device_type,
          count: Number(row.count),
          uniqueSessions: Number(row.unique_sessions),
        })),
        browsers: browserResult.rows.map((row: any) => ({
          browserName: row.browser_name,
          browserVersion: row.browser_version,
          count: Number(row.count),
        })),
        operatingSystems: osResult.rows.map((row: any) => ({
          osName: row.os_name,
          osVersion: row.os_version,
          count: Number(row.count),
        })),
      };
    } finally {
      client.release();
    }
  }

  async getGeoStats(filters: QueryFilters, limit: number = 20): Promise<GeoStat[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          country,
          city,
          COUNT(*) as pageviews,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT anonymous_id) as unique_visitors
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'pageview'
          AND country IS NOT NULL
        GROUP BY country, city
        ORDER BY pageviews DESC
        LIMIT $4
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
        limit,
      ]);

      return result.rows.map((row: any) => ({
        country: row.country,
        city: row.city,
        pageviews: Number(row.pageviews),
        uniqueSessions: Number(row.unique_sessions),
        uniqueVisitors: Number(row.unique_visitors),
      }));
    } finally {
      client.release();
    }
  }

  async getTimeSeries(
    filters: QueryFilters,
    granularity: 'hour' | 'day' = 'day'
  ): Promise<TimeSeriesPoint[]> {
    const client = await this.pool.connect();

    try {
      const timeFunction = granularity === 'hour' ? 'date_trunc(\'hour\', event_time)' : 'date_trunc(\'day\', event_time)';

      const query = `
        SELECT
          ${timeFunction} as time,
          COUNT(*) as events,
          COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT anonymous_id) as unique_visitors
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
        GROUP BY time
        ORDER BY time ASC
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
      ]);

      return result.rows.map((row: any) => ({
        time: row.time.toISOString(),
        events: Number(row.events),
        pageviews: Number(row.pageviews),
        uniqueSessions: Number(row.unique_sessions),
        uniqueVisitors: Number(row.unique_visitors),
      }));
    } finally {
      client.release();
    }
  }

  async getWebVitals(filters: QueryFilters): Promise<WebVitalMetric[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          properties->>'metric' as metric,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (properties->>'value')::float) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (properties->>'value')::float) as p75,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (properties->>'value')::float) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (properties->>'value')::float) as p99,
          COUNT(*) FILTER (WHERE properties->>'rating' = 'good') as good_count,
          COUNT(*) FILTER (WHERE properties->>'rating' = 'needs-improvement') as needs_improvement_count,
          COUNT(*) FILTER (WHERE properties->>'rating' = 'poor') as poor_count
        FROM events
        WHERE project_id = $1
          AND event_time >= $2::date
          AND event_time < ($3::date + INTERVAL '1 day')
          AND event_type = 'webvital'
        GROUP BY metric
        ORDER BY metric
      `;

      const result = await client.query(query, [
        filters.projectId,
        filters.startDate,
        filters.endDate,
      ]);

      return result.rows.map((row: any) => ({
        metric: row.metric,
        p50: Number(row.p50),
        p75: Number(row.p75),
        p95: Number(row.p95),
        p99: Number(row.p99),
        goodCount: Number(row.good_count),
        needsImprovementCount: Number(row.needs_improvement_count),
        poorCount: Number(row.poor_count),
      }));
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    
  }
}
