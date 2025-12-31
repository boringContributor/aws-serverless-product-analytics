import { logger } from '@analytics/common/powertools';
import type { KinesisStreamEvent } from 'aws-lambda';
import { getStorage } from '@analytics/storage';
import type { AnalyticsEvent, DatabaseEvent } from '@analytics/storage';
import { UAParser } from 'ua-parser-js';
import { randomUUID } from 'node:crypto';

function transformToDatabaseEvent(event: AnalyticsEvent): DatabaseEvent {
  const userAgent = event.context?.userAgent || null;

  let browserName: string | null = null;
  let browserVersion: string | null = null;
  let osName: string | null = null;
  let osVersion: string | null = null;
  let deviceType: string | null = null;

  if (userAgent) {
    const parser = new UAParser(userAgent);
    const parsed = parser.getResult();

    browserName = parsed.browser.name || null;
    browserVersion = parsed.browser.version || null;
    osName = parsed.os.name || null;
    osVersion = parsed.os.version || null;
    deviceType = parsed.device.type || 'desktop';
  }

  // Extract page data
  const pageUrl = event.context?.page?.url || (event.properties?.url as string) || null;
  const pageTitle = event.context?.page?.title || (event.properties?.title as string) || null;
  const pagePath = event.context?.page?.path || (event.properties?.path as string) || null;
  const pageReferrer = event.context?.page?.referrer || (event.properties?.referrer as string) || null;

  return {
    event_id: randomUUID(),
    project_id: event.projectId,
    event_type: event.eventType,
    event_time: new Date(event.timestamp),
    session_id: event.sessionId || null,
    user_id: event.userId || null,
    anonymous_id: event.anonymousId || null,

    page_url: pageUrl,
    page_title: pageTitle,
    page_path: pagePath,
    page_referrer: pageReferrer,

    user_agent: userAgent,
    browser_name: browserName,
    browser_version: browserVersion,
    os_name: osName,
    os_version: osVersion,
    device_type: deviceType,

    screen_width: event.context?.screen?.width || null,
    screen_height: event.context?.screen?.height || null,

    country: event.context?.geo?.country || null,
    city: event.context?.geo?.city || null,
    region: event.context?.geo?.region || null,
    ip_address: event.context?.ip || null,
    locale: event.context?.locale || null,

    // Custom properties (as JSON string)
    properties: event.properties ? JSON.stringify(event.properties) : null,
    received_at: event.context?.receivedAt ? new Date(event.context.receivedAt) : new Date(),
  };
}

export async function handler(event: KinesisStreamEvent) {
  logger.info(`Processing ${event.Records.length} records from Kinesis`);

  const databaseEvents: DatabaseEvent[] = [];

  // Parse Kinesis records and transform to database events
  for (const record of event.Records) {
    try {
      const payload = Buffer.from(record.kinesis.data, 'base64').toString('utf-8');
      const analyticsEvent: AnalyticsEvent = JSON.parse(payload);

      // Transform to database event (includes user agent parsing)
      const databaseEvent = transformToDatabaseEvent(analyticsEvent);

      databaseEvents.push(databaseEvent);
    } catch (error) {
      logger.error('Failed to parse record:', {
        error,
        partitionKey: record.kinesis.partitionKey,
        sequenceNumber: record.kinesis.sequenceNumber,
      });
    }
  }

  if (databaseEvents.length === 0) {
    logger.info('No valid events to process');
    return;
  }

  logger.info(`Transformed ${databaseEvents.length} events for database`);

  try {
    const db = getStorage();
    await db.insertEvents(databaseEvents);
    logger.info(`Successfully inserted ${databaseEvents.length} events`);
  } catch (error) {
    logger.error('Failed to insert events:', { error });
    throw error; // Trigger Lambda retry
  }
}
