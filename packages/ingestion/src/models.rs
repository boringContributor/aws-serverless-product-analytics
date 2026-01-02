use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Compressed event payload (Vercel Analytics format)
/// POST /view and POST /event both use this format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressedEvent {
    /// Event name (e.g., "pageview", "button_clicked", "webvital")
    pub en: String,
    /// Unix timestamp in milliseconds
    pub ts: i64,
    /// Origin (full page URL)
    pub o: String,
    /// Referrer URL
    pub r: String,
    /// Screen width in pixels
    pub sw: u32,
    /// Screen height in pixels
    pub sh: u32,
    /// Optional event data (custom properties)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ed: Option<HashMap<String, serde_json::Value>>,
}

/// Internal normalized event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestEventPayload {
    pub project_id: String,
    pub event_type: String,
    pub timestamp: i64,
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

impl CompressedEvent {
    /// Validates that the event has required fields
    pub fn validate(&self) -> Result<(), String> {
        if self.en.is_empty() {
            return Err("en (event name) is required".to_string());
        }
        if self.o.is_empty() {
            return Err("o (origin) is required".to_string());
        }
        Ok(())
    }

    /// Normalizes to internal event format
    /// Note: project_id should be extracted from JWT token, not payload
    pub fn normalize(&self, project_id: String, user_id: Option<String>) -> IngestEventPayload {
        let mut properties = HashMap::new();

        // Add URL and referrer to properties
        properties.insert("url".to_string(), serde_json::json!(self.o));
        if !self.r.is_empty() {
            properties.insert("referrer".to_string(), serde_json::json!(self.r));
        }

        // Add screen dimensions to properties
        properties.insert("screen_width".to_string(), serde_json::json!(self.sw));
        properties.insert("screen_height".to_string(), serde_json::json!(self.sh));

        // Merge in custom event data if present
        if let Some(ref ed) = self.ed {
            for (key, value) in ed {
                properties.insert(key.clone(), value.clone());
            }
        }

        // Build context with screen info
        let context = EventContext {
            page: Some(PageContext {
                url: Some(self.o.clone()),
                title: None,
                path: None,
                referrer: if !self.r.is_empty() { Some(self.r.clone()) } else { None },
            }),
            user_agent: None, // Will be set from HTTP header
            locale: None,
            screen: Some(ScreenContext {
                width: Some(self.sw),
                height: Some(self.sh),
            }),
            ip: None,         // Will be set from HTTP header
            received_at: None, // Will be set by handler
            extra: HashMap::new(),
        };

        IngestEventPayload {
            project_id,
            event_type: self.en.clone(),
            timestamp: self.ts,
            user_id,
            anonymous_id: None, // No longer used
            properties: Some(properties),
            context: Some(context),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_webvital_payload() {
        let json = r#"{
    "en": "webvital",
    "ts": 1767348474997,
    "o": "http://localhost:3000/",
    "r": "http://localhost:3000/",
    "sw": 1920,
    "sh": 1080,
    "ed": {
        "metric": "LCP",
        "value": 132,
        "rating": "good"
    }
}"#;

        let result: Result<CompressedEvent, _> = serde_json::from_str(json);
        match &result {
            Ok(event) => {
                println!("Successfully parsed: {:?}", event);
                assert_eq!(event.en, "webvital");
                assert_eq!(event.ts, 1767348474997);
            }
            Err(e) => {
                panic!("Failed to deserialize: {}", e);
            }
        }
    }

    #[test]
    fn test_deserialize_pageview_payload() {
        let json = r#"{
  "ed": {
    "url": "http://localhost:3000/",
    "title": "Analytics React SPA Example",
    "path": "/"
  },
  "en": "pageview",
  "o": "http://localhost:3000/",
  "r": "http://localhost:3000/",
  "sh": 1080,
  "sw": 1920,
  "ts": 1767348122094
}"#;

        let result: Result<CompressedEvent, _> = serde_json::from_str(json);
        match &result {
            Ok(event) => {
                println!("Successfully parsed: {:?}", event);
                assert_eq!(event.en, "pageview");
            }
            Err(e) => {
                panic!("Failed to deserialize: {}", e);
            }
        }
    }
}
