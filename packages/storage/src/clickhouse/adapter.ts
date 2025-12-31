/**
 * ClickHouse Storage Adapter
 */

import { createClient, ClickHouseClient } from '@clickhouse/client';
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

export class ClickHouseAdapter implements StorageAdapter {
  private client: ClickHouseClient;

  constructor(config: StorageConfig) {
    const protocol = config.protocol || 'https';
    const port = config.port || 8443;

    this.client = createClient({
      url: `${protocol}://${config.host}:${port}`,
      database: config.database,
      username: config.username || 'default',
      password: config.password || '',
      request_timeout: 30000,
      compression: {
        request: true,
        response: true,
      },
    });
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  async insertEvents(events: DatabaseEvent[]): Promise<void> {
    // DatabaseEvent already has the correct shape for the database
    // Just map field names to match ClickHouse schema if needed
    const rows = events.map((event) => ({
      event_id: event.event_id,
      project_id: event.project_id,
      event_type: event.event_type,
      timestamp: event.event_time,
      session_id: event.session_id,
      user_id: event.user_id,
      anonymous_id: event.anonymous_id,
      page_url: event.page_url,
      page_title: event.page_title,
      page_path: event.page_path,
      page_referrer: event.page_referrer,
      user_agent: event.user_agent,
      browser_name: event.browser_name,
      browser_version: event.browser_version,
      os_name: event.os_name,
      os_version: event.os_version,
      device_type: event.device_type,
      screen_width: event.screen_width,
      screen_height: event.screen_height,
      country: event.country,
      city: event.city,
      region: event.region,
      ip_address: event.ip_address,
      locale: event.locale,
      properties: event.properties,
      received_at: event.received_at,
    }));

    await this.client.insert({
      table: 'events',
      values: rows,
      format: 'JSONEachRow',
    });
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  async getOverview(filters: QueryFilters): Promise<OverviewMetrics> {
    const query = `
      SELECT
        count(*) as totalEvents,
        countIf(event_type = 'pageview') as totalPageviews,
        uniq(session_id) as uniqueSessions,
        uniq(anonymous_id) as uniqueVisitors,
        uniqIf(user_id, user_id IS NOT NULL) as uniqueUsers
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      format: 'JSONEachRow',
    });

    const data = await result.json<any>();
    const row = data[0] || {};

    return {
      totalEvents: Number(row.totalEvents || 0),
      totalPageviews: Number(row.totalPageviews || 0),
      uniqueSessions: Number(row.uniqueSessions || 0),
      uniqueVisitors: Number(row.uniqueVisitors || 0),
      uniqueUsers: Number(row.uniqueUsers || 0),
    };
  }

  async getPageViews(filters: QueryFilters, limit: number = 20): Promise<PageViewStat[]> {
    const query = `
      SELECT
        page_path as path,
        any(page_title) as title,
        count(*) as pageviews,
        uniq(session_id) as uniqueSessions,
        uniq(anonymous_id) as uniqueVisitors
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND page_path IS NOT NULL
      GROUP BY page_path
      ORDER BY pageviews DESC
      LIMIT {limit:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit,
      },
      format: 'JSONEachRow',
    });

    return await result.json<PageViewStat>();
  }

  async getReferrers(filters: QueryFilters, limit: number = 20): Promise<ReferrerStat[]> {
    const query = `
      SELECT
        domain(page_referrer) as referrerDomain,
        count(*) as visits,
        uniq(session_id) as uniqueSessions
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND page_referrer != ''
        AND page_referrer IS NOT NULL
      GROUP BY referrerDomain
      ORDER BY visits DESC
      LIMIT {limit:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit,
      },
      format: 'JSONEachRow',
    });

    return await result.json<ReferrerStat>();
  }

  async getDeviceStats(filters: QueryFilters): Promise<DeviceStats> {
    const deviceQuery = `
      SELECT
        device_type as deviceType,
        count(*) as count,
        uniq(session_id) as uniqueSessions
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND device_type IS NOT NULL
      GROUP BY device_type
      ORDER BY count DESC
    `;

    const browserQuery = `
      SELECT
        browser_name as browserName,
        browser_version as browserVersion,
        count(*) as count
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND browser_name IS NOT NULL
      GROUP BY browser_name, browser_version
      ORDER BY count DESC
      LIMIT 10
    `;

    const osQuery = `
      SELECT
        os_name as osName,
        os_version as osVersion,
        count(*) as count
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND os_name IS NOT NULL
      GROUP BY os_name, os_version
      ORDER BY count DESC
      LIMIT 10
    `;

    const params = {
      projectId: filters.projectId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    };

    const [deviceResult, browserResult, osResult] = await Promise.all([
      this.client.query({ query: deviceQuery, query_params: params, format: 'JSONEachRow' }),
      this.client.query({ query: browserQuery, query_params: params, format: 'JSONEachRow' }),
      this.client.query({ query: osQuery, query_params: params, format: 'JSONEachRow' }),
    ]);

    return {
      devices: await deviceResult.json(),
      browsers: await browserResult.json(),
      operatingSystems: await osResult.json(),
    };
  }

  async getGeoStats(filters: QueryFilters, limit: number = 20): Promise<GeoStat[]> {
    const query = `
      SELECT
        country,
        city,
        count(*) as pageviews,
        uniq(session_id) as uniqueSessions,
        uniq(anonymous_id) as uniqueVisitors
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'pageview'
        AND country IS NOT NULL
      GROUP BY country, city
      ORDER BY pageviews DESC
      LIMIT {limit:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit,
      },
      format: 'JSONEachRow',
    });

    return await result.json<GeoStat>();
  }

  async getTimeSeries(
    filters: QueryFilters,
    granularity: 'hour' | 'day' = 'day'
  ): Promise<TimeSeriesPoint[]> {
    const timeFunction = granularity === 'hour' ? 'toStartOfHour' : 'toStartOfDay';

    const query = `
      SELECT
        ${timeFunction}(timestamp) as time,
        count(*) as events,
        countIf(event_type = 'pageview') as pageviews,
        uniq(session_id) as uniqueSessions,
        uniq(anonymous_id) as uniqueVisitors
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
      GROUP BY time
      ORDER BY time ASC
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      format: 'JSONEachRow',
    });

    return await result.json<TimeSeriesPoint>();
  }

  async getWebVitals(filters: QueryFilters): Promise<WebVitalMetric[]> {
    const query = `
      SELECT
        JSONExtractString(properties, 'metric') as metric,
        quantile(0.50)(toFloat64(JSONExtractString(properties, 'value'))) as p50,
        quantile(0.75)(toFloat64(JSONExtractString(properties, 'value'))) as p75,
        quantile(0.95)(toFloat64(JSONExtractString(properties, 'value'))) as p95,
        quantile(0.99)(toFloat64(JSONExtractString(properties, 'value'))) as p99,
        countIf(JSONExtractString(properties, 'rating') = 'good') as goodCount,
        countIf(JSONExtractString(properties, 'rating') = 'needs-improvement') as needsImprovementCount,
        countIf(JSONExtractString(properties, 'rating') = 'poor') as poorCount
      FROM events
      WHERE project_id = {projectId:String}
        AND date BETWEEN {startDate:Date} AND {endDate:Date}
        AND event_type = 'webvital'
      GROUP BY metric
      ORDER BY metric
    `;

    const result = await this.client.query({
      query,
      query_params: {
        projectId: filters.projectId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      format: 'JSONEachRow',
    });

    return await result.json<WebVitalMetric>();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
