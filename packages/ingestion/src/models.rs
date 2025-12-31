use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Page view event payload (POST /view)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageViewEvent {
    pub project_id: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referrer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<EventContext>,
}

/// Custom event payload (POST /track)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackEvent {
    pub project_id: String,
    pub event_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<EventContext>,
}

/// Internal normalized event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestEventPayload {
    pub project_id: String,
    pub event_type: String,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<EventContext>,
}

/// Event context structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<PageContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screen: Option<ScreenContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub received_at: Option<i64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referrer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

impl PageViewEvent {
    /// Validates that the event has required fields
    pub fn validate(&self) -> Result<(), String> {
        if self.project_id.is_empty() {
            return Err("projectId is required".to_string());
        }
        if self.url.is_empty() {
            return Err("url is required".to_string());
        }
        if self.user_id.is_none() && self.anonymous_id.is_none() && self.session_id.is_none() {
            return Err("At least one of (userId, anonymousId, sessionId) is required".to_string());
        }
        Ok(())
    }

    /// Normalizes to internal event format
    pub fn normalize(&self) -> IngestEventPayload {
        let mut properties = HashMap::new();
        properties.insert("url".to_string(), serde_json::json!(self.url));
        if let Some(ref title) = self.title {
            properties.insert("title".to_string(), serde_json::json!(title));
        }
        if let Some(ref referrer) = self.referrer {
            properties.insert("referrer".to_string(), serde_json::json!(referrer));
        }

        IngestEventPayload {
            project_id: self.project_id.clone(),
            event_type: "pageview".to_string(),
            timestamp: self.timestamp.unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            session_id: self.session_id.clone(),
            user_id: self.user_id.clone(),
            anonymous_id: self.anonymous_id.clone(),
            properties: Some(properties),
            context: self.context.clone(),
        }
    }
}

impl TrackEvent {
    /// Validates that the event has required fields
    pub fn validate(&self) -> Result<(), String> {
        if self.project_id.is_empty() {
            return Err("projectId is required".to_string());
        }
        if self.event_name.is_empty() {
            return Err("eventName is required".to_string());
        }
        if self.user_id.is_none() && self.anonymous_id.is_none() && self.session_id.is_none() {
            return Err("At least one of (userId, anonymousId, sessionId) is required".to_string());
        }
        Ok(())
    }

    /// Normalizes to internal event format
    pub fn normalize(&self) -> IngestEventPayload {
        IngestEventPayload {
            project_id: self.project_id.clone(),
            event_type: self.event_name.clone(),
            timestamp: self.timestamp.unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            session_id: self.session_id.clone(),
            user_id: self.user_id.clone(),
            anonymous_id: self.anonymous_id.clone(),
            properties: self.properties.clone(),
            context: self.context.clone(),
        }
    }
}
