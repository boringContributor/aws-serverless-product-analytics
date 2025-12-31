use lambda_http::{Body, Error, Request, Response};
use std::sync::Arc;

use crate::models::{PageViewEvent, TrackEvent, IngestEventPayload, EventContext};
use crate::shared::{create_error_response, create_response, process_events, AppState};

/// Enriches the event with server-side metadata
fn enrich_event(mut payload: IngestEventPayload, request: &Request) -> IngestEventPayload {
    let now = chrono::Utc::now().timestamp_millis();

    // Ensure timestamp is set
    if payload.timestamp == 0 {
        payload.timestamp = now;
    }

    // Enrich context with server-side data
    let mut context = payload.context.unwrap_or_else(|| EventContext {
        page: None,
        user_agent: None,
        locale: None,
        screen: None,
        ip: None,
        received_at: None,
        extra: std::collections::HashMap::new(),
    });

    // Add IP address from request context
    if context.ip.is_none() {
        if let Some(headers) = request.headers().get("x-forwarded-for") {
            context.ip = headers.to_str().ok().map(|s| s.split(',').next().unwrap_or("").trim().to_string());
        }
    }

    // Add user agent if not present
    if context.user_agent.is_none() {
        if let Some(ua) = request.headers().get("user-agent") {
            context.user_agent = ua.to_str().ok().map(String::from);
        }
    }

    // Set received timestamp
    context.received_at = Some(now);

    payload.context = Some(context);
    payload
}

/// Handler for POST /view
pub async fn handle_page_view(
    body: &str,
    request: &Request,
    state: Arc<AppState>,
) -> Result<Response<Body>, Error> {
    let payload: PageViewEvent = match serde_json::from_str(body) {
        Ok(p) => p,
        Err(_) => {
            return Ok(create_error_response(400, "Invalid JSON in request body"));
        }
    };

    if let Err(e) = payload.validate() {
        return Ok(create_error_response(400, &e));
    }

    let normalized = payload.normalize();
    let enriched = enrich_event(normalized, request);

    process_events(vec![enriched], state).await?;

    Ok(create_response(
        202,
        serde_json::json!({
            "success": true,
            "eventsReceived": 1
        }),
    ))
}

/// Handler for POST /event
pub async fn handle_track(
    body: &str,
    request: &Request,
    state: Arc<AppState>,
) -> Result<Response<Body>, Error> {
    let payload: TrackEvent = match serde_json::from_str(body) {
        Ok(p) => p,
        Err(_) => {
            return Ok(create_error_response(400, "Invalid JSON in request body"));
        }
    };

    if let Err(e) = payload.validate() {
        return Ok(create_error_response(400, &e));
    }

    let normalized = payload.normalize();
    let enriched = enrich_event(normalized, request);

    process_events(vec![enriched], state).await?;

    Ok(create_response(
        202,
        serde_json::json!({
            "success": true,
            "eventsReceived": 1
        }),
    ))
}
