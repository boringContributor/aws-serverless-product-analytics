-- Amazon DSQL Schema for Analytics Events
-- DSQL-compatible schema (no IF NOT EXISTS, renamed timestamp to event_time)

CREATE TABLE events (
  -- Event identification
  project_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,

  -- Session & User tracking
  session_id VARCHAR(255),
  user_id VARCHAR(255),
  anonymous_id VARCHAR(255),

  -- Page context
  page_url TEXT,
  page_title TEXT,
  page_path VARCHAR(2048),
  page_referrer TEXT,

  -- User agent & device
  user_agent TEXT,
  browser_name VARCHAR(100),
  browser_version VARCHAR(50),
  os_name VARCHAR(100),
  os_version VARCHAR(50),
  device_type VARCHAR(50),

  -- Screen dimensions
  screen_width INTEGER,
  screen_height INTEGER,

  -- Geographic data
  country VARCHAR(100),
  city VARCHAR(255),
  region VARCHAR(255),
  ip_address VARCHAR(45),
  locale VARCHAR(10),

  -- Custom properties (JSON)
  properties JSONB,

  -- System timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common query patterns

-- Primary filtering by project and time
CREATE INDEX idx_events_project_event_time
  ON events(project_id, event_time DESC);

-- Event type filtering
CREATE INDEX idx_events_project_type_event_time
  ON events(project_id, event_type, event_time DESC);

-- Session tracking
CREATE INDEX idx_events_session
  ON events(session_id);

-- User tracking
CREATE INDEX idx_events_user
  ON events(user_id);

-- Anonymous visitor tracking
CREATE INDEX idx_events_anonymous
  ON events(anonymous_id);

-- Page path queries
CREATE INDEX idx_events_page_path
  ON events(project_id, page_path, event_time DESC);

-- Geographic queries
CREATE INDEX idx_events_geo
  ON events(project_id, country, city);

-- Device stats queries
CREATE INDEX idx_events_device
  ON events(project_id, device_type, event_time DESC);

-- Browser stats queries
CREATE INDEX idx_events_browser
  ON events(project_id, browser_name, browser_version);

-- OS stats queries
CREATE INDEX idx_events_os
  ON events(project_id, os_name, os_version);

-- GIN index for JSON properties
CREATE INDEX idx_events_properties
  ON events USING GIN(properties);

-- Comments for documentation
COMMENT ON TABLE events IS 'Analytics events table storing all tracked user interactions';
COMMENT ON COLUMN events.project_id IS 'Unique identifier for the project/application';
COMMENT ON COLUMN events.event_type IS 'Type of event (pageview, click, custom, webvital, etc.)';
COMMENT ON COLUMN events.event_time IS 'Client-side timestamp when the event occurred';
COMMENT ON COLUMN events.session_id IS 'Unique session identifier';
COMMENT ON COLUMN events.user_id IS 'Authenticated user ID (if available)';
COMMENT ON COLUMN events.anonymous_id IS 'Anonymous visitor ID (cookie-based)';
COMMENT ON COLUMN events.properties IS 'Custom event properties stored as JSON';
COMMENT ON COLUMN events.received_at IS 'Server-side timestamp when event was received';
